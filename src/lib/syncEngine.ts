/**
 * Motor de Sincronização de Tabelas
 * 
 * Mantém custodia e controle_de_carteiras atualizadas
 * automaticamente quando movimentacoes são alteradas.
 */
import { supabase } from "@/integrations/supabase/client";
import { calcularRendaFixaDiario } from "@/lib/rendaFixaEngine";

// ── Resgate no Vencimento Auto Sync ──

type SyncCustodiaBase = {
  vencimento: string | null;
  resgate_total: string | null;
  modalidade: string | null;
  taxa: number | null;
  data_inicio: string;
  categoria_id: string;
  produto_id: string;
  instituicao_id: string | null;
  emissor_id: string | null;
  pagamento: string | null;
  indexador: string | null;
  nome: string | null;
  preco_unitario: number | null;
};

function formatValorExtrato(valor: number, precoUnitario: number, quantidade: number) {
  const fmtBR = (v: number) =>
    v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return `R$ ${fmtBR(valor)} (${fmtBR(precoUnitario)} x ${fmtBR(quantidade)})`;
}

/**
 * Recalculate manual "Resgate Total" rows created by the "Fechar Posição" flow.
 * These rows are derived values and must be updated when earlier movimentações change.
 */
async function syncManualResgatesTotais(
  codigoCustodia: number,
  userId: string,
  custodiaRecord: SyncCustodiaBase
) {
  try {
    const { data: manualResgates } = await supabase
      .from("movimentacoes")
      .select("id, data")
      .eq("codigo_custodia", codigoCustodia)
      .eq("user_id", userId)
      .eq("tipo_movimentacao", "Resgate Total")
      .eq("origem", "manual")
      .order("data");

    if (!manualResgates || manualResgates.length === 0) return;

    const lastResgateDate = manualResgates[manualResgates.length - 1].data;

    const [{ data: calendario }, { data: movs }] = await Promise.all([
      supabase
        .from("calendario_dias_uteis")
        .select("data, dia_util")
        .gte("data", custodiaRecord.data_inicio)
        .lte("data", lastResgateDate)
        .order("data"),
      supabase
        .from("movimentacoes")
        .select("id, data, tipo_movimentacao, valor")
        .eq("codigo_custodia", codigoCustodia)
        .eq("user_id", userId)
        .neq("tipo_movimentacao", "Resgate no Vencimento")
        .order("data"),
    ]);

    if (!calendario || !movs) return;

    for (const manualResgate of manualResgates) {
      const calendarioAteData = calendario.filter((dia) => dia.data <= manualResgate.data);
      const movsAteData = movs
        .filter((mov) => mov.id !== manualResgate.id && mov.data <= manualResgate.data)
        .map((mov) => ({
          data: mov.data,
          tipo_movimentacao: mov.tipo_movimentacao,
          valor: Number(mov.valor),
        }));

      if (calendarioAteData.length === 0) continue;

      const rows = calcularRendaFixaDiario({
        dataInicio: custodiaRecord.data_inicio,
        dataCalculo: manualResgate.data,
        taxa: custodiaRecord.taxa || 0,
        modalidade: custodiaRecord.modalidade || "Prefixado",
        puInicial: custodiaRecord.preco_unitario || 1000,
        calendario: calendarioAteData,
        movimentacoes: movsAteData,
        dataResgateTotal: null,
        pagamento: custodiaRecord.pagamento,
        vencimento: custodiaRecord.vencimento,
      });

      const rowDia = rows[rows.length - 1];
      if (!rowDia) continue;

      const valor = Math.max(rowDia.liquido, 0);
      const precoUnitario = rowDia.valorCota2;
      const quantidade = precoUnitario > 0 ? valor / precoUnitario : 0;

      await supabase
        .from("movimentacoes")
        .update({
          valor,
          preco_unitario: precoUnitario,
          quantidade,
          valor_extrato: formatValorExtrato(valor, precoUnitario, quantidade),
        })
        .eq("id", manualResgate.id);
    }
  } catch (err) {
    console.error("syncManualResgatesTotais: erro ao recalcular Resgate Total", err);
  }
}

/**
 * Automatically creates or removes a "Resgate no Vencimento" movimentacao
 * when resgate_total === vencimento AND vencimento < today (real date).
 */
async function syncResgateNoVencimento(
  codigoCustodia: number,
  userId: string,
  custodiaRecord: SyncCustodiaBase
) {
  const hoje = new Date().toISOString().slice(0, 10);
  const { vencimento, resgate_total } = custodiaRecord;

  const shouldCreate =
    vencimento && resgate_total && resgate_total === vencimento && vencimento < hoje;

  // Find existing auto resgate
  const { data: existingAuto } = await supabase
    .from("movimentacoes")
    .select("id")
    .eq("codigo_custodia", codigoCustodia)
    .eq("user_id", userId)
    .eq("tipo_movimentacao", "Resgate no Vencimento")
    .eq("origem", "automatico")
    .limit(1);

  if (!shouldCreate) {
    // Remove if exists
    if (existingAuto && existingAuto.length > 0) {
      await supabase
        .from("movimentacoes")
        .delete()
        .eq("id", existingAuto[0].id);
    }
    return;
  }

  const existingId = existingAuto && existingAuto.length > 0 ? existingAuto[0].id : null;

  // Calculate liquido and cota via engine
  try {
    const { data: calendario } = await supabase
      .from("calendario_dias_uteis")
      .select("data, dia_util")
      .gte("data", custodiaRecord.data_inicio)
      .lte("data", vencimento!)
      .order("data");

    const { data: movs } = await supabase
      .from("movimentacoes")
      .select("data, tipo_movimentacao, valor")
      .eq("codigo_custodia", codigoCustodia)
      .eq("user_id", userId)
      .neq("tipo_movimentacao", "Resgate no Vencimento")
      .order("data");

    if (!calendario || !movs) return;

    const rows = calcularRendaFixaDiario({
      dataInicio: custodiaRecord.data_inicio,
      dataCalculo: vencimento!,
      taxa: custodiaRecord.taxa || 0,
      modalidade: custodiaRecord.modalidade || "Prefixado",
      puInicial: custodiaRecord.preco_unitario || 1000,
      calendario,
      movimentacoes: movs,
      dataResgateTotal: custodiaRecord.resgate_total,
    });

    if (rows.length === 0) return;

    const lastRow = rows[rows.length - 1];
    const valor = lastRow.liquido;
    const precoUnitario = lastRow.valorCota2;
    const quantidade = precoUnitario > 0 ? valor / precoUnitario : 0;

    const movData = {
      user_id: userId,
      data: vencimento!,
      tipo_movimentacao: "Resgate no Vencimento",
      codigo_custodia: codigoCustodia,
      categoria_id: custodiaRecord.categoria_id,
      produto_id: custodiaRecord.produto_id,
      instituicao_id: custodiaRecord.instituicao_id,
      emissor_id: custodiaRecord.emissor_id,
      modalidade: custodiaRecord.modalidade,
      indexador: custodiaRecord.indexador,
      taxa: custodiaRecord.taxa,
      pagamento: custodiaRecord.pagamento,
      vencimento: custodiaRecord.vencimento,
      preco_unitario: precoUnitario,
      quantidade,
      valor,
      valor_extrato: formatValorExtrato(valor, precoUnitario, quantidade),
      nome_ativo: custodiaRecord.nome,
      origem: "automatico",
    };

    if (existingId) {
      await supabase.from("movimentacoes").update(movData).eq("id", existingId);
    } else {
      await supabase.from("movimentacoes").insert(movData);
    }
  } catch (err) {
    console.error("syncResgateNoVencimento: erro ao calcular/inserir", err);
  }
}

// ── Custodia Sync ──

/** Compute resgate_total for a Renda Fixa custodia record */
async function computeResgateTotal(codigoCustodia: number, userId: string, vencimento: string | null): Promise<string | null> {
  // Find the most recent "Resgate Total"
  const { data: resgateTotal } = await supabase
    .from("movimentacoes")
    .select("data")
    .eq("codigo_custodia", codigoCustodia)
    .eq("user_id", userId)
    .eq("tipo_movimentacao", "Resgate Total")
    .order("data", { ascending: false })
    .limit(1);

  if (resgateTotal && resgateTotal.length > 0) {
    const dataResgate = resgateTotal[0].data;

    // Check if there's an application AFTER the most recent Resgate Total
    const { data: aplicacaoPostResgate } = await supabase
      .from("movimentacoes")
      .select("data")
      .eq("codigo_custodia", codigoCustodia)
      .eq("user_id", userId)
      .in("tipo_movimentacao", ["Aplicação Inicial", "Aplicação"])
      .gt("data", dataResgate)
      .order("data", { ascending: false })
      .limit(1);

    if (aplicacaoPostResgate && aplicacaoPostResgate.length > 0) {
      // There's an application after the resgate total — revert to vencimento
      return vencimento || null;
    }

    return dataResgate;
  }
  return vencimento || null;
}

/** Compute data_calculo based on data_referencia, resgate_total, and data_limite */
function computeDataCalculo(dataReferencia: string, resgateTotal: string | null, dataLimite: string | null): string | null {
  if (!resgateTotal && !dataLimite) return dataReferencia;

  // If data_referencia >= resgate_total, use resgate_total
  if (resgateTotal && dataReferencia >= resgateTotal) {
    return resgateTotal;
  }

  // If data_referencia < resgate_total:
  // Check data_limite
  if (dataLimite) {
    if (dataReferencia >= dataLimite) {
      return dataLimite;
    } else {
      return dataReferencia;
    }
  }

  return dataReferencia;
}

/** After inserting/updating a movimentacao, upsert the corresponding custodia record */
export async function syncCustodiaFromMovimentacao(movimentacaoId: string, dataReferencia?: string) {
  const refDate = dataReferencia || new Date().toISOString().slice(0, 10);

  // Fetch the movimentacao with related names
  const { data: mov, error } = await supabase
    .from("movimentacoes")
    .select("*, categorias(nome)")
    .eq("id", movimentacaoId)
    .single();

  if (error || !mov) {
    console.error("syncCustodia: movimentação não encontrada", error);
    return;
  }

  const categoriaNome = (mov as any).categorias?.nome || "";
  const isRendaFixa = categoriaNome === "Renda Fixa";

  if (!mov.codigo_custodia) return;

  // Fetch ALL movimentações for this codigo_custodia to aggregate values
  const { data: allMovs } = await supabase
    .from("movimentacoes")
    .select("*")
    .eq("codigo_custodia", mov.codigo_custodia)
    .eq("user_id", mov.user_id)
    .order("data", { ascending: true });

  // ── Ensure "Aplicação Inicial" is always the earliest application ──
  const aplicacoes = (allMovs || []).filter(
    (m: any) => ["Aplicação Inicial", "Aplicação"].includes(m.tipo_movimentacao)
  );
  if (aplicacoes.length > 1) {
    // Sort by date ascending — the earliest should be "Aplicação Inicial"
    const sorted = [...aplicacoes].sort((a, b) => a.data.localeCompare(b.data));
    const earliest = sorted[0];
    // If the earliest is not "Aplicação Inicial", swap types
    if (earliest.tipo_movimentacao !== "Aplicação Inicial") {
      // Find current "Aplicação Inicial" and demote it
      const currentInicial = sorted.find((m) => m.tipo_movimentacao === "Aplicação Inicial");
      if (currentInicial) {
        await supabase
          .from("movimentacoes")
          .update({ tipo_movimentacao: "Aplicação" })
          .eq("id", currentInicial.id);
      }
      // Promote earliest to "Aplicação Inicial"
      await supabase
        .from("movimentacoes")
        .update({ tipo_movimentacao: "Aplicação Inicial" })
        .eq("id", earliest.id);
      // Update local references
      if (currentInicial) currentInicial.tipo_movimentacao = "Aplicação";
      earliest.tipo_movimentacao = "Aplicação Inicial";
    }
  }

  // Find the first application (Aplicação Inicial) for base fields
  const aplicacaoInicial = (allMovs || []).find(
    (m: any) => m.tipo_movimentacao === "Aplicação Inicial"
  ) || (allMovs || []).find(
    (m: any) => m.tipo_movimentacao === "Aplicação"
  ) || mov;

  // Compute net valor_investido: sum of aplicações - sum of resgates
  let valorInvestidoLiquido = 0;
  for (const m of allMovs || []) {
    if (["Aplicação Inicial", "Aplicação", "Aporte Adicional"].includes(m.tipo_movimentacao)) {
      valorInvestidoLiquido += m.valor;
    } else if (["Resgate", "Resgate no Vencimento", "Resgate Total"].includes(m.tipo_movimentacao)) {
      valorInvestidoLiquido -= m.valor;
    }
  }
  if (valorInvestidoLiquido < 0) valorInvestidoLiquido = 0;

  // Compute resgate_total for Renda Fixa
  let resgateTotal: string | null = null;
  if (isRendaFixa) {
    resgateTotal = await computeResgateTotal(mov.codigo_custodia, mov.user_id!, aplicacaoInicial.vencimento);
  }

  // Compute data_limite
  const dataLimite = isRendaFixa ? aplicacaoInicial.vencimento : null;

  // Compute data_calculo
  const dataCalculo = computeDataCalculo(refDate, resgateTotal, dataLimite);

  // Check if custodia record already exists
  const { data: existing } = await supabase
    .from("custodia")
    .select("id")
    .eq("codigo_custodia", mov.codigo_custodia)
    .eq("user_id", mov.user_id!)
    .limit(1);

  const custodiaData = {
    codigo_custodia: mov.codigo_custodia,
    data_inicio: aplicacaoInicial.data,
    produto_id: aplicacaoInicial.produto_id,
    tipo_movimentacao: aplicacaoInicial.tipo_movimentacao,
    instituicao_id: aplicacaoInicial.instituicao_id,
    modalidade: aplicacaoInicial.modalidade,
    indexador: aplicacaoInicial.indexador,
    taxa: aplicacaoInicial.taxa,
    valor_investido: valorInvestidoLiquido,
    preco_unitario: aplicacaoInicial.preco_unitario,
    quantidade: aplicacaoInicial.quantidade,
    vencimento: aplicacaoInicial.vencimento,
    emissor_id: aplicacaoInicial.emissor_id,
    pagamento: aplicacaoInicial.pagamento,
    nome: aplicacaoInicial.nome_ativo,
    categoria_id: aplicacaoInicial.categoria_id,
    user_id: mov.user_id,
    data_limite: dataLimite,
    alocacao_patrimonial: isRendaFixa ? "Renda Fixa" : null,
    multiplicador: categoriaNome || null,
    resgate_total: resgateTotal,
    data_calculo: dataCalculo,
  };

  if (existing && existing.length > 0) {
    const { error: upErr } = await supabase
      .from("custodia")
      .update(custodiaData)
      .eq("id", existing[0].id);
    if (upErr) console.error("syncCustodia: erro ao atualizar", upErr);
  } else {
    const { error: insErr } = await supabase
      .from("custodia")
      .insert(custodiaData);
    if (insErr) console.error("syncCustodia: erro ao inserir", insErr);
  }

  // Sync manual "Resgate Total" values created by the "Fechar Posição" flow
  if (isRendaFixa) {
    await syncManualResgatesTotais(mov.codigo_custodia, mov.user_id!, {
      vencimento: aplicacaoInicial.vencimento,
      resgate_total: resgateTotal,
      modalidade: aplicacaoInicial.modalidade,
      taxa: aplicacaoInicial.taxa,
      data_inicio: aplicacaoInicial.data,
      categoria_id: aplicacaoInicial.categoria_id,
      produto_id: aplicacaoInicial.produto_id,
      instituicao_id: aplicacaoInicial.instituicao_id,
      emissor_id: aplicacaoInicial.emissor_id,
      pagamento: aplicacaoInicial.pagamento,
      indexador: aplicacaoInicial.indexador,
      nome: aplicacaoInicial.nome_ativo,
      preco_unitario: aplicacaoInicial.preco_unitario,
    });

    // Sync automatic "Resgate no Vencimento"
    await syncResgateNoVencimento(mov.codigo_custodia, mov.user_id!, {
      vencimento: aplicacaoInicial.vencimento,
      resgate_total: resgateTotal,
      modalidade: aplicacaoInicial.modalidade,
      taxa: aplicacaoInicial.taxa,
      data_inicio: aplicacaoInicial.data,
      categoria_id: aplicacaoInicial.categoria_id,
      produto_id: aplicacaoInicial.produto_id,
      instituicao_id: aplicacaoInicial.instituicao_id,
      emissor_id: aplicacaoInicial.emissor_id,
      pagamento: aplicacaoInicial.pagamento,
      indexador: aplicacaoInicial.indexador,
      nome: aplicacaoInicial.nome_ativo,
      preco_unitario: aplicacaoInicial.preco_unitario,
    });
  }
}

/** After deleting a movimentacao, remove the custodia record if no more movimentacoes reference it */
export async function syncCustodiaOnDelete(codigoCustodia: number, userId: string, dataReferencia?: string) {
  if (!codigoCustodia) return;

  const { data: remaining } = await supabase
    .from("movimentacoes")
    .select("id")
    .eq("codigo_custodia", codigoCustodia)
    .eq("user_id", userId)
    .limit(1);

  if (!remaining || remaining.length === 0) {
    await supabase
      .from("custodia")
      .delete()
      .eq("codigo_custodia", codigoCustodia)
      .eq("user_id", userId);
  } else {
    await syncCustodiaFromMovimentacao(remaining[0].id, dataReferencia);
  }
}

// ── Controle de Carteiras Sync ──

/** Recalculate controle_de_carteiras for a specific category */
export async function syncControleCarteiras(categoriaId: string, userId: string, dataReferencia?: string) {
  const refDate = dataReferencia || new Date().toISOString().slice(0, 10);

  const { data: catData } = await supabase
    .from("categorias")
    .select("nome")
    .eq("id", categoriaId)
    .single();
  const categoriaNome = catData?.nome || "Desconhecida";

  const { data: custodiaRows } = await supabase
    .from("custodia")
    .select("data_inicio, data_limite, data_calculo")
    .eq("categoria_id", categoriaId)
    .eq("user_id", userId);

  if (!custodiaRows || custodiaRows.length === 0) {
    await supabase
      .from("controle_de_carteiras")
      .delete()
      .eq("categoria_id", categoriaId)
      .eq("user_id", userId)
      .neq("nome_carteira", "Investimentos");
    await syncCarteiraGeral(userId, refDate);
    return;
  }

  const dates = (field: string) =>
    (custodiaRows || []).map((r: any) => r[field]).filter(Boolean).sort();

  const dataInicio = dates("data_inicio")[0] || null;
  const dataLimite = dates("data_limite").reverse()[0] || null;
  const dataCalculo = dates("data_calculo").reverse()[0] || null;

  // Compute resgate_total from custodia for this category
  // Get the most recent resgate_total (vencimento or fechamento date) from custodia
  const { data: custodiaResgateRows } = await supabase
    .from("custodia")
    .select("vencimento, codigo_custodia")
    .eq("categoria_id", categoriaId)
    .eq("user_id", userId);

  let resgateTotal: string | null = null;
  if (custodiaResgateRows && custodiaResgateRows.length > 0) {
    const resgateDates: string[] = [];
    for (const row of custodiaResgateRows) {
      const rt = await computeResgateTotal(row.codigo_custodia, userId, row.vencimento);
      if (rt) resgateDates.push(rt);
    }
    if (resgateDates.length > 0) {
      resgateDates.sort();
      resgateTotal = resgateDates[resgateDates.length - 1]; // most recent
    }
  }

  // Status rules:
  // If data_referencia < data_inicio → "Não Iniciada"
  // If resgate_total > data_referencia → "Ativa"
  // Otherwise → "Encerrada"
  let status = "Ativa";
  if (dataInicio && refDate < dataInicio) {
    status = "Não Iniciada";
  } else if (resgateTotal && resgateTotal > refDate) {
    status = "Ativa";
  } else if (resgateTotal && resgateTotal <= refDate) {
    status = "Encerrada";
  }

  const { data: existing } = await supabase
    .from("controle_de_carteiras")
    .select("id")
    .eq("categoria_id", categoriaId)
    .eq("user_id", userId)
    .neq("nome_carteira", "Investimentos")
    .limit(1);

  const carteiraData = {
    data_inicio: dataInicio,
    data_limite: dataLimite,
    resgate_total: resgateTotal,
    data_calculo: dataCalculo,
    status,
  };

  if (existing && existing.length > 0) {
    await supabase.from("controle_de_carteiras").update(carteiraData).eq("id", existing[0].id);
  } else {
    await supabase.from("controle_de_carteiras").insert({
      categoria_id: categoriaId,
      nome_carteira: categoriaNome,
      ...carteiraData,
      user_id: userId,
    });
  }

  await syncCarteiraGeral(userId, refDate);
}

/** Recalculate the general "Investimentos" carteira */
export async function syncCarteiraGeral(userId: string, dataReferencia?: string) {
  const refDate = dataReferencia || new Date().toISOString().slice(0, 10);

  const { data: allCustodia } = await supabase
    .from("custodia")
    .select("data_inicio, data_limite, data_calculo, vencimento, codigo_custodia")
    .eq("user_id", userId);

  if (!allCustodia || allCustodia.length === 0) {
    await supabase
      .from("controle_de_carteiras")
      .delete()
      .eq("nome_carteira", "Investimentos")
      .eq("user_id", userId);
    return;
  }

  const dates = (field: string) =>
    allCustodia.map((r: any) => r[field]).filter(Boolean).sort();

  const dataInicio = dates("data_inicio")[0] || null;
  const dataLimite = dates("data_limite").reverse()[0] || null;
  const dataCalculo = dates("data_calculo").reverse()[0] || null;

  // Compute resgate_total across all custodia
  const resgateDates: string[] = [];
  for (const row of allCustodia) {
    const rt = await computeResgateTotal(row.codigo_custodia, userId, row.vencimento);
    if (rt) resgateDates.push(rt);
  }
  let resgateTotal: string | null = null;
  if (resgateDates.length > 0) {
    resgateDates.sort();
    resgateTotal = resgateDates[resgateDates.length - 1];
  }

  let status = "Ativa";
  if (dataInicio && refDate < dataInicio) {
    status = "Não Iniciada";
  } else if (resgateTotal && resgateTotal > refDate) {
    status = "Ativa";
  } else if (resgateTotal && resgateTotal <= refDate) {
    status = "Encerrada";
  }

  const { data: existing } = await supabase
    .from("controle_de_carteiras")
    .select("id")
    .eq("nome_carteira", "Investimentos")
    .eq("user_id", userId)
    .limit(1);

  const { data: firstCat } = await supabase.from("categorias").select("id").limit(1);
  const catId = firstCat?.[0]?.id;
  if (!catId) return;

  const carteiraData = {
    data_inicio: dataInicio,
    data_limite: dataLimite,
    resgate_total: resgateTotal,
    data_calculo: dataCalculo,
    status,
  };

  if (existing && existing.length > 0) {
    await supabase.from("controle_de_carteiras").update(carteiraData).eq("id", existing[0].id);
  } else {
    await supabase.from("controle_de_carteiras").insert({
      categoria_id: catId,
      nome_carteira: "Investimentos",
      ...carteiraData,
      user_id: userId,
    });
  }
}

/** Full sync: update custodia + controle_de_carteiras after a movimentacao change */
export async function fullSyncAfterMovimentacao(
  movimentacaoId: string | null,
  categoriaId: string,
  userId: string,
  dataReferencia?: string
) {
  if (movimentacaoId) {
    await syncCustodiaFromMovimentacao(movimentacaoId, dataReferencia);
  }
  await syncControleCarteiras(categoriaId, userId, dataReferencia);
}

/** Full sync after deleting a movimentacao */
export async function fullSyncAfterDelete(
  codigoCustodia: number | null,
  categoriaId: string,
  userId: string,
  dataReferencia?: string
) {
  if (codigoCustodia) {
    await syncCustodiaOnDelete(codigoCustodia, userId, dataReferencia);
  }
  await syncControleCarteiras(categoriaId, userId, dataReferencia);
}

/** Recalculate ALL custodia and controle_de_carteiras for a user based on a new data_referencia */
export async function recalculateAllForDataReferencia(userId: string, dataReferencia: string) {
  // 1. Recalculate all custodia records
  const { data: allCustodia } = await supabase
    .from("custodia")
    .select("id, codigo_custodia, categoria_id, vencimento, data_limite, data_inicio, user_id, modalidade, taxa, produto_id, instituicao_id, emissor_id, pagamento, indexador, nome, preco_unitario, pu_inicial, categorias(nome)")
    .eq("user_id", userId);

  if (allCustodia) {
    for (const row of allCustodia) {
      const categoriaNome = (row as any).categorias?.nome || "";
      const isRendaFixa = categoriaNome === "Renda Fixa";

      let resgateTotal: string | null = null;
      if (isRendaFixa) {
        resgateTotal = await computeResgateTotal(row.codigo_custodia, userId, row.vencimento);
      }

      const dataLimite = isRendaFixa ? row.vencimento : null;
      const dataCalculo = computeDataCalculo(dataReferencia, resgateTotal, dataLimite);

      await supabase
        .from("custodia")
        .update({ resgate_total: resgateTotal, data_calculo: dataCalculo, data_limite: dataLimite })
        .eq("id", row.id);

      // Sync manual "Resgate Total" values created by the "Fechar Posição" flow
      if (isRendaFixa) {
        await syncManualResgatesTotais(row.codigo_custodia, userId, {
          vencimento: row.vencimento,
          resgate_total: resgateTotal,
          modalidade: row.modalidade,
          taxa: row.taxa,
          data_inicio: row.data_inicio,
          categoria_id: row.categoria_id,
          produto_id: row.produto_id,
          instituicao_id: row.instituicao_id,
          emissor_id: row.emissor_id,
          pagamento: row.pagamento,
          indexador: row.indexador,
          nome: row.nome,
          preco_unitario: row.pu_inicial ?? row.preco_unitario,
        });

        // Sync automatic "Resgate no Vencimento"
        await syncResgateNoVencimento(row.codigo_custodia, userId, {
          vencimento: row.vencimento,
          resgate_total: resgateTotal,
          modalidade: row.modalidade,
          taxa: row.taxa,
          data_inicio: row.data_inicio,
          categoria_id: row.categoria_id,
          produto_id: row.produto_id,
          instituicao_id: row.instituicao_id,
          emissor_id: row.emissor_id,
          pagamento: row.pagamento,
          indexador: row.indexador,
          nome: row.nome,
          preco_unitario: row.pu_inicial ?? row.preco_unitario,
        });
      }
    }
  }

  // 2. Recalculate all controle_de_carteiras
  const { data: allCarteiras } = await supabase
    .from("controle_de_carteiras")
    .select("id, categoria_id, nome_carteira")
    .eq("user_id", userId);

  if (allCarteiras) {
    for (const carteira of allCarteiras) {
      if (carteira.nome_carteira === "Investimentos") {
        await syncCarteiraGeral(userId, dataReferencia);
      } else {
        await syncControleCarteiras(carteira.categoria_id, userId, dataReferencia);
      }
    }
  }
}

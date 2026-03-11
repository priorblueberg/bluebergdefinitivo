/**
 * Motor de Sincronização de Tabelas
 * 
 * Mantém custodia e controle_de_carteiras atualizadas
 * automaticamente quando movimentacoes são alteradas.
 */
import { supabase } from "@/integrations/supabase/client";

// ── Custodia Sync ──

/** After inserting/updating a movimentacao, upsert the corresponding custodia record */
export async function syncCustodiaFromMovimentacao(movimentacaoId: string) {
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

  if (!mov.codigo_custodia) return; // no custodia link

  // Check if custodia record already exists for this codigo_custodia + user
  const { data: existing } = await supabase
    .from("custodia")
    .select("id")
    .eq("codigo_custodia", mov.codigo_custodia)
    .eq("user_id", mov.user_id!)
    .limit(1);

  const custodiaData = {
    codigo_custodia: mov.codigo_custodia,
    data_inicio: mov.data,
    produto_id: mov.produto_id,
    tipo_movimentacao: mov.tipo_movimentacao,
    instituicao_id: mov.instituicao_id,
    modalidade: mov.modalidade,
    indexador: mov.indexador,
    taxa: mov.taxa,
    valor_investido: mov.valor,
    preco_unitario: mov.preco_unitario,
    quantidade: mov.quantidade,
    vencimento: mov.vencimento,
    emissor_id: mov.emissor_id,
    pagamento: mov.pagamento,
    nome: mov.nome_ativo,
    categoria_id: mov.categoria_id,
    user_id: mov.user_id,
    data_limite: isRendaFixa ? mov.vencimento : null,
    alocacao_patrimonial: isRendaFixa ? "Renda Fixa" : null,
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
}

/** After deleting a movimentacao, remove the custodia record if no more movimentacoes reference it */
export async function syncCustodiaOnDelete(codigoCustodia: number, userId: string) {
  if (!codigoCustodia) return;

  // Check if other movimentacoes still reference this codigo_custodia
  const { data: remaining } = await supabase
    .from("movimentacoes")
    .select("id")
    .eq("codigo_custodia", codigoCustodia)
    .eq("user_id", userId)
    .limit(1);

  if (!remaining || remaining.length === 0) {
    // No more movimentacoes → delete custodia record
    await supabase
      .from("custodia")
      .delete()
      .eq("codigo_custodia", codigoCustodia)
      .eq("user_id", userId);
  } else {
    // Recalculate custodia from remaining movimentacao
    await syncCustodiaFromMovimentacao(remaining[0].id);
  }
}

// ── Controle de Carteiras Sync ──

/** Recalculate controle_de_carteiras for a specific category */
export async function syncControleCarteiras(categoriaId: string, userId: string) {
  const { data: catData } = await supabase
    .from("categorias")
    .select("nome")
    .eq("id", categoriaId)
    .single();
  const categoriaNome = catData?.nome || "Desconhecida";

  const { data: custodiaRows } = await supabase
    .from("custodia")
    .select("data_inicio, data_limite, resgate_total, data_calculo")
    .eq("categoria_id", categoriaId)
    .eq("user_id", userId);

  const dates = (field: string) =>
    (custodiaRows || []).map((r: any) => r[field]).filter(Boolean).sort();

  if (!custodiaRows || custodiaRows.length === 0) {
    // No custodia left → remove carteira entry for this category
    await supabase
      .from("controle_de_carteiras")
      .delete()
      .eq("categoria_id", categoriaId)
      .eq("user_id", userId)
      .neq("nome_carteira", "Investimentos");
    await syncCarteiraGeral(userId);
    return;
  }

  const dataInicio = dates("data_inicio")[0] || null;
  const dataLimite = dates("data_limite").reverse()[0] || null;
  const resgateTotal = dates("resgate_total").reverse()[0] || null;
  const dataCalculo = dates("data_calculo").reverse()[0] || null;

  const today = new Date().toISOString().slice(0, 10);
  const status = resgateTotal && resgateTotal > today ? "Ativa" : (resgateTotal ? "Encerrada" : "Ativa");

  const { data: existing } = await supabase
    .from("controle_de_carteiras")
    .select("id")
    .eq("categoria_id", categoriaId)
    .eq("user_id", userId)
    .neq("nome_carteira", "Investimentos")
    .limit(1);

  if (existing && existing.length > 0) {
    await supabase.from("controle_de_carteiras").update({
      data_inicio: dataInicio,
      data_limite: dataLimite,
      resgate_total: resgateTotal,
      data_calculo: dataCalculo,
      status,
    }).eq("id", existing[0].id);
  } else {
    await supabase.from("controle_de_carteiras").insert({
      categoria_id: categoriaId,
      nome_carteira: categoriaNome,
      data_inicio: dataInicio,
      data_limite: dataLimite,
      resgate_total: resgateTotal,
      data_calculo: dataCalculo,
      status,
      user_id: userId,
    });
  }

  await syncCarteiraGeral(userId);
}

/** Recalculate the general "Investimentos" carteira */
export async function syncCarteiraGeral(userId: string) {
  const { data: allCustodia } = await supabase
    .from("custodia")
    .select("data_inicio, data_limite, resgate_total, data_calculo")
    .eq("user_id", userId);

  if (!allCustodia || allCustodia.length === 0) {
    // No custodia at all → remove "Investimentos"
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
  const resgateTotal = dates("resgate_total").reverse()[0] || null;
  const dataCalculo = dates("data_calculo").reverse()[0] || null;

  const today = new Date().toISOString().slice(0, 10);
  const status = resgateTotal && resgateTotal > today ? "Ativa" : (resgateTotal ? "Encerrada" : "Ativa");

  const { data: existing } = await supabase
    .from("controle_de_carteiras")
    .select("id")
    .eq("nome_carteira", "Investimentos")
    .eq("user_id", userId)
    .limit(1);

  const { data: firstCat } = await supabase.from("categorias").select("id").limit(1);
  const catId = firstCat?.[0]?.id;
  if (!catId) return;

  if (existing && existing.length > 0) {
    await supabase.from("controle_de_carteiras").update({
      data_inicio: dataInicio,
      data_limite: dataLimite,
      resgate_total: resgateTotal,
      data_calculo: dataCalculo,
      status,
    }).eq("id", existing[0].id);
  } else {
    await supabase.from("controle_de_carteiras").insert({
      categoria_id: catId,
      nome_carteira: "Investimentos",
      data_inicio: dataInicio,
      data_limite: dataLimite,
      resgate_total: resgateTotal,
      data_calculo: dataCalculo,
      status,
      user_id: userId,
    });
  }
}

/** Full sync: update custodia + controle_de_carteiras after a movimentacao change */
export async function fullSyncAfterMovimentacao(
  movimentacaoId: string | null,
  categoriaId: string,
  userId: string
) {
  if (movimentacaoId) {
    await syncCustodiaFromMovimentacao(movimentacaoId);
  }
  await syncControleCarteiras(categoriaId, userId);
}

/** Full sync after deleting a movimentacao */
export async function fullSyncAfterDelete(
  codigoCustodia: number | null,
  categoriaId: string,
  userId: string
) {
  if (codigoCustodia) {
    await syncCustodiaOnDelete(codigoCustodia, userId);
  }
  await syncControleCarteiras(categoriaId, userId);
}

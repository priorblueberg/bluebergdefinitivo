import { supabase } from "@/integrations/supabase/client";
import { fullSyncAfterMovimentacao } from "@/lib/syncEngine";
import { calcularRendaFixaDiario } from "@/lib/rendaFixaEngine";
import { calcularPoupancaDiario, buildPoupancaLotesFromMovs } from "@/lib/poupancaEngine";
import * as XLSX from "xlsx";

// ── Types ──

interface RefData {
  categorias: { id: string; nome: string }[];
  produtos: { id: string; nome: string; categoria_id: string }[];
  instituicoes: { id: string; nome: string }[];
  emissores: { id: string; nome: string }[];
}

export interface ImportRow {
  linha: number;
  categoria: string;
  tipo_movimentacao: string;
  data: string;
  produto: string;
  valor: number;
  preco_unitario: number | null;
  instituicao: string;
  emissor: string;
  modalidade: string;
  indexador: string;
  taxa: number | null;
  pagamento: string;
  vencimento: string;
  codigo_custodia: number | null;
  fechar_posicao: string;
}

export interface ImportResult {
  linha: number;
  status: "sucesso" | "erro";
  mensagem: string;
}

// ── Helpers (same as CadastrarTransacaoPage) ──

function sigla(nome: string): string {
  return nome.replace(/\s*\(.*\)$/, "").trim();
}

function buildNomeAtivo(
  produtoNome: string,
  emissorNome: string,
  modalidade: string,
  taxa: number,
  vencimento: string,
  indexador: string,
): string {
  const prod = sigla(produtoNome);
  const taxaFormatted = taxa ? `${String(taxa).replace(".", ",")}%` : "";
  const vencFormatted = vencimento
    ? new Date(vencimento + "T00:00:00").toLocaleDateString("pt-BR")
    : "";

  if (modalidade === "Prefixado") {
    return [prod, emissorNome, modalidade, taxaFormatted ? `${taxaFormatted} a.a.` : "", vencFormatted ? `- ${vencFormatted}` : ""]
      .filter(Boolean).join(" ");
  }
  if (indexador === "IPCA") {
    return [prod, emissorNome, "IPCA", taxaFormatted ? `+ ${taxaFormatted} a.a.` : "", vencFormatted ? `- ${vencFormatted}` : ""]
      .filter(Boolean).join(" ");
  }
  if (indexador === "CDI") {
    return [prod, emissorNome, modalidade, taxaFormatted, "do CDI", vencFormatted ? `- ${vencFormatted}` : ""]
      .filter(Boolean).join(" ");
  }
  return [prod, emissorNome, modalidade, indexador, taxaFormatted, vencFormatted ? `- ${vencFormatted}` : ""]
    .filter(Boolean).join(" ");
}

// ── Excel template generation ──

export function generateTemplate(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // Transacoes sheet
  const headers = [
    "categoria", "tipo_movimentacao", "data", "produto", "valor",
    "preco_unitario", "instituicao", "emissor", "modalidade", "indexador",
    "taxa", "pagamento", "vencimento", "codigo_custodia", "fechar_posicao",
  ];
  const wsData = [headers];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  // Set column widths
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 4, 16) }));
  XLSX.utils.book_append_sheet(wb, ws, "Transacoes");

  // Instrucoes sheet
  const instrucoes = [
    ["Campo", "Descrição", "Obrigatório"],
    ["categoria", "Nome da categoria: Renda Fixa ou Moedas", "Sim"],
    ["tipo_movimentacao", "Aplicação ou Resgate", "Sim"],
    ["data", "Data da transação no formato AAAA-MM-DD", "Sim"],
    ["produto", "Nome do produto (ex: CDB, LCI, Poupança, Dólar, Euro)", "Sim (Aplicação)"],
    ["valor", "Valor monetário da operação", "Sim"],
    ["preco_unitario", "PU para Renda Fixa normal. Ignorado para Poupança e Moedas", "Sim (RF normal)"],
    ["instituicao", "Nome da instituição financeira", "Sim (Aplicação)"],
    ["emissor", "Nome do emissor do título", "Sim (RF normal)"],
    ["modalidade", "Prefixado ou Pós Fixado", "Sim (RF normal)"],
    ["indexador", "CDI, CDI+ ou IPCA (obrigatório se Pós Fixado)", "Condicional"],
    ["taxa", "Taxa percentual (ex: 12.5)", "Sim (RF normal)"],
    ["pagamento", "Mensal, Semestral, No Vencimento, etc.", "Sim (RF normal)"],
    ["vencimento", "Data de vencimento no formato AAAA-MM-DD", "Sim (RF normal)"],
    ["codigo_custodia", "Código da custódia existente (obrigatório para Resgate)", "Sim (Resgate)"],
    ["fechar_posicao", "SIM ou NÃO. Marca resgate total", "Não"],
    [],
    ["REGRAS ESPECIAIS"],
    ["Poupança", "Preencher apenas: categoria=Renda Fixa, produto=Poupança, data, valor, instituicao"],
    ["Moedas", "Preencher: categoria=Moedas, produto=Dólar ou Euro, data, valor, instituicao. PU é buscado automaticamente pela cotação do dia."],
    ["Resgate", "Preencher: categoria, tipo_movimentacao=Resgate, data, valor, codigo_custodia. Os dados do ativo são copiados da custódia."],
    ["Pós Fixado CDI+", "Será gravado como modalidade=Mista, indexador=CDI"],
    ["Aplicação Inicial", "Se o nome do ativo não existir, a primeira linha será automaticamente marcada como Aplicação Inicial"],
  ];
  const wsInstr = XLSX.utils.aoa_to_sheet(instrucoes);
  wsInstr["!cols"] = [{ wch: 20 }, { wch: 80 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsInstr, "Instrucoes");

  // Listas sheet
  const listas = [
    ["Categorias", "Tipos", "Modalidades", "Indexadores", "Pagamentos"],
    ["Renda Fixa", "Aplicação", "Prefixado", "CDI", "Mensal"],
    ["Moedas", "Resgate", "Pós Fixado", "CDI+", "Bimestral"],
    ["", "", "", "IPCA", "Trimestral"],
    ["", "", "", "", "Quatrimestral"],
    ["", "", "", "", "Semestral"],
    ["", "", "", "", "No Vencimento"],
  ];
  const wsListas = XLSX.utils.aoa_to_sheet(listas);
  wsListas["!cols"] = [{ wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsListas, "Listas");

  return wb;
}

// ── Parse uploaded Excel ──

export function parseExcel(file: ArrayBuffer): ImportRow[] {
  const wb = XLSX.read(file, { type: "array" });
  const ws = wb.Sheets["Transacoes"];
  if (!ws) throw new Error("Aba 'Transacoes' não encontrada no arquivo.");

  const raw: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
  return raw.map((r, i) => {
    // Handle Excel date serial numbers
    let dataStr = String(r.data || "").trim();
    if (/^\d{5}$/.test(dataStr)) {
      // Excel serial date
      const d = XLSX.SSF.parse_date_code(parseInt(dataStr));
      dataStr = `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    }

    let vencStr = String(r.vencimento || "").trim();
    if (/^\d{5}$/.test(vencStr)) {
      const d = XLSX.SSF.parse_date_code(parseInt(vencStr));
      vencStr = `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    }

    return {
      linha: i + 2, // header is row 1
      categoria: String(r.categoria || "").trim(),
      tipo_movimentacao: String(r.tipo_movimentacao || "").trim(),
      data: dataStr,
      produto: String(r.produto || "").trim(),
      valor: parseFloat(String(r.valor || "0").replace(",", ".")) || 0,
      preco_unitario: r.preco_unitario ? parseFloat(String(r.preco_unitario).replace(",", ".")) || null : null,
      instituicao: String(r.instituicao || "").trim(),
      emissor: String(r.emissor || "").trim(),
      modalidade: String(r.modalidade || "").trim(),
      indexador: String(r.indexador || "").trim(),
      taxa: r.taxa ? parseFloat(String(r.taxa).replace(",", ".")) || null : null,
      pagamento: String(r.pagamento || "").trim(),
      vencimento: vencStr,
      codigo_custodia: r.codigo_custodia ? parseInt(String(r.codigo_custodia)) || null : null,
      fechar_posicao: String(r.fechar_posicao || "").trim().toUpperCase(),
    };
  });
}

// ── Load reference data ──

async function loadRefData(): Promise<RefData> {
  const [catRes, prodRes, instRes, emRes] = await Promise.all([
    supabase.from("categorias").select("id, nome").eq("ativa", true),
    supabase.from("produtos").select("id, nome, categoria_id").eq("ativo", true),
    supabase.from("instituicoes").select("id, nome").eq("ativa", true),
    supabase.from("emissores").select("id, nome").eq("ativo", true),
  ]);
  return {
    categorias: catRes.data || [],
    produtos: prodRes.data || [],
    instituicoes: instRes.data || [],
    emissores: emRes.data || [],
  };
}

function findByName<T extends { nome: string }>(list: T[], name: string): T | undefined {
  return list.find((item) => item.nome.toLowerCase() === name.toLowerCase());
}

// ── Compute saldo for resgate validation ──

async function computeSaldoDisponivel(
  custodia: any,
  dateISO: string,
  userId: string,
  categoriaName: string,
  produtoNome: string,
): Promise<number | null> {
  // Moedas
  if (categoriaName === "Moedas") {
    const { data: movs } = await supabase
      .from("movimentacoes")
      .select("tipo_movimentacao, quantidade")
      .eq("codigo_custodia", custodia.codigo_custodia)
      .eq("user_id", userId);
    let qty = 0;
    for (const m of movs || []) {
      if (["Aplicação Inicial", "Aplicação"].includes(m.tipo_movimentacao)) qty += Number(m.quantidade || 0);
      else if (["Resgate", "Resgate Total"].includes(m.tipo_movimentacao)) qty -= Number(m.quantidade || 0);
    }
    const table = produtoNome.toLowerCase().includes("euro") ? "historico_euro" : "historico_dolar";
    const { data: cotRow } = await supabase.from(table).select("cotacao_venda").eq("data", dateISO).maybeSingle();
    return cotRow && qty > 0 ? qty * Number(cotRow.cotacao_venda) : null;
  }

  // Poupança
  if (custodia.modalidade === "Poupança") {
    try {
      const [calRes, movRes, selicRes, trRes, poupRendRes] = await Promise.all([
        supabase.from("calendario_dias_uteis").select("data, dia_util").gte("data", custodia.data_inicio).lte("data", dateISO).order("data"),
        supabase.from("movimentacoes").select("data, tipo_movimentacao, valor").eq("codigo_custodia", custodia.codigo_custodia).eq("user_id", userId).order("data"),
        supabase.from("historico_selic").select("data, taxa_anual").gte("data", custodia.data_inicio).lte("data", dateISO).order("data"),
        supabase.from("historico_tr").select("data, taxa_mensal").gte("data", custodia.data_inicio).lte("data", dateISO).order("data"),
        supabase.from("historico_poupanca_rendimento").select("data, rendimento_mensal").gte("data", custodia.data_inicio).lte("data", dateISO).order("data"),
      ]);
      const movimentacoes = (movRes.data || []).map((m: any) => ({ data: m.data, tipo_movimentacao: m.tipo_movimentacao, valor: Number(m.valor) }));
      const lotes = buildPoupancaLotesFromMovs(movimentacoes);
      const rows = calcularPoupancaDiario({
        dataInicio: custodia.data_inicio,
        dataCalculo: dateISO,
        calendario: calRes.data || [],
        movimentacoes,
        lotes,
        selicRecords: (selicRes.data || []).map((r: any) => ({ data: r.data, taxa_anual: Number(r.taxa_anual) })),
        trRecords: (trRes.data || []).map((r: any) => ({ data: r.data, taxa_mensal: Number(r.taxa_mensal) })),
        poupancaRendimentoRecords: (poupRendRes.data || []).map((r: any) => ({ data: r.data, rendimento_mensal: Number(r.rendimento_mensal) })),
        dataResgateTotal: custodia.resgate_total,
      });
      const rowDia = rows.find((r) => r.data === dateISO);
      return rowDia ? rowDia.liquido : custodia.valor_investido;
    } catch {
      return custodia.valor_investido;
    }
  }

  // Renda Fixa engine
  const isEngine = ["Prefixado", "Pos Fixado", "Pós Fixado", "Mista"].includes(custodia.modalidade || "") && custodia.taxa && custodia.preco_unitario;
  if (isEngine) {
    try {
      const isPosFixadoCDI = (["Pos Fixado", "Pós Fixado"].includes(custodia.modalidade) && custodia.indexador === "CDI") || (custodia.modalidade === "Mista" && custodia.indexador === "CDI");
      const calQ = supabase.from("calendario_dias_uteis").select("data, dia_util").gte("data", custodia.data_inicio).lte("data", dateISO).order("data");
      const movQ = supabase.from("movimentacoes").select("data, tipo_movimentacao, valor").eq("codigo_custodia", custodia.codigo_custodia).eq("user_id", userId).order("data");
      const custQ = supabase.from("custodia").select("resgate_total").eq("codigo_custodia", custodia.codigo_custodia).eq("user_id", userId).maybeSingle();
      const cdiQ = isPosFixadoCDI
        ? supabase.from("historico_cdi").select("data, taxa_anual").gte("data", custodia.data_inicio).lte("data", dateISO).order("data")
        : null;
      const results = await Promise.all([calQ, movQ, custQ, ...(cdiQ ? [cdiQ] : [])]);
      const qResults = results as any[];
      const calendario = qResults[0].data || [];
      const movimentacoes = (qResults[1].data || []).map((m: any) => ({ data: m.data, tipo_movimentacao: m.tipo_movimentacao, valor: Number(m.valor) }));
      const cdiRecords = isPosFixadoCDI && qResults[3] ? (qResults[3].data || []).map((r: any) => ({ data: r.data, taxa_anual: Number(r.taxa_anual) })) : undefined;
      const rows = calcularRendaFixaDiario({
        dataInicio: custodia.data_inicio,
        dataCalculo: dateISO,
        taxa: custodia.taxa,
        modalidade: custodia.modalidade,
        puInicial: custodia.preco_unitario,
        calendario,
        movimentacoes,
        dataResgateTotal: results[2].data?.resgate_total ?? null,
        pagamento: custodia.pagamento,
        vencimento: custodia.vencimento,
        indexador: custodia.indexador,
        cdiRecords,
      });
      const rowDia = rows.find((r) => r.data === dateISO);
      return rowDia ? rowDia.liquido : null;
    } catch {
      return null;
    }
  }

  return custodia.valor_investido;
}

// ── Main import function ──

export async function importTransactions(
  rows: ImportRow[],
  userId: string,
  dataReferenciaISO: string,
  onProgress?: (done: number, total: number) => void,
): Promise<ImportResult[]> {
  const ref = await loadRefData();
  const results: ImportResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    onProgress?.(i, rows.length);

    try {
      const result = await processRow(row, userId, dataReferenciaISO, ref);
      results.push(result);
    } catch (err: any) {
      results.push({ linha: row.linha, status: "erro", mensagem: err.message || "Erro desconhecido" });
    }
  }
  onProgress?.(rows.length, rows.length);
  return results;
}

async function processRow(
  row: ImportRow,
  userId: string,
  dataReferenciaISO: string,
  ref: RefData,
): Promise<ImportResult> {
  // ── Basic validations ──
  if (!row.categoria) return { linha: row.linha, status: "erro", mensagem: "Campo 'categoria' é obrigatório." };
  if (!row.tipo_movimentacao) return { linha: row.linha, status: "erro", mensagem: "Campo 'tipo_movimentacao' é obrigatório." };
  if (!["Aplicação", "Resgate"].includes(row.tipo_movimentacao)) return { linha: row.linha, status: "erro", mensagem: "tipo_movimentacao deve ser 'Aplicação' ou 'Resgate'." };
  if (!row.data || !/^\d{4}-\d{2}-\d{2}$/.test(row.data)) return { linha: row.linha, status: "erro", mensagem: "Campo 'data' inválido. Use formato AAAA-MM-DD." };
  if (row.valor <= 0) return { linha: row.linha, status: "erro", mensagem: "Campo 'valor' deve ser maior que zero." };

  const catRef = findByName(ref.categorias, row.categoria);
  if (!catRef) return { linha: row.linha, status: "erro", mensagem: `Categoria '${row.categoria}' não encontrada.` };

  const isResgate = row.tipo_movimentacao === "Resgate";
  const isMoedas = catRef.nome === "Moedas";
  const isRendaFixa = catRef.nome === "Renda Fixa";

  // ── RESGATE ──
  if (isResgate) {
    if (!row.codigo_custodia) return { linha: row.linha, status: "erro", mensagem: "Campo 'codigo_custodia' é obrigatório para Resgate." };

    const { data: custodiaRow } = await supabase
      .from("custodia")
      .select("*")
      .eq("codigo_custodia", row.codigo_custodia)
      .eq("user_id", userId)
      .maybeSingle();

    if (!custodiaRow) return { linha: row.linha, status: "erro", mensagem: `Custódia com codigo_custodia=${row.codigo_custodia} não encontrada.` };

    // Validate business day for non-Poupança, non-Moedas
    const custCatName = ref.categorias.find((c) => c.id === custodiaRow.categoria_id)?.nome || "";
    const isPoup = custodiaRow.modalidade === "Poupança";
    const isMoedasCust = custCatName === "Moedas";
    if (!isPoup && !isMoedasCust) {
      const { data: diaUtil } = await supabase.from("calendario_dias_uteis").select("dia_util").eq("data", row.data).maybeSingle();
      if (!diaUtil || !diaUtil.dia_util) return { linha: row.linha, status: "erro", mensagem: "A data não é um dia útil." };
    }

    // Compute saldo
    const prodNome = ref.produtos.find((p) => p.id === custodiaRow.produto_id)?.nome || "";
    const saldo = await computeSaldoDisponivel(custodiaRow, row.data, userId, custCatName, prodNome);
    if (saldo !== null && row.valor > saldo + 0.01) {
      return { linha: row.linha, status: "erro", mensagem: `Valor R$ ${row.valor.toFixed(2)} excede saldo disponível R$ ${saldo.toFixed(2)}.` };
    }

    const fechar = row.fechar_posicao === "SIM";
    const tipoFinal = fechar ? "Resgate Total" : "Resgate";

    // For Moedas, recalc PU/qty
    let resgatePU: number | null = null;
    let resgateQty: number | null = null;
    if (isMoedasCust) {
      const table = prodNome.toLowerCase().includes("euro") ? "historico_euro" : "historico_dolar";
      const { data: cotRow } = await supabase.from(table).select("cotacao_venda").eq("data", row.data).maybeSingle();
      if (cotRow) {
        resgatePU = Number(cotRow.cotacao_venda);
        resgateQty = row.valor / resgatePU;
      }
    }

    const fmtBR = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const { data: inserted, error } = await supabase.from("movimentacoes").insert({
      categoria_id: custodiaRow.categoria_id,
      tipo_movimentacao: tipoFinal,
      data: row.data,
      produto_id: custodiaRow.produto_id,
      valor: row.valor,
      preco_unitario: isMoedasCust ? resgatePU : null,
      instituicao_id: custodiaRow.instituicao_id,
      emissor_id: custodiaRow.emissor_id,
      modalidade: custodiaRow.modalidade,
      taxa: custodiaRow.taxa,
      pagamento: custodiaRow.pagamento,
      vencimento: custodiaRow.vencimento,
      nome_ativo: custodiaRow.nome,
      codigo_custodia: custodiaRow.codigo_custodia,
      indexador: custodiaRow.indexador,
      quantidade: isMoedasCust ? resgateQty : null,
      valor_extrato: `R$ ${fmtBR(row.valor)}`,
      user_id: userId,
      origem: "importacao_lote",
    }).select("id").single();

    if (error) throw error;
    await fullSyncAfterMovimentacao(inserted.id, custodiaRow.categoria_id, userId, dataReferenciaISO);
    return { linha: row.linha, status: "sucesso", mensagem: `${tipoFinal} registrado.` };
  }

  // ── APLICAÇÃO ──
  if (!row.produto) return { linha: row.linha, status: "erro", mensagem: "Campo 'produto' é obrigatório para Aplicação." };
  if (!row.instituicao) return { linha: row.linha, status: "erro", mensagem: "Campo 'instituicao' é obrigatório para Aplicação." };

  const prodRef = ref.produtos.find((p) => p.nome.toLowerCase() === row.produto.toLowerCase() && p.categoria_id === catRef.id);
  if (!prodRef) return { linha: row.linha, status: "erro", mensagem: `Produto '${row.produto}' não encontrado na categoria '${row.categoria}'.` };

  const instRef = findByName(ref.instituicoes, row.instituicao);
  if (!instRef) return { linha: row.linha, status: "erro", mensagem: `Instituição '${row.instituicao}' não encontrada.` };

  const isPoupanca = prodRef.nome === "Poupança";
  const isMoeda = ["Dólar", "Euro"].includes(prodRef.nome);

  // ── Poupança ──
  if (isPoupanca) {
    const nomeAtivo = `Poupança ${instRef.nome}`.trim();
    const { codigoCustodia, tipoFinal } = await resolveCodigoCustodia(nomeAtivo, userId);
    const fmtBR = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const { data: inserted, error } = await supabase.from("movimentacoes").insert({
      categoria_id: catRef.id,
      tipo_movimentacao: tipoFinal,
      data: row.data,
      produto_id: prodRef.id,
      valor: row.valor,
      preco_unitario: null,
      instituicao_id: instRef.id,
      emissor_id: null,
      modalidade: "Poupança",
      taxa: null,
      pagamento: "Mensal",
      vencimento: null,
      nome_ativo: nomeAtivo,
      codigo_custodia: codigoCustodia,
      indexador: null,
      quantidade: null,
      valor_extrato: `R$ ${fmtBR(row.valor)}`,
      user_id: userId,
      origem: "importacao_lote",
    }).select("id").single();

    if (error) throw error;
    await fullSyncAfterMovimentacao(inserted.id, catRef.id, userId, dataReferenciaISO);
    return { linha: row.linha, status: "sucesso", mensagem: `${tipoFinal} Poupança registrado.` };
  }

  // ── Moedas (Dólar/Euro) ──
  if (isMoedas && isMoeda) {
    // Validate: no business day check needed for moedas
    const table = prodRef.nome.toLowerCase().includes("euro") ? "historico_euro" : "historico_dolar";
    const { data: cotRow } = await supabase.from(table).select("cotacao_venda").eq("data", row.data).maybeSingle();
    if (!cotRow) return { linha: row.linha, status: "erro", mensagem: `Cotação de ${prodRef.nome} não encontrada para ${row.data}.` };

    const cotacao = Number(cotRow.cotacao_venda);
    const quantidade = row.valor / cotacao;
    const nomeAtivo = `${prodRef.nome} ${instRef.nome}`.trim();
    const { codigoCustodia, tipoFinal } = await resolveCodigoCustodia(nomeAtivo, userId);
    const fmtBR = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const { data: inserted, error } = await supabase.from("movimentacoes").insert({
      categoria_id: catRef.id,
      tipo_movimentacao: tipoFinal,
      data: row.data,
      produto_id: prodRef.id,
      valor: row.valor,
      preco_unitario: cotacao,
      instituicao_id: instRef.id,
      emissor_id: null,
      modalidade: null,
      taxa: null,
      pagamento: null,
      vencimento: null,
      nome_ativo: nomeAtivo,
      codigo_custodia: codigoCustodia,
      indexador: null,
      quantidade,
      valor_extrato: `R$ ${fmtBR(row.valor)} (R$ ${fmtBR(cotacao)} x ${fmtBR(quantidade)})`,
      user_id: userId,
      origem: "importacao_lote",
    }).select("id").single();

    if (error) throw error;
    await fullSyncAfterMovimentacao(inserted.id, catRef.id, userId, dataReferenciaISO);
    return { linha: row.linha, status: "sucesso", mensagem: `${tipoFinal} ${prodRef.nome} registrado.` };
  }

  // ── Renda Fixa normal ──
  if (!isRendaFixa) return { linha: row.linha, status: "erro", mensagem: `Categoria '${row.categoria}' não suportada para aplicação direta.` };

  // Validate required RF fields
  if (!row.emissor) return { linha: row.linha, status: "erro", mensagem: "Campo 'emissor' é obrigatório para Renda Fixa." };
  if (!row.modalidade) return { linha: row.linha, status: "erro", mensagem: "Campo 'modalidade' é obrigatório para Renda Fixa." };
  if (row.taxa == null) return { linha: row.linha, status: "erro", mensagem: "Campo 'taxa' é obrigatório para Renda Fixa." };
  if (!row.pagamento) return { linha: row.linha, status: "erro", mensagem: "Campo 'pagamento' é obrigatório para Renda Fixa." };
  if (!row.vencimento) return { linha: row.linha, status: "erro", mensagem: "Campo 'vencimento' é obrigatório para Renda Fixa." };
  if (row.preco_unitario == null) return { linha: row.linha, status: "erro", mensagem: "Campo 'preco_unitario' é obrigatório para Renda Fixa." };

  if (row.modalidade === "Pós Fixado" && !row.indexador) {
    return { linha: row.linha, status: "erro", mensagem: "Campo 'indexador' é obrigatório para modalidade Pós Fixado." };
  }

  const emRef = findByName(ref.emissores, row.emissor);
  if (!emRef) return { linha: row.linha, status: "erro", mensagem: `Emissor '${row.emissor}' não encontrado.` };

  // Validate business day
  const { data: diaUtil } = await supabase.from("calendario_dias_uteis").select("dia_util").eq("data", row.data).maybeSingle();
  if (!diaUtil || !diaUtil.dia_util) return { linha: row.linha, status: "erro", mensagem: "A data não é um dia útil." };

  // Map Pós Fixado + CDI+ → Mista + CDI
  let modalidadeToSave = row.modalidade;
  let indexadorToSave = row.modalidade === "Pós Fixado" ? row.indexador : null;
  if (row.modalidade === "Pós Fixado" && row.indexador === "CDI+") {
    modalidadeToSave = "Mista";
    indexadorToSave = "CDI";
  }

  const quantidade = row.preco_unitario > 0 ? row.valor / row.preco_unitario : null;
  const nomeAtivo = buildNomeAtivo(prodRef.nome, emRef.nome, modalidadeToSave, row.taxa, row.vencimento, indexadorToSave || "");
  const { codigoCustodia, tipoFinal } = await resolveCodigoCustodia(nomeAtivo, userId);

  const fmtBR = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const valorExtrato = quantidade != null
    ? `R$ ${fmtBR(row.valor)} (R$ ${fmtBR(row.preco_unitario)} x ${fmtBR(quantidade)})`
    : `R$ ${fmtBR(row.valor)}`;

  const { data: inserted, error } = await supabase.from("movimentacoes").insert({
    categoria_id: catRef.id,
    tipo_movimentacao: tipoFinal,
    data: row.data,
    produto_id: prodRef.id,
    valor: row.valor,
    preco_unitario: row.preco_unitario,
    instituicao_id: instRef.id,
    emissor_id: emRef.id,
    modalidade: modalidadeToSave,
    taxa: row.taxa,
    pagamento: row.pagamento,
    vencimento: row.vencimento,
    nome_ativo: nomeAtivo,
    codigo_custodia: codigoCustodia,
    indexador: indexadorToSave,
    quantidade,
    valor_extrato: valorExtrato,
    user_id: userId,
    origem: "importacao_lote",
  }).select("id").single();

  if (error) throw error;
  await fullSyncAfterMovimentacao(inserted.id, catRef.id, userId, dataReferenciaISO);
  return { linha: row.linha, status: "sucesso", mensagem: `${tipoFinal} registrado.` };
}

// ── Resolve codigo_custodia (same logic as CadastrarTransacaoPage) ──

async function resolveCodigoCustodia(nomeAtivo: string, userId: string): Promise<{ codigoCustodia: number; tipoFinal: string }> {
  const { data: existing } = await supabase
    .from("movimentacoes")
    .select("codigo_custodia")
    .eq("nome_ativo", nomeAtivo)
    .not("codigo_custodia", "is", null)
    .limit(1);

  if (existing && existing.length > 0) {
    return { codigoCustodia: existing[0].codigo_custodia!, tipoFinal: "Aplicação" };
  }

  const { data: maxRow } = await supabase
    .from("movimentacoes")
    .select("codigo_custodia")
    .not("codigo_custodia", "is", null)
    .order("codigo_custodia", { ascending: false })
    .limit(1);

  const maxCodigo = maxRow && maxRow.length > 0 ? (maxRow[0].codigo_custodia ?? 99) : 99;
  return { codigoCustodia: maxCodigo + 1, tipoFinal: "Aplicação Inicial" };
}

// ── Generate return Excel ──

export function generateReturnExcel(rows: ImportRow[], results: ImportResult[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const resultMap = new Map(results.map((r) => [r.linha, r]));

  const data = rows.map((r) => ({
    linha: r.linha,
    categoria: r.categoria,
    tipo_movimentacao: r.tipo_movimentacao,
    data: r.data,
    produto: r.produto,
    valor: r.valor,
    preco_unitario: r.preco_unitario ?? "",
    instituicao: r.instituicao,
    emissor: r.emissor,
    modalidade: r.modalidade,
    indexador: r.indexador,
    taxa: r.taxa ?? "",
    pagamento: r.pagamento,
    vencimento: r.vencimento,
    codigo_custodia: r.codigo_custodia ?? "",
    fechar_posicao: r.fechar_posicao,
    resultado_status: resultMap.get(r.linha)?.status ?? "",
    resultado_mensagem: resultMap.get(r.linha)?.mensagem ?? "",
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, "Retorno");
  return wb;
}

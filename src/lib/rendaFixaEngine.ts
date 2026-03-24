/**
 * Engine de Cálculo Diário de Renda Fixa Prefixada
 * 
 * Baseado na planilha Excel "EngineRendaFixaPrefixada".
 * Utiliza sistema de "Cota Virtual" (Valor da Cota 1 e Cota 2).
 * 
 * Colunas calculadas (conforme Excel):
 * C: Valor da Cota (1) — após resgate
 * D: Saldo de Cotas (1) — após resgate
 * E: Líquido (1) — após resgate
 * F: Valor da Cota (2) — antes do resgate
 * G: Saldo de Cotas (2) — antes do resgate
 * H: Líquido (2) — antes do resgate
 * I: Aplicações
 * J: QTD Cotas (Compra)
 * K: Resgate
 * L: QTD Cotas (Resgate)
 * M: Rentabilidade diária (R$)
 * N: R$ Rentabilidade acumulada
 * O: % Rentabilidade acumulada
 * P: Multiplicador
 * Q: Pagamento de Juros (flag)
 * R: Apoio para o cupom automático
 * S: Cupom Acumulado
 * T: Juros Pago
 * U: Valor Investido
 * V: Resgate Limpo
 */

export interface DailyRow {
  data: string;
  diaUtil: boolean;
  // C-H: Cotas virtuais
  valorCota: number;        // C: Valor da Cota (1) — após resgate
  saldoCotas: number;       // D: Saldo de Cotas (1) — após resgate
  liquido: number;          // E: Líquido (1) — após resgate
  valorCota2: number;       // F: Valor da Cota (2) — antes do resgate
  saldoCotas2: number;      // G: Saldo de Cotas (2) — antes do resgate
  liquido2: number;         // H: Líquido (2) — antes do resgate
  // I-L: Movimentações
  aplicacoes: number;       // I
  qtdCotasCompra: number;   // J
  resgates: number;         // K: Total resgate (manual + juros + auto vencimento)
  qtdCotasResgate: number;  // L
  // M-O: Rentabilidade
  ganhoDiario: number;      // M: Rentabilidade diária em R$
  ganhoAcumulado: number;   // N: R$ Rentabilidade acumulada
  rentabilidadeAcumuladaPct: number; // O: % Rentabilidade acumulada
  // CDI Diário + P: Multiplicador
  cdiDiario: number;        // CDI Diário = ((1 + CDI_anual/100)^(1/252) - 1), 8 decimais
  multiplicador: number;    // P
  // Q-T: Juros / Cupom
  pagamentoJuros: number;   // T: Juros Pago (backward compat name = jurosPago)
  apoioCupom: number;       // R: Apoio para o cupom automático
  cupomAcumulado: number;   // S: Cupom Acumulado
  jurosPago: number;        // T: Juros Pago
  // U-V: Capital tracking
  valorInvestido: number;   // U: Valor Investido (cumulative apps - resgates manuais)
  resgateLimpo: number;     // V: Resgate Limpo (manual resgates only)
  // W-Z: Novas colunas PU
  precoUnitario: number;    // W: Preço Unitário (PU da custódia, atualizado pelo multiplicador)
  qtdAplicacaoPU: number;   // X: Quantidade Aplicação = Aplicações / Preço Unitário
  qtdResgatePU: number;     // Y: Quantidade de Resgate = Resgate Limpo / Preço Unitário
  qtdJurosPU: number;       // Z: QTD Juros = QTD Aplicação - QTD Resgate - QTD Juros anterior
  // Legacy (kept for consumers like AnaliseIndividualPage)
  rentabilidadeDiaria: number | null; // cota-based daily return %
}

export interface EngineInput {
  dataInicio: string;
  dataCalculo: string;
  taxa: number;
  modalidade: string;
  puInicial: number;
  calendario: { data: string; dia_util: boolean }[];
  movimentacoes: { data: string; tipo_movimentacao: string; valor: number }[];
  dataResgateTotal?: string | null;
  pagamento?: string | null;
  vencimento?: string | null;
  indexador?: string | null;
  cdiRecords?: { data: string; taxa_anual: number }[];
}

// ── Pagamento de Juros Periódico ──

const PERIODICIDADE_MESES: Record<string, number> = {
  Mensal: 1,
  Bimestral: 2,
  Trimestral: 3,
  Quadrimestral: 4,
  Semestral: 6,
};

export function gerarDatasPagamentoJuros(
  dataInicio: string,
  vencimento: string,
  pagamento: string,
  calendario: { data: string; dia_util: boolean }[],
  dataCalculo?: string
): Set<string> {
  const meses = PERIODICIDADE_MESES[pagamento];
  if (!meses) return new Set();

  const vencDate = new Date(vencimento + "T00:00:00");
  const diaBase = vencDate.getDate();

  const diasUteisSet = new Set<string>();
  const allDates: string[] = [];
  for (const c of calendario) {
    allDates.push(c.data);
    if (c.dia_util) diasUteisSet.add(c.data);
  }
  allDates.sort();

  function ajustarParaDiaUtil(targetDate: string): string | null {
    let lo = 0, hi = allDates.length - 1, pos = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (allDates[mid] <= targetDate) { pos = mid; lo = mid + 1; }
      else { hi = mid - 1; }
    }
    if (pos < 0) return null;
    for (let i = pos; i >= 0; i--) {
      if (diasUteisSet.has(allDates[i])) return allDates[i];
    }
    return null;
  }

  const result = new Set<string>();
  let cursor = new Date(vencDate);

  while (true) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    const targetDay = Math.min(diaBase, lastDayOfMonth);
    const targetStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;

    if (targetStr < dataInicio) break;

    if (dataCalculo && targetStr > dataCalculo) {
      cursor.setMonth(cursor.getMonth() - meses);
      continue;
    }

    const adjusted = ajustarParaDiaUtil(targetStr);
    if (adjusted && adjusted >= dataInicio) {
      result.add(adjusted);
    }

    cursor.setMonth(cursor.getMonth() - meses);
  }

  return result;
}

// ── Engine helpers ──

function getMultiplicador(modalidade: string, taxa: number): number {
  if (modalidade === "Prefixado") {
    return Math.pow(1 + taxa / 100, 1 / 252) - 1;
  }
  return 0;
}

/**
 * Build movimentação map excluding "Resgate no Vencimento" (handled natively by engine).
 */
function buildMovMap(movs: EngineInput["movimentacoes"]): Map<string, { aplicacoes: number; resgates: number }> {
  const map = new Map<string, { aplicacoes: number; resgates: number }>();
  for (const m of movs) {
    const entry = map.get(m.data) || { aplicacoes: 0, resgates: 0 };
    if (m.tipo_movimentacao === "Aplicação Inicial" || m.tipo_movimentacao === "Aplicação") {
      entry.aplicacoes += m.valor;
    } else if (["Resgate", "Resgate Parcial", "Resgate Total"].includes(m.tipo_movimentacao)) {
      entry.resgates += m.valor;
    }
    // "Resgate no Vencimento" is excluded — engine computes it natively
    map.set(m.data, entry);
  }
  return map;
}

function findDayBefore(dataInicio: string, calendario: EngineInput["calendario"]): string | null {
  const sorted = [...calendario].sort((a, b) => a.data.localeCompare(b.data));
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].data < dataInicio) return sorted[i].data;
  }
  return null;
}

// ── Main engine ──

export function calcularRendaFixaDiario(input: EngineInput): DailyRow[] {
  const { dataInicio, dataCalculo, taxa, modalidade, puInicial, calendario, movimentacoes, dataResgateTotal, pagamento, vencimento } = input;

  const cotaInicial = puInicial > 0 ? puInicial : 1000;
  const rawMultiplicador = getMultiplicador(modalidade, taxa);
  const movMap = buildMovMap(movimentacoes);

  const sorted = [...calendario].sort((a, b) => a.data.localeCompare(b.data));
  const endDate = dataCalculo || sorted[sorted.length - 1]?.data || dataInicio;

  // Effective end: the furthest date we need to compute
  const effectiveEnd = dataResgateTotal || vencimento || endDate;

  // Generate payment dates
  const datasPagamento = pagamento && pagamento !== "No Vencimento" && vencimento
    ? gerarDatasPagamentoJuros(dataInicio, vencimento, pagamento, calendario, effectiveEnd)
    : new Set<string>();

  const dayBefore = findDayBefore(dataInicio, calendario);
  const startIdx = dayBefore
    ? sorted.findIndex((d) => d.data === dayBefore)
    : sorted.findIndex((d) => d.data >= dataInicio);

  if (startIdx < 0) return [];

  const rows: DailyRow[] = [];

  let prevLiquido = 0;
  let prevSaldoCotas = 0;
  let prevValorCota = cotaInicial;
  let rentAcumRS = 0;
  let valorInvestidoAcum = 0;
  let cupomAcumuladoAcum = 0;
  let prevPrecoUnitario = puInicial > 0 ? puInicial : 1000;
  const puInicialCustodia = puInicial > 0 ? puInicial : 1000;

  for (let i = startIdx; i < sorted.length; i++) {
    const cal = sorted[i];
    // Stop after effective end date
    if (cal.data > effectiveEnd) break;
    // Also stop after endDate (calendar range limit)
    if (cal.data > endDate) break;

    const isInitialDay = dayBefore ? cal.data === dayBefore : false;

    if (isInitialDay) {
      rows.push(makeZeroRow(cal.data, cal.dia_util, cotaInicial));
      prevValorCota = cotaInicial;
      prevLiquido = 0;
      prevSaldoCotas = 0;
      rentAcumRS = 0;
      valorInvestidoAcum = 0;
      cupomAcumuladoAcum = 0;
      continue;
    }

    const isDataInicio = cal.data === dataInicio;
    const isVencimentoDay = !!vencimento && cal.data === vencimento;
    const isResgateTotalDay = !!dataResgateTotal && cal.data === dataResgateTotal;
    const isFinalDay = isVencimentoDay || isResgateTotalDay;

    const diaUtil = cal.dia_util;
    const dailyMult = diaUtil ? rawMultiplicador : 0;

    const mov = movMap.get(cal.data) || { aplicacoes: 0, resgates: 0 };
    const aplicacoes = mov.aplicacoes;
    const manualResgates = mov.resgates;

    // P: Multiplicador (always computed, but yield only on business days)
    const multiplicadorDia = dailyMult;

    // R: Apoio para o cupom automático
    let apoioCupom: number;
    if (isDataInicio) {
      apoioCupom = aplicacoes;
    } else {
      // On business days: prevLiquido * (1 + mult) + apps
      // On non-business days: prevLiquido (since mult=0, same formula works)
      apoioCupom = prevLiquido * (1 + dailyMult) + aplicacoes;
    }

    // U: Valor Investido (running cumulative of apps - manual resgates)
    valorInvestidoAcum += aplicacoes - manualResgates;
    const valorInvestido = valorInvestidoAcum;

    // V: Resgate Limpo
    let resgateLimpo: number;
    if (isFinalDay) {
      resgateLimpo = valorInvestido;
    } else {
      resgateLimpo = manualResgates;
    }

    // Q: Is this a payment date?
    const isPagamento = datasPagamento.has(cal.data);

    // T: Juros Pago
    let jurosPago: number;
    if (isFinalDay) {
      jurosPago = apoioCupom - valorInvestido;
    } else if (isPagamento) {
      jurosPago = apoioCupom - valorInvestido - resgateLimpo;
    } else {
      jurosPago = 0;
    }
    if (jurosPago < 0) jurosPago = 0;

    // K: Resgate total
    let resgatesTotal: number;
    if (isVencimentoDay) {
      // Auto resgate no vencimento: full patrimônio
      resgatesTotal = prevLiquido * (1 + rawMultiplicador);
    } else {
      resgatesTotal = resgateLimpo + jurosPago;
    }

    // E: Líquido (1)
    let liquido1: number;
    if (isDataInicio) {
      liquido1 = aplicacoes;
    } else if (isVencimentoDay) {
      // On vencimento: patrimônio after yield minus auto-resgate = 0
      liquido1 = prevLiquido * (1 + dailyMult) + aplicacoes - resgatesTotal;
    } else {
      liquido1 = prevLiquido * (1 + dailyMult) + aplicacoes - resgatesTotal;
    }
    // Force to 0 if negligible
    if (Math.abs(liquido1) < 0.01) liquido1 = 0;

    // J: QTD Cotas Compra
    const qtdCotasCompra = prevValorCota > 0 ? aplicacoes / prevValorCota : 0;

    // G: Saldo de Cotas (2)
    let saldoCotas2: number;
    if (isFinalDay) {
      saldoCotas2 = prevSaldoCotas; // carry previous on final day
    } else if (liquido1 === 0 && aplicacoes === 0) {
      saldoCotas2 = 0;
    } else {
      saldoCotas2 = prevSaldoCotas + qtdCotasCompra;
    }

    // H: Líquido (2)
    let liquido2: number;
    if (isFinalDay) {
      liquido2 = prevLiquido * (1 + rawMultiplicador);
    } else {
      liquido2 = liquido1 + resgatesTotal;
    }

    const isZeroLiquido = Math.abs(liquido2) < 0.01;

    // F: Valor da Cota (2)
    const valorCota2 = isZeroLiquido
      ? prevValorCota
      : (saldoCotas2 > 0 ? liquido2 / saldoCotas2 : prevValorCota);

    // L: QTD Cotas Resgate
    const qtdCotasResgate = resgatesTotal > 0 && valorCota2 > 0 ? resgatesTotal / valorCota2 : 0;

    // D: Saldo de Cotas (1)
    let saldoCotas1: number;
    if (isFinalDay) {
      saldoCotas1 = 0;
    } else {
      saldoCotas1 = saldoCotas2 - qtdCotasResgate;
    }

    // C: Valor da Cota (1)
    let valorCota1: number;
    if (!diaUtil && cal.data > dataInicio) {
      // Non-business day: carry previous
      valorCota1 = prevValorCota;
    } else if (cal.data <= dataInicio) {
      valorCota1 = cotaInicial;
    } else if (isZeroLiquido && aplicacoes === 0 && resgatesTotal === 0) {
      valorCota1 = prevValorCota;
    } else if (isFinalDay) {
      valorCota1 = saldoCotas2 > 0 ? resgatesTotal / saldoCotas2 : prevValorCota;
    } else {
      valorCota1 = saldoCotas1 > 0 ? liquido1 / saldoCotas1 : prevValorCota;
    }

    // M: Rentabilidade diária (R$)
    const ganhoDiario = isDataInicio ? 0 : (liquido1 - prevLiquido - aplicacoes + resgatesTotal);

    // N: R$ Rentabilidade acumulada
    rentAcumRS += ganhoDiario;

    // O: % Rentabilidade acumulada
    const rentabilidadeAcumuladaPct = cotaInicial > 0 ? (valorCota1 / cotaInicial) - 1 : 0;

    // Legacy: daily return % (cota-based)
    const rentDiaria = prevValorCota > 0 && cal.data > dataInicio
      ? valorCota1 / prevValorCota - 1
      : null;

    // S: Cupom Acumulado
    cupomAcumuladoAcum += jurosPago;

    // W: Preço Unitário
    let precoUnitario: number;
    if (isDataInicio) {
      precoUnitario = puInicialCustodia;
    } else if (!diaUtil) {
      precoUnitario = prevPrecoUnitario;
    } else {
      precoUnitario = prevPrecoUnitario * rawMultiplicador + prevPrecoUnitario;
    }

    // X: Quantidade Aplicação = Aplicações / Preço Unitário
    const qtdAplicacaoPU = precoUnitario > 0 && aplicacoes > 0 ? aplicacoes / precoUnitario : 0;

    // Y: Quantidade de Resgate = Resgate Limpo / Preço Unitário
    // No vencimento: Resgate Limpo / PU inicial da custódia
    const qtdResgatePU = isFinalDay
      ? (puInicialCustodia > 0 && resgateLimpo > 0.01 ? resgateLimpo / puInicialCustodia : 0)
      : (precoUnitario > 0 && resgateLimpo > 0.01 ? resgateLimpo / precoUnitario : 0);

    // Z: QTD Juros = QTD Aplicação - QTD Resgate + QTD Juros do dia anterior
    // No vencimento: repete QTD Juros do dia anterior
    const prevQtdJuros = rows.length > 0 ? rows[rows.length - 1].qtdJurosPU : 0;
    const qtdJurosPU = isFinalDay ? prevQtdJuros : (qtdAplicacaoPU - qtdResgatePU + prevQtdJuros);

    rows.push({
      data: cal.data,
      diaUtil,
      valorCota: valorCota1,
      saldoCotas: saldoCotas1,
      liquido: liquido1,
      valorCota2,
      saldoCotas2,
      liquido2,
      aplicacoes,
      qtdCotasCompra,
      resgates: resgatesTotal,
      qtdCotasResgate,
      ganhoDiario,
      ganhoAcumulado: rentAcumRS,
      rentabilidadeAcumuladaPct,
      multiplicador: multiplicadorDia,
      pagamentoJuros: jurosPago,
      apoioCupom,
      cupomAcumulado: cupomAcumuladoAcum,
      jurosPago,
      valorInvestido,
      resgateLimpo,
      precoUnitario,
      qtdAplicacaoPU,
      qtdResgatePU,
      qtdJurosPU,
      rentabilidadeDiaria: rentDiaria,
    });

    prevLiquido = liquido1;
    prevSaldoCotas = saldoCotas1;
    prevValorCota = valorCota1;
    prevPrecoUnitario = precoUnitario;
  }

  return rows;
}

function makeZeroRow(data: string, diaUtil: boolean, cotaInicial: number): DailyRow {
  return {
    data,
    diaUtil,
    valorCota: cotaInicial,
    saldoCotas: 0,
    liquido: 0,
    valorCota2: cotaInicial,
    saldoCotas2: 0,
    liquido2: 0,
    aplicacoes: 0,
    qtdCotasCompra: 0,
    resgates: 0,
    qtdCotasResgate: 0,
    ganhoDiario: 0,
    ganhoAcumulado: 0,
    rentabilidadeAcumuladaPct: 0,
    multiplicador: 0,
    pagamentoJuros: 0,
    apoioCupom: 0,
    cupomAcumulado: 0,
    jurosPago: 0,
    valorInvestido: 0,
    resgateLimpo: 0,
    precoUnitario: cotaInicial,
    qtdAplicacaoPU: 0,
    qtdResgatePU: 0,
    qtdJurosPU: 0,
    rentabilidadeDiaria: null,
  };
}

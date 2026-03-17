/**
 * Engine de Cálculo Diário de Renda Fixa Prefixada
 * 
 * Baseado em "Cota Virtual" (Valor da Cota 1).
 * Premissas:
 * - Cota inicial = R$ 1.000,00 no dia anterior à Aplicação Inicial
 * - Multiplicador Prefixado = (1 + taxa)^(1/252) - 1
 * - Líquido = Líquido anterior * (1 + multiplicador) + Aplicações - Resgates
 *   (em dias não úteis, não aplica multiplicador)
 * - QTD Cotas Compra = Aplicação / Valor da Cota
 * - Saldo Cotas = Saldo anterior + Cotas Compra
 * - Valor da Cota = Líquido / Saldo Cotas
 * - Rentabilidade Diária = Cota hoje / Cota ontem - 1
 */

export interface DailyRow {
  data: string;
  diaUtil: boolean;
  valorCota: number;
  saldoCotas: number;
  liquido: number;
  aplicacoes: number;
  qtdCotasCompra: number;
  resgates: number;
  rentabilidadeDiaria: number | null;
  multiplicador: number;
}

export interface EngineInput {
  dataInicio: string;          // data_inicio from custodia
  dataCalculo: string;         // last date to calculate
  taxa: number;                // annual rate (e.g. 0.1350 for 13.50%)
  modalidade: string;          // "Prefixado", etc.
  puInicial: number;           // preco_unitario from custodia (initial quota value)
  calendario: { data: string; dia_util: boolean }[];
  movimentacoes: { data: string; tipo_movimentacao: string; valor: number }[];
}

/**
 * Compute daily multiplicador based on modalidade
 */
function getMultiplicador(modalidade: string, taxa: number): number {
  if (modalidade === "Prefixado") {
    // (1 + taxa)^(1/252) - 1
    return Math.pow(1 + taxa, 1 / 252) - 1;
  }
  // Other modalidades can be added here
  return 0;
}

/**
 * Build a map date -> { aplicacoes, resgates } from movimentacoes
 */
function buildMovMap(movs: EngineInput["movimentacoes"]): Map<string, { aplicacoes: number; resgates: number }> {
  const map = new Map<string, { aplicacoes: number; resgates: number }>();
  for (const m of movs) {
    const entry = map.get(m.data) || { aplicacoes: 0, resgates: 0 };
    if (m.tipo_movimentacao === "Aplicação Inicial" || m.tipo_movimentacao === "Aplicação") {
      entry.aplicacoes += m.valor;
    } else if (m.tipo_movimentacao === "Resgate") {
      entry.resgates += m.valor;
    }
    map.set(m.data, entry);
  }
  return map;
}

/**
 * Find the day before dataInicio in the calendario (could be non-business day)
 */
function findDayBefore(dataInicio: string, calendario: EngineInput["calendario"]): string | null {
  // Sort calendario ascending
  const sorted = [...calendario].sort((a, b) => a.data.localeCompare(b.data));
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].data < dataInicio) {
      return sorted[i].data;
    }
  }
  return null;
}

export function calcularRendaFixaDiario(input: EngineInput): DailyRow[] {
  const { dataInicio, dataCalculo, taxa, modalidade, calendario, movimentacoes } = input;

  const multiplicador = getMultiplicador(modalidade, taxa);
  const movMap = buildMovMap(movimentacoes);

  // Sort calendario ascending and filter relevant range
  const sorted = [...calendario].sort((a, b) => a.data.localeCompare(b.data));

  // Find day before dataInicio for the initial quota
  const dayBefore = findDayBefore(dataInicio, calendario);

  // Build date range: from dayBefore (or dataInicio) to dataCalculo
  const startIdx = dayBefore
    ? sorted.findIndex((d) => d.data === dayBefore)
    : sorted.findIndex((d) => d.data >= dataInicio);

  if (startIdx < 0) return [];

  const endDate = dataCalculo || sorted[sorted.length - 1].data;
  const rows: DailyRow[] = [];

  let prevLiquido = 0;
  let prevSaldoCotas = 0;
  let prevValorCota = cotaInicial;

  for (let i = startIdx; i < sorted.length; i++) {
    const cal = sorted[i];
    if (cal.data > endDate) break;

    const isInitialDay = dayBefore ? cal.data === dayBefore : false;
    const mov = movMap.get(cal.data) || { aplicacoes: 0, resgates: 0 };

    if (isInitialDay) {
      // Day before: set initial quota, no movements counted yet
      rows.push({
        data: cal.data,
        diaUtil: cal.dia_util,
        valorCota: 1000,
        saldoCotas: 0,
        liquido: 0,
        aplicacoes: 0,
        qtdCotasCompra: 0,
        resgates: 0,
        rentabilidadeDiaria: null,
        multiplicador: 0,
      });
      prevValorCota = 1000;
      prevLiquido = 0;
      prevSaldoCotas = 0;
      continue;
    }

    // Daily multiplicador: only on business days
    const dailyMult = cal.dia_util ? multiplicador : 0;

    // Líquido = prev * (1 + mult) + aplicações - resgates
    const liquido = prevLiquido * (1 + dailyMult) + mov.aplicacoes - mov.resgates;

    // QTD Cotas Compra = aplicações / valor cota anterior
    const qtdCotasCompra = prevValorCota > 0 ? mov.aplicacoes / prevValorCota : 0;

    // Saldo Cotas
    const saldoCotas = prevSaldoCotas + qtdCotasCompra;

    // Valor da Cota = Líquido / Saldo Cotas
    const valorCota = saldoCotas > 0 ? liquido / saldoCotas : prevValorCota;

    // Rentabilidade diária = cota hoje / cota ontem - 1
    const rentDiaria = prevValorCota > 0 ? valorCota / prevValorCota - 1 : null;

    rows.push({
      data: cal.data,
      diaUtil: cal.dia_util,
      valorCota,
      saldoCotas,
      liquido,
      aplicacoes: mov.aplicacoes,
      qtdCotasCompra,
      resgates: mov.resgates,
      rentabilidadeDiaria: rentDiaria,
      multiplicador: dailyMult,
    });

    prevLiquido = liquido;
    prevSaldoCotas = saldoCotas;
    prevValorCota = valorCota;
  }

  return rows;
}

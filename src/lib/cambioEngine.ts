/**
 * Engine de cálculo para ativos de Câmbio (Dólar).
 *
 * Calcula valuation diário, rentabilidade diária e acumulada com base na
 * cotação PTAX Venda de fechamento.
 */

export interface CambioDailyRow {
  data: string;
  diaUtil: boolean;
  cotacao: number;           // cotação do dólar no dia
  quantidadeUSD: number;     // quantidade acumulada em USD
  valorBRL: number;          // qty × cotação (valor atualizado)
  aplicacoesBRL: number;     // aplicações no dia em BRL
  resgatesBRL: number;       // resgates no dia em BRL
  ganhoDiarioBRL: number;    // ganho diário em BRL
  rentDiariaPct: number;     // rentabilidade diária %
  rentAcumuladaPct: number;  // rentabilidade acumulada %
  rentAcumuladaBRL: number;  // ganho acumulado em BRL
}

export interface CambioEngineInput {
  dataInicio: string;
  dataCalculo: string;
  cotacaoInicial: number;            // cotação do dia da primeira aplicação
  calendario: { data: string; dia_util: boolean }[];
  movimentacoes: { data: string; tipo_movimentacao: string; valor: number; preco_unitario: number | null; quantidade: number | null }[];
  historicoDolar: { data: string; cotacao_venda: number }[];
  dataResgateTotal?: string | null;
}

export function calcularCambioDiario(input: CambioEngineInput): CambioDailyRow[] {
  const { dataInicio, dataCalculo, calendario, movimentacoes, historicoDolar, dataResgateTotal } = input;

  // Build maps
  const cotacaoMap = new Map<string, number>();
  for (const r of historicoDolar) {
    cotacaoMap.set(r.data, r.cotacao_venda);
  }

  const movMap = new Map<string, { aplicacoesBRL: number; resgatesBRL: number; aplicacoesUSD: number; resgatesUSD: number }>();
  for (const m of movimentacoes) {
    const existing = movMap.get(m.data) || { aplicacoesBRL: 0, resgatesBRL: 0, aplicacoesUSD: 0, resgatesUSD: 0 };
    if (["Aplicação Inicial", "Aplicação"].includes(m.tipo_movimentacao)) {
      existing.aplicacoesBRL += m.valor;
      existing.aplicacoesUSD += m.quantidade || 0;
    } else if (["Resgate", "Resgate Total"].includes(m.tipo_movimentacao)) {
      existing.resgatesBRL += m.valor;
      existing.resgatesUSD += m.quantidade || 0;
    }
    movMap.set(m.data, existing);
  }

  // Filter and sort calendar
  const effectiveEnd = dataResgateTotal && dataResgateTotal < dataCalculo ? dataResgateTotal : dataCalculo;
  const calDays = calendario
    .filter(d => d.data >= dataInicio && d.data <= effectiveEnd)
    .sort((a, b) => a.data.localeCompare(b.data));

  if (calDays.length === 0) return [];

  const rows: CambioDailyRow[] = [];
  let qtyUSD = 0;
  let lastCotacao = input.cotacaoInicial;
  let rentAcumFactor = 1;
  let totalGanho = 0;

  for (const day of calDays) {
    const cotacaoDia = cotacaoMap.get(day.data) ?? lastCotacao;
    const movDia = movMap.get(day.data);
    const aplicacoesBRL = movDia?.aplicacoesBRL || 0;
    const resgatesBRL = movDia?.resgatesBRL || 0;
    const aplicacoesUSD = movDia?.aplicacoesUSD || 0;
    const resgatesUSD = movDia?.resgatesUSD || 0;

    // Update qty at start of day (applications add, resgates subtract)
    const prevQtyUSD = qtyUSD;
    qtyUSD += aplicacoesUSD;
    qtyUSD -= resgatesUSD;
    if (qtyUSD < 0.000001) qtyUSD = 0;

    const valorBRL = qtyUSD * cotacaoDia;

    // Ganho diário: variação do valor pela cotação, excluindo fluxos
    // = (qty_anterior × (cotação_hoje - cotação_ontem))
    const ganhoDiarioBRL = prevQtyUSD * (cotacaoDia - lastCotacao);

    // Rent diária %
    const prevValor = prevQtyUSD * lastCotacao;
    const base = prevValor + aplicacoesBRL;
    const rentDiariaPct = base > 0.01 ? ganhoDiarioBRL / base : 0;

    rentAcumFactor *= (1 + rentDiariaPct);
    totalGanho += ganhoDiarioBRL;

    rows.push({
      data: day.data,
      diaUtil: day.dia_util,
      cotacao: cotacaoDia,
      quantidadeUSD: qtyUSD,
      valorBRL,
      aplicacoesBRL,
      resgatesBRL,
      ganhoDiarioBRL,
      rentDiariaPct,
      rentAcumuladaPct: rentAcumFactor - 1,
      rentAcumuladaBRL: totalGanho,
    });

    lastCotacao = cotacaoDia;
  }

  return rows;
}

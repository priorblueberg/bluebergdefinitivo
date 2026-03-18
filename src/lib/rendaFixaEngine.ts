/**
 * Engine de Cálculo Diário de Renda Fixa Prefixada
 * 
 * Baseado em "Cota Virtual" (Valor da Cota 1 e Cota 2).
 * 
 * Cota 1 = valores APÓS o resgate (final do dia)
 * Cota 2 = valores ANTES do resgate (pré-resgate)
 * 
 * Ordem de cálculo:
 * 1. dailyMult (apenas dias úteis)
 * 2. liquido1 = prevLiquido * (1 + mult) + aplicações - resgates
 * 3. qtdCotasCompra = aplicações / prevValorCota
 * 4. saldoCotas2 = prevSaldoCotas + qtdCotasCompra (sem descontar resgate)
 * 5. liquido2 = liquido1 + resgates (devolver resgate = pré-resgate)
 * 6. valorCota2 = liquido2 / saldoCotas2
 * 7. qtdCotasResgate = resgates / valorCota2
 * 8. saldoCotas1 = saldoCotas2 - qtdCotasResgate
 * 9. valorCota1 = liquido1 / saldoCotas1
 * 10. rentDiária = valorCota1 / prevValorCota - 1
 */

export interface DailyRow {
  data: string;
  diaUtil: boolean;
  valorCota: number;       // Valor da Cota (1) - após resgate
  saldoCotas: number;      // Saldo de Cotas (1) - após resgate
  liquido: number;         // Líquido (1) - após resgate
  valorCota2: number;      // Valor da Cota (2) - antes do resgate
  saldoCotas2: number;     // Saldo de Cotas (2) - antes do resgate
  liquido2: number;        // Líquido (2) - antes do resgate
  aplicacoes: number;
  qtdCotasCompra: number;
  resgates: number;
  qtdCotasResgate: number;
  rentabilidadeDiaria: number | null;
  multiplicador: number;
}

export interface EngineInput {
  dataInicio: string;
  dataCalculo: string;
  taxa: number;
  modalidade: string;
  puInicial: number;
  calendario: { data: string; dia_util: boolean }[];
  movimentacoes: { data: string; tipo_movimentacao: string; valor: number }[];
}

function getMultiplicador(modalidade: string, taxa: number): number {
  if (modalidade === "Prefixado") {
    return Math.pow(1 + taxa / 100, 1 / 252) - 1;
  }
  return 0;
}

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

function findDayBefore(dataInicio: string, calendario: EngineInput["calendario"]): string | null {
  const sorted = [...calendario].sort((a, b) => a.data.localeCompare(b.data));
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].data < dataInicio) {
      return sorted[i].data;
    }
  }
  return null;
}

export function calcularRendaFixaDiario(input: EngineInput): DailyRow[] {
  const { dataInicio, dataCalculo, taxa, modalidade, puInicial, calendario, movimentacoes } = input;

  const cotaInicial = puInicial > 0 ? puInicial : 1000;
  const multiplicador = getMultiplicador(modalidade, taxa);
  const movMap = buildMovMap(movimentacoes);

  const sorted = [...calendario].sort((a, b) => a.data.localeCompare(b.data));
  const dayBefore = findDayBefore(dataInicio, calendario);

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
      rows.push({
        data: cal.data,
        diaUtil: cal.dia_util,
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
        rentabilidadeDiaria: null,
        multiplicador: 0,
      });
      prevValorCota = cotaInicial;
      prevLiquido = 0;
      prevSaldoCotas = 0;
      continue;
    }

    // 1. Daily multiplicador
    const dailyMult = cal.dia_util ? multiplicador : 0;

    // 2. Líquido (1) = prev * (1 + mult) + aplicações - resgates
    const liquido1 = prevLiquido * (1 + dailyMult) + mov.aplicacoes - mov.resgates;

    // 3. QTD Cotas Compra
    const qtdCotasCompra = prevValorCota > 0 ? mov.aplicacoes / prevValorCota : 0;

    // 4. Saldo de Cotas (2) = prev saldo + cotas compra (sem descontar resgate)
    const saldoCotas2 = prevSaldoCotas + qtdCotasCompra;

    // 5. Líquido (2) = Líquido(1) + resgates (pré-resgate)
    const liquido2 = liquido1 + mov.resgates;

    // 6. Valor da Cota (2) = Líquido(2) / Saldo Cotas(2)
    const valorCota2 = saldoCotas2 > 0 ? liquido2 / saldoCotas2 : prevValorCota;

    // 7. QTD Cotas Resgate
    const qtdCotasResgate = mov.resgates > 0 && valorCota2 > 0 ? mov.resgates / valorCota2 : 0;

    // 8. Saldo de Cotas (1) = Saldo(2) - cotas resgatadas
    const saldoCotas1 = saldoCotas2 - qtdCotasResgate;

    // 9. Valor da Cota (1) = Líquido(1) / Saldo Cotas(1)
    const valorCota1 = saldoCotas1 > 0 ? liquido1 / saldoCotas1 : prevValorCota;

    // 10. Rentabilidade diária
    const rentDiaria = prevValorCota > 0 ? valorCota1 / prevValorCota - 1 : null;

    rows.push({
      data: cal.data,
      diaUtil: cal.dia_util,
      valorCota: valorCota1,
      saldoCotas: saldoCotas1,
      liquido: liquido1,
      valorCota2,
      saldoCotas2,
      liquido2,
      aplicacoes: mov.aplicacoes,
      qtdCotasCompra,
      resgates: mov.resgates,
      qtdCotasResgate,
      rentabilidadeDiaria: rentDiaria,
      multiplicador: dailyMult,
    });

    prevLiquido = liquido1;
    prevSaldoCotas = saldoCotas1;
    prevValorCota = valorCota1;
  }

  return rows;
}

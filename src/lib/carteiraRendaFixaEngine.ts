/**
 * Engine de Cálculo da Carteira de Renda Fixa
 *
 * Agrega os resultados individuais (DailyRow[]) de todos os produtos
 * de Renda Fixa em uma visão consolidada usando o sistema de Cota Virtual.
 *
 * Colunas:
 * - Data, Dia Útil
 * - Valor da Cota (1), Saldo de Cotas (1), Líquido (1)
 * - Valor da Cota (2), Saldo de Cotas (2), Líquido (2)
 * - Aplicações, QTD Cotas Compra
 * - Resgates, QTD Cotas Resgate
 * - R$ Rent. Diária, R$ Rent. Acumulada, % Rent. Acumulada
 * - Juros Pago
 */

import { DailyRow } from "./rendaFixaEngine";

export interface CarteiraRFRow {
  data: string;
  diaUtil: boolean;
  valorCota: number;
  saldoCotas: number;
  liquido: number;
  valorCota2: number;
  saldoCotas2: number;
  liquido2: number;
  aplicacoes: number;
  qtdCotasCompra: number;
  resgates: number;
  qtdCotasResgate: number;
  ganhoDiario: number;
  ganhoAcumulado: number;
  rentabilidadeAcumuladaPct: number;
  jurosPago: number;
  // For compatibility with buildDetailRowsFromEngine
  rentabilidadeDiaria: number | null;
}

export interface CarteiraRFInput {
  /** All individual product DailyRow arrays */
  productRows: DailyRow[][];
  /** Calendar for the portfolio period */
  calendario: { data: string; dia_util: boolean }[];
  /** Portfolio start date from controle_de_carteiras */
  dataInicio: string;
  /** Portfolio end date from controle_de_carteiras */
  dataCalculo: string;
}

/**
 * Aggregate individual product rows into a portfolio-level daily series.
 */
export function calcularCarteiraRendaFixa(input: CarteiraRFInput): CarteiraRFRow[] {
  const { productRows, calendario, dataInicio, dataCalculo } = input;
  const PU_INICIAL = 1000;

  // Build per-date aggregation maps from all products
  const dateAgg = new Map<string, {
    liquido: number;
    aplicacoes: number;
    resgates: number;
    ganhoDiario: number;
    jurosPago: number;
  }>();

  for (const rows of productRows) {
    for (const row of rows) {
      if (row.data < dataInicio || row.data > dataCalculo) continue;
      const existing = dateAgg.get(row.data) || {
        liquido: 0, aplicacoes: 0, resgates: 0, ganhoDiario: 0, jurosPago: 0,
      };
      existing.liquido += row.liquido;
      existing.aplicacoes += row.aplicacoes;
      existing.resgates += row.resgates;
      existing.ganhoDiario += row.ganhoDiario;
      existing.jurosPago += row.jurosPago;
      dateAgg.set(row.data, existing);
    }
  }

  // Sort calendar and iterate
  const sorted = [...calendario]
    .filter(c => c.data >= dataInicio && c.data <= dataCalculo)
    .sort((a, b) => a.data.localeCompare(b.data));

  const result: CarteiraRFRow[] = [];
  let prevValorCota = PU_INICIAL;
  let prevSaldoCotas = 0;
  let rentAcumRS = 0;

  for (const cal of sorted) {
    const agg = dateAgg.get(cal.data);
    if (!agg) {
      // No product data for this date — carry forward
      result.push({
        data: cal.data,
        diaUtil: cal.dia_util,
        valorCota: prevValorCota,
        saldoCotas: prevSaldoCotas,
        liquido: prevSaldoCotas * prevValorCota,
        valorCota2: prevValorCota,
        saldoCotas2: prevSaldoCotas,
        liquido2: prevSaldoCotas * prevValorCota,
        aplicacoes: 0,
        qtdCotasCompra: 0,
        resgates: 0,
        qtdCotasResgate: 0,
        ganhoDiario: 0,
        ganhoAcumulado: rentAcumRS,
        rentabilidadeAcumuladaPct: PU_INICIAL > 0 ? (prevValorCota / PU_INICIAL) - 1 : 0,
        jurosPago: 0,
        rentabilidadeDiaria: null,
      });
      continue;
    }

    const { liquido: liquido1, aplicacoes, resgates, ganhoDiario, jurosPago } = agg;

    // Líquido (2) = Líquido (1) + Resgates
    const liquido2 = liquido1 + resgates;

    // QTD Cotas Compra = Aplicações / Valor da Cota anterior
    const qtdCotasCompra = prevValorCota > 0 ? aplicacoes / prevValorCota : 0;

    // Saldo de Cotas (2) = previous saldo + cotas compradas
    const saldoCotas2 = prevSaldoCotas + qtdCotasCompra;

    // Valor da Cota (2) = Líquido (2) / Saldo de Cotas (2)
    const valorCota2 = saldoCotas2 > 0 ? liquido2 / saldoCotas2 : prevValorCota;

    // QTD Cotas Resgate = Resgates / Valor da Cota (2)
    const qtdCotasResgate = resgates > 0 && valorCota2 > 0 ? resgates / valorCota2 : 0;

    // Saldo de Cotas (1) = Saldo de Cotas (2) - QTD Cotas Resgate
    const saldoCotas1 = saldoCotas2 - qtdCotasResgate;

    // Valor da Cota (1) = Líquido (1) / Saldo de Cotas (1)
    const valorCota1 = saldoCotas1 > 0 ? liquido1 / saldoCotas1 : prevValorCota;

    // Rentabilidade acumulada
    rentAcumRS += ganhoDiario;

    // % Rent. Acumulada
    const rentPct = PU_INICIAL > 0 ? (valorCota1 / PU_INICIAL) - 1 : 0;

    // Daily return (cota-based) for detail table compatibility
    const rentDiaria = prevValorCota > 0 && cal.data > dataInicio
      ? valorCota1 / prevValorCota - 1
      : null;

    result.push({
      data: cal.data,
      diaUtil: cal.dia_util,
      valorCota: valorCota1,
      saldoCotas: saldoCotas1,
      liquido: liquido1,
      valorCota2,
      saldoCotas2,
      liquido2,
      aplicacoes,
      qtdCotasCompra,
      resgates,
      qtdCotasResgate,
      ganhoDiario,
      ganhoAcumulado: rentAcumRS,
      rentabilidadeAcumuladaPct: rentPct,
      jurosPago,
      rentabilidadeDiaria: rentDiaria,
    });

    prevValorCota = valorCota1;
    prevSaldoCotas = saldoCotas1;
  }

  return result;
}

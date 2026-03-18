import { supabase } from "@/integrations/supabase/client";

/**
 * Calcula o saldo (patrimônio) de um título Prefixado na data de consulta,
 * considerando resgates anteriores.
 */
export async function calcSaldoPrefixado(
  valorInvestido: number,
  taxa: number,
  dataInicio: string,
  dataConsulta: string,
  codigoCustodia: number,
  userId: string
): Promise<number> {
  const fd = Math.pow(1 + taxa / 100, 1 / 252) - 1;

  const { data: diasUteis } = await supabase
    .from("calendario_dias_uteis")
    .select("data")
    .gt("data", dataInicio)
    .lte("data", dataConsulta)
    .eq("dia_util", true)
    .order("data");

  const bDays = new Set((diasUteis || []).map((d: any) => d.data));

  const { data: resgates } = await supabase
    .from("movimentacoes")
    .select("data, valor")
    .eq("codigo_custodia", codigoCustodia)
    .eq("user_id", userId)
    .eq("tipo_movimentacao", "Resgate")
    .lte("data", dataConsulta)
    .order("data");

  const events: { data: string; valor: number }[] = [
    { data: dataInicio, valor: 0 },
    ...(resgates || []).map((r: any) => ({ data: r.data, valor: r.valor })),
  ];

  let patrimonio = valorInvestido;

  for (let i = 0; i < events.length; i++) {
    const segStart = events[i].data;
    const segEnd = i + 1 < events.length ? events[i + 1].data : dataConsulta;

    let count = 0;
    for (const d of bDays) {
      if (d > segStart && d <= segEnd) count++;
    }

    patrimonio *= Math.pow(1 + fd, count);

    if (i + 1 < events.length) {
      patrimonio -= events[i + 1].valor;
    }
  }

  return patrimonio;
}

import { calcularPoupancaDiario, buildPoupancaLotesFromMovs } from "@/lib/poupancaEngine";
import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL!;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
const supabase = createClient(url, key);

async function main() {
  const dataInicio = "2024-01-02";
  const dataCalculo = "2025-12-30";

  const [calRes, selicRes, trRes, poupRes] = await Promise.all([
    supabase.from("calendario_dias_uteis").select("data,dia_util").gte("data", dataInicio).lte("data", dataCalculo).order("data"),
    supabase.from("historico_selic").select("data,taxa_anual").gte("data", dataInicio).lte("data", dataCalculo).order("data"),
    supabase.from("historico_tr").select("data,taxa_mensal").gte("data", dataInicio).lte("data", dataCalculo).order("data"),
    supabase.from("historico_poupanca_rendimento").select("data,rendimento_mensal").gte("data", dataInicio).lte("data", dataCalculo).order("data"),
  ]);

  const movs = [
    { data: "2024-01-02", tipo_movimentacao: "Aplicação Inicial", valor: 100000 },
    { data: "2024-01-10", tipo_movimentacao: "Aplicação", valor: 50000 },
    { data: "2024-02-20", tipo_movimentacao: "Resgate", valor: 80000 },
  ];

  const lotes = buildPoupancaLotesFromMovs(movs);

  const rows = calcularPoupancaDiario({
    dataInicio,
    dataCalculo,
    calendario: calRes.data! as any,
    movimentacoes: movs,
    lotes,
    selicRecords: selicRes.data! as any,
    trRecords: trRes.data! as any,
    poupancaRendimentoRecords: poupRes.data! as any,
  });

  console.log("=== ANIVERSÁRIOS COM RENDIMENTO ===");
  for (const r of rows) {
    if (r.ganhoDiario > 0.001) {
      console.log(`${r.data}: liq=${r.liquido.toFixed(2)}, ganho=${r.ganhoDiario.toFixed(8)}, acum=${r.ganhoAcumulado.toFixed(2)}, inv=${r.valorInvestido.toFixed(2)}`);
    }
  }

  const resDay = rows.find(r => r.data === "2024-02-20");
  if (resDay) console.log(`\nResgate 20/02: liq=${resDay.liquido.toFixed(2)}, resg=${resDay.resgates}, inv=${resDay.valorInvestido.toFixed(2)}`);

  const last = rows[rows.length - 1];
  console.log(`\n=== FINAL (${last.data}) ===`);
  console.log(`Líquido: ${last.liquido.toFixed(2)}`);
  console.log(`Ganho acum: ${last.ganhoAcumulado.toFixed(2)}`);
  console.log(`Gorila: 81166.42`);
  console.log(`Diff: ${(last.liquido - 81166.42).toFixed(2)}`);
}

main().catch(console.error);

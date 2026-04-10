import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!);

interface Lote {
  id: string; app: string; diaAniv: number; valorAtual: number; valorPrincipal: number; ultAniv: string | null; status: string;
}

function getAnivDate(y: number, m: number, dia: number): string {
  const last = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2,"0")}-${String(Math.min(dia, last)).padStart(2,"0")}`;
}

async function main() {
  const poupRes = await supabase.from("historico_poupanca_rendimento").select("data,rendimento_mensal").gte("data","2024-01-01").lte("data","2025-12-31").order("data");
  const pMap = new Map<string,number>();
  for (const r of poupRes.data!) pMap.set((r as any).data, (r as any).rendimento_mensal);

  // Three modes: "valorAtual" (current engine), "principal-only", "principal-then-compound"
  for (const mode of ["valorAtual", "principal-resgate-only"]) {
    const lotes: Lote[] = [
      { id:"A", app:"2024-01-02", diaAniv:2, valorAtual:100000, valorPrincipal:100000, ultAniv:null, status:"ativo" },
      { id:"B", app:"2024-01-10", diaAniv:10, valorAtual:50000, valorPrincipal:50000, ultAniv:null, status:"ativo" },
    ];

    const events: {date:string, type:string}[] = [];
    for (let y=2024;y<=2025;y++) for (let m=1;m<=12;m++) {
      for (const l of lotes) {
        const dt = getAnivDate(y, m, l.diaAniv);
        if (dt > l.app && dt <= "2025-12-30") events.push({date:dt, type:`aniv-${l.id}`});
      }
    }
    events.push({date:"2024-02-20", type:"resgate"});
    events.sort((a,b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type));

    for (const ev of events) {
      if (ev.type.startsWith("aniv-")) {
        const lote = lotes.find(l => l.id === ev.type.split("-")[1])!;
        if (lote.status !== "ativo" || ev.date <= (lote.ultAniv || lote.app)) continue;
        const cicloStart = lote.ultAniv || lote.app;
        const taxa = pMap.get(cicloStart);
        if (taxa === undefined) continue;

        // KEY DIFFERENCE: what base to use for rendimento
        const base = lote.valorAtual; // always use valorAtual (rendimento compounds)
        let rend = Math.round(base * (taxa / 100) * 1e8) / 1e8;
        lote.valorAtual += rend;
        lote.ultAniv = ev.date;
      } else if (ev.type === "resgate") {
        let rest = 80000;
        const sorted = [...lotes].sort((a,b) => a.app.localeCompare(b.app));
        for (const l of sorted) {
          if (rest <= 0 || l.status !== "ativo") continue;
          if (rest >= l.valorAtual - 0.01) {
            rest -= l.valorAtual; l.valorAtual = 0; l.valorPrincipal = 0; l.status = "resgatado";
          } else {
            if (mode === "principal-resgate-only") {
              // Resgate only from principal, keep rendimento intact
              const rendInLote = l.valorAtual - l.valorPrincipal;
              l.valorPrincipal -= rest;
              l.valorAtual = l.valorPrincipal + rendInLote;
            } else {
              const prop = rest / l.valorAtual;
              l.valorPrincipal -= l.valorPrincipal * prop;
              l.valorAtual -= rest;
            }
            rest = 0;
          }
        }
        if (mode === "principal-resgate-only") {
          console.log(`  [${mode}] After resgate: A.atual=${lotes[0].valorAtual.toFixed(2)}, A.princ=${lotes[0].valorPrincipal.toFixed(2)}`);
        }
      }
    }

    const total = lotes.reduce((s,l) => s + l.valorAtual, 0);
    console.log(`${mode}: Total=${total.toFixed(2)}, Diff=${(total - 81166.42).toFixed(2)}`);
  }
}
main().catch(console.error);

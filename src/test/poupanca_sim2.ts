import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!);

interface Lote {
  id: string; app: string; diaAniv: number; valorAtual: number; valorPrincipal: number; rendAcum: number; ultAniv: string | null; status: string;
}

function getAnivDate(y: number, m: number, dia: number): string {
  const last = new Date(y, m, 0).getDate();
  const d = Math.min(dia, last);
  return `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
}

async function main() {
  const poupRes = await supabase.from("historico_poupanca_rendimento").select("data,rendimento_mensal").gte("data","2024-01-01").lte("data","2025-12-31").order("data");
  const pMap = new Map<string,number>();
  for (const r of poupRes.data!) pMap.set((r as any).data, (r as any).rendimento_mensal);

  // Run TWO simulations: 8-decimal (engine) vs 2-decimal (centavos)
  for (const mode of ["8dec", "2dec"]) {
    const lotes: Lote[] = [
      { id:"A", app:"2024-01-02", diaAniv:2, valorAtual:100000, valorPrincipal:100000, rendAcum:0, ultAniv:null, status:"ativo" },
      { id:"B", app:"2024-01-10", diaAniv:10, valorAtual:50000, valorPrincipal:50000, rendAcum:0, ultAniv:null, status:"ativo" },
    ];

    // Process chronologically
    const events: {date:string, type:string}[] = [];
    for (let y=2024;y<=2025;y++) for (let m=1;m<=12;m++) {
      for (const l of lotes) {
        const dt = getAnivDate(y, m, l.diaAniv);
        if (dt > l.app && dt <= "2025-12-30") events.push({date:dt, type:`aniv-${l.id}`});
      }
    }
    events.push({date:"2024-02-20", type:"resgate"});
    events.sort((a,b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type));

    const divergences: string[] = [];

    for (const ev of events) {
      if (ev.type.startsWith("aniv-")) {
        const lid = ev.type.split("-")[1];
        const lote = lotes.find(l => l.id === lid)!;
        if (lote.status !== "ativo") continue;
        if (ev.date <= (lote.ultAniv || lote.app)) continue;

        const cicloStart = lote.ultAniv || lote.app;
        const taxa = pMap.get(cicloStart);
        if (taxa === undefined) continue;

        let rend = lote.valorAtual * (taxa / 100);
        if (mode === "8dec") rend = Math.round(rend * 1e8) / 1e8;
        else rend = Math.round(rend * 100) / 100;

        lote.valorAtual += rend;
        lote.rendAcum += rend;
        lote.ultAniv = ev.date;
      } else if (ev.type === "resgate") {
        let rest = 80000;
        for (const l of lotes.sort((a,b) => a.app.localeCompare(b.app))) {
          if (rest <= 0 || l.status !== "ativo") continue;
          if (rest >= l.valorAtual - 0.01) {
            rest -= l.valorAtual; l.valorAtual = 0; l.valorPrincipal = 0; l.rendAcum = 0; l.status = "resgatado";
          } else {
            const prop = rest / l.valorAtual;
            l.valorPrincipal -= l.valorPrincipal * prop;
            l.rendAcum -= l.rendAcum * prop;
            l.valorAtual -= rest;
            rest = 0;
          }
        }
      }
    }

    const total = lotes.reduce((s,l) => s + l.valorAtual, 0);
    console.log(`\n=== ${mode.toUpperCase()} ===`);
    console.log(`Lote A: ${lotes[0].valorAtual.toFixed(8)}`);
    console.log(`Lote B: ${lotes[1].valorAtual.toFixed(8)}`);
    console.log(`Total: ${total.toFixed(2)}`);
    console.log(`Diff vs Gorila(81166.42): ${(total - 81166.42).toFixed(2)}`);
  }
}
main().catch(console.error);

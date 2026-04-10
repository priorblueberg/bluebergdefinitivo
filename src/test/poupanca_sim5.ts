import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!);

interface Lote { id:string; app:string; diaAniv:number; valorAtual:number; ultAniv:string|null; status:string; }
function getAnivDate(y:number,m:number,d:number):string { const l=new Date(y,m,0).getDate(); return `${y}-${String(m).padStart(2,"0")}-${String(Math.min(d,l)).padStart(2,"0")}`; }

async function main() {
  const poupRes = await supabase.from("historico_poupanca_rendimento").select("data,rendimento_mensal").gte("data","2024-01-01").lte("data","2025-12-31").order("data");
  const pMap = new Map<string,number>();
  for (const r of poupRes.data!) pMap.set((r as any).data, (r as any).rendimento_mensal);

  // Hypothesis: Gorila does FIFO but fully consumes lotes and creates "change" lote
  // Lote A: 100617 → consumed fully, change = 20617 as NEW lote (date = resgate date)
  const lotes: Lote[] = [
    { id:"A", app:"2024-01-02", diaAniv:2, valorAtual:100000, ultAniv:null, status:"ativo" },
    { id:"B", app:"2024-01-10", diaAniv:10, valorAtual:50000, ultAniv:null, status:"ativo" },
  ];

  // Phase 1: pre-resgate anniversaries
  // A: 02/02/2024
  let taxa = pMap.get("2024-01-02")!;
  lotes[0].valorAtual += Math.round(lotes[0].valorAtual * (taxa/100) * 1e8) / 1e8;
  lotes[0].ultAniv = "2024-02-02";
  
  // B: 10/02/2024
  taxa = pMap.get("2024-01-10")!;
  lotes[1].valorAtual += Math.round(lotes[1].valorAtual * (taxa/100) * 1e8) / 1e8;
  lotes[1].ultAniv = "2024-02-10";

  console.log(`Pre-resgate: A=${lotes[0].valorAtual.toFixed(2)}, B=${lotes[1].valorAtual.toFixed(2)}`);

  // Phase 2: Resgate 80000 on 20/02/2024
  // FIFO: consume Lote A entirely (100617), change = 100617 - 80000 = 20617
  // Create new Lote C from change, with app date = 2024-02-20, diaAniv = 20
  const changeAmount = lotes[0].valorAtual - 80000;
  lotes[0].status = "resgatado"; lotes[0].valorAtual = 0;
  
  lotes.push({ id:"C", app:"2024-02-20", diaAniv:20, valorAtual: changeAmount, ultAniv:null, status:"ativo" });
  console.log(`Resgate: A consumed, change lote C=${changeAmount.toFixed(2)} (aniv dia 20)`);
  console.log(`Post-resgate: B=${lotes[1].valorAtual.toFixed(2)}, C=${lotes[2].valorAtual.toFixed(2)}, total=${(lotes[1].valorAtual + lotes[2].valorAtual).toFixed(2)}`);

  // Phase 3: Process remaining anniversaries
  const activeLotes = lotes.filter(l => l.status === "ativo");
  const events: {date:string, loteId:string}[] = [];
  for (const l of activeLotes) {
    for (let y=2024;y<=2025;y++) for (let m=1;m<=12;m++) {
      const dt = getAnivDate(y,m,l.diaAniv);
      if (dt > (l.ultAniv || l.app) && dt <= "2025-12-30") events.push({date:dt, loteId:l.id});
    }
  }
  events.sort((a,b) => a.date.localeCompare(b.date));

  for (const ev of events) {
    const lote = lotes.find(l => l.id === ev.loteId)!;
    if (lote.status !== "ativo") continue;
    const cicloStart = lote.ultAniv || lote.app;
    const t = pMap.get(cicloStart);
    if (t === undefined) continue;
    const rend = Math.round(lote.valorAtual * (t/100) * 1e8) / 1e8;
    lote.valorAtual += rend;
    lote.ultAniv = ev.date;
  }

  const total = lotes.reduce((s,l) => s + l.valorAtual, 0);
  console.log(`\nFINAL: B=${lotes[1].valorAtual.toFixed(2)}, C=${lotes[2].valorAtual.toFixed(2)}`);
  console.log(`Total=${total.toFixed(2)}, Gorila=81166.42, Diff=${(total-81166.42).toFixed(2)}`);
}
main().catch(console.error);

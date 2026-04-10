import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!);

interface Lote { id:string; app:string; diaAniv:number; valorAtual:number; principal:number; ultAniv:string|null; status:string; }
function aniv(y:number,m:number,d:number):string { const l=new Date(y,m,0).getDate(); return `${y}-${String(m).padStart(2,"0")}-${String(Math.min(d,l)).padStart(2,"0")}`; }

async function main() {
  const poupRes = await supabase.from("historico_poupanca_rendimento").select("data,rendimento_mensal").gte("data","2024-01-01").lte("data","2025-12-31").order("data");
  const pMap = new Map<string,number>();
  for (const r of poupRes.data!) pMap.set((r as any).data, (r as any).rendimento_mensal);

  // Hypothesis: rendimento calculated on PRINCIPAL, not on valorAtual
  // (simple interest, not compound)
  const lotes: Lote[] = [
    { id:"A", app:"2024-01-02", diaAniv:2, valorAtual:100000, principal:100000, ultAniv:null, status:"ativo" },
    { id:"B", app:"2024-01-10", diaAniv:10, valorAtual:50000, principal:50000, ultAniv:null, status:"ativo" },
  ];

  const events: {date:string, type:string}[] = [];
  for (let y=2024;y<=2025;y++) for (let m=1;m<=12;m++) {
    for (const l of lotes) { const dt=aniv(y,m,l.diaAniv); if(dt>l.app&&dt<="2025-12-30") events.push({date:dt,type:`aniv-${l.id}`}); }
  }
  events.push({date:"2024-02-20",type:"resgate"});
  events.sort((a,b)=>a.date.localeCompare(b.date)||a.type.localeCompare(b.type));

  for (const ev of events) {
    if (ev.type.startsWith("aniv-")) {
      const lote = lotes.find(l=>l.id===ev.type.split("-")[1])!;
      if (lote.status!=="ativo"||ev.date<=(lote.ultAniv||lote.app)) continue;
      const cs = lote.ultAniv || lote.app;
      const t = pMap.get(cs);
      if (t===undefined) continue;
      // Use PRINCIPAL as base (not valorAtual)
      const rend = Math.round(lote.principal * (t/100) * 1e8) / 1e8;
      lote.valorAtual += rend;
      lote.ultAniv = ev.date;
    } else {
      let rest = 80000;
      for (const l of lotes.sort((a,b)=>a.app.localeCompare(b.app))) {
        if (rest<=0||l.status!=="ativo") continue;
        if (rest >= l.valorAtual - 0.01) { rest-=l.valorAtual; l.valorAtual=0; l.principal=0; l.status="resgatado"; }
        else { const prop=rest/l.valorAtual; l.principal-=l.principal*prop; l.valorAtual-=rest; rest=0; }
      }
    }
  }
  const total = lotes.reduce((s,l)=>s+l.valorAtual,0);
  console.log(`simple-interest: Total=${total.toFixed(2)}, Diff=${(total-81166.42).toFixed(2)}`);

  // Also test: compound but with different resgate handling
  // What if resgate consumes from valorAtual but recalculates proportional SPLIT differently?
  // Try: after resgate, lote's valorAtual = remainder, but principal tracks independently
  // and rendimento applies to valorAtual (compound) — essentially what we already have
}
main().catch(console.error);

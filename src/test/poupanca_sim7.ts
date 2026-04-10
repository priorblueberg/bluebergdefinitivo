import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!);

interface Lote { id:string; app:string; diaAniv:number; valorAtual:number; principal:number; rendAcum:number; ultAniv:string|null; status:string; }
function aniv(y:number,m:number,d:number):string { const l=new Date(y,m,0).getDate(); return `${y}-${String(m).padStart(2,"0")}-${String(Math.min(d,l)).padStart(2,"0")}`; }

async function main() {
  const poupRes = await supabase.from("historico_poupanca_rendimento").select("data,rendimento_mensal").gte("data","2024-01-01").lte("data","2025-12-31").order("data");
  const pMap = new Map<string,number>();
  for (const r of poupRes.data!) pMap.set((r as any).data, (r as any).rendimento_mensal);

  // Hypothesis: After partial resgate, rendimento applies to valorAtual (compound),
  // BUT the resgate amount is subtracted from PRINCIPAL FIRST, then from rendimento.
  // This means remaining principal is lower than proportional calculation
  
  // Actually let me try: resgate 80K from Lote A
  // Gorila might subtract from principal: principal = 100000 - 80000 = 20000
  // rendAcum stays = 617
  // valorAtual = 20000 + 617 = 20617 (same as before)
  // THEN subsequent rendimento applies to valorAtual (compound) → same result as current engine

  // Hmm, same valorAtual. Let me try yet another approach:
  // What if Gorila rounds the resgate proportionally to centavos?
  // Or: what if the Gorila applies the resgate to the SALDO (sum of all lotes)
  // proportionally across all lotes, not FIFO?

  for (const mode of ["fifo", "proportional"]) {
    const lotes: Lote[] = [
      { id:"A", app:"2024-01-02", diaAniv:2, valorAtual:100000, principal:100000, rendAcum:0, ultAniv:null, status:"ativo" },
      { id:"B", app:"2024-01-10", diaAniv:10, valorAtual:50000, principal:50000, rendAcum:0, ultAniv:null, status:"ativo" },
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
        const rend = Math.round(lote.valorAtual * (t/100) * 1e8) / 1e8;
        lote.valorAtual += rend;
        lote.rendAcum += rend;
        lote.ultAniv = ev.date;
      } else {
        if (mode === "fifo") {
          let rest = 80000;
          for (const l of lotes.sort((a,b)=>a.app.localeCompare(b.app))) {
            if (rest<=0||l.status!=="ativo") continue;
            if (rest >= l.valorAtual - 0.01) { rest-=l.valorAtual; l.valorAtual=0; l.principal=0; l.rendAcum=0; l.status="resgatado"; }
            else { const prop=rest/l.valorAtual; l.principal-=l.principal*prop; l.rendAcum-=l.rendAcum*prop; l.valorAtual-=rest; rest=0; }
          }
        } else {
          // Proportional across all active lotes
          const totalAtual = lotes.filter(l=>l.status==="ativo").reduce((s,l)=>s+l.valorAtual,0);
          for (const l of lotes) {
            if (l.status !== "ativo") continue;
            const share = l.valorAtual / totalAtual;
            const resgateLote = 80000 * share;
            const prop = resgateLote / l.valorAtual;
            l.principal -= l.principal * prop;
            l.rendAcum -= l.rendAcum * prop;
            l.valorAtual -= resgateLote;
          }
        }
      }
    }
    const total = lotes.reduce((s,l)=>s+l.valorAtual,0);
    console.log(`${mode}: A=${lotes[0].valorAtual.toFixed(2)} B=${lotes[1].valorAtual.toFixed(2)} Total=${total.toFixed(2)} Diff=${(total-81166.42).toFixed(2)}`);
  }
}
main().catch(console.error);

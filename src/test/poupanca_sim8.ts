import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!);

function aniv(y:number,m:number,d:number):string { const l=new Date(y,m,0).getDate(); return `${y}-${String(m).padStart(2,"0")}-${String(Math.min(d,l)).padStart(2,"0")}`; }

async function main() {
  const poupRes = await supabase.from("historico_poupanca_rendimento").select("data,rendimento_mensal").gte("data","2024-01-01").lte("data","2025-12-31").order("data");
  const pMap = new Map<string,number>();
  for (const r of poupRes.data!) pMap.set((r as any).data, (r as any).rendimento_mensal);

  // Hypothesis 1: Change lote keeps original anniversary (dia 2), starts fresh from resgate date
  // Hypothesis 2: Resgate loses the accrued rendimento (only principal returned)
  // Hypothesis 3: BCB rule - resgate on a non-anniversary day loses the current period rendimento
  
  // BCB RULE: In poupança, if you withdraw BEFORE the anniversary, you lose the rendimento
  // of the CURRENT period. So the 80K resgate on 20/02 comes from Lote A's PRINCIPAL,
  // not from the rendered amount. The rendimento from 02/02 IS kept because it was already
  // credited. But the resgate reduces the base for FUTURE rendimentos.
  
  // Actually, the BCB rule is simpler: rendimento is credited on anniversary.
  // If you withdraw between anniversaries, you get the last credited amount.
  // Our engine already handles this correctly since rendimento is only applied on anniversaries.
  
  // Let me try: what if the resgate of 80K is applied to Lote A such that:
  // - The 617 rendimento was already credited and is part of the balance
  // - FIFO partial: take 80K from 100617
  // - But what if Gorila considers the 617 as "rendimento pago" (not reinvested)?
  // - i.e., after anniversary, the rendimento is PAID OUT (separate balance)
  //   and only the original 100K remains as principal for next cycle?

  // Test: "paid-out" model: rendimento credited but NOT compounded into next cycle
  const lotes = [
    { id:"A", app:"2024-01-02", diaAniv:2, base:100000, rendPaid:0, ultAniv:null as string|null, status:"ativo" },
    { id:"B", app:"2024-01-10", diaAniv:10, base:50000, rendPaid:0, ultAniv:null as string|null, status:"ativo" },
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
      // Rendimento on base only (simple interest model)
      const rend = Math.round(lote.base * (t/100) * 1e8) / 1e8;
      lote.rendPaid += rend;
      lote.ultAniv = ev.date;
    } else {
      // FIFO resgate from total (base + rendPaid)
      let rest = 80000;
      for (const l of lotes.sort((a,b)=>a.app.localeCompare(b.app))) {
        if (rest<=0||l.status!=="ativo") continue;
        const total = l.base + l.rendPaid;
        if (rest >= total - 0.01) { rest-=total; l.base=0; l.rendPaid=0; l.status="resgatado"; }
        else { const prop=rest/total; l.base-=l.base*prop; l.rendPaid-=l.rendPaid*prop; rest=0; }
      }
    }
  }
  let total = lotes.reduce((s,l)=>s+l.base+l.rendPaid,0);
  console.log(`paid-out-model: Total=${total.toFixed(2)}, Diff=${(total-81166.42).toFixed(2)}`);

  // Another test: compound interest but resgate resets the rendimento
  // After partial resgate, the remaining valorAtual becomes the new "principal" for compounding
  // AND the cycle restarts from the resgate date (losing partial cycle)
  // Actually this is the same as our current engine since resgate is between anniversaries
  
  // Let me try: what if rendimento IS compounded but the Série 195 lookup
  // uses a DIFFERENT date? E.g., the previous anniversary date (not ciclo start)
  // Wait, ciclo start IS the previous anniversary date for subsequent cycles.
  // For the first cycle, it's the application date. These should be the same...
  
  // Actually, let me check if "último aniversário" after resgate might be different
  // What if after a partial FIFO resgate, the lote's "último aniversário" gets reset?
  // That would change the Série 195 lookup for the next cycle
  
  // Test: after resgate, reset ultAniv to resgate date
  {
    const lotes2 = [
      { id:"A", app:"2024-01-02", diaAniv:2, val:100000, ultAniv:null as string|null, status:"ativo" },
      { id:"B", app:"2024-01-10", diaAniv:10, val:50000, ultAniv:null as string|null, status:"ativo" },
    ];

    const events2: {date:string, type:string}[] = [];
    for (let y=2024;y<=2025;y++) for (let m=1;m<=12;m++) {
      for (const l of lotes2) { const dt=aniv(y,m,l.diaAniv); if(dt>l.app&&dt<="2025-12-30") events2.push({date:dt,type:`aniv-${l.id}`}); }
    }
    events2.push({date:"2024-02-20",type:"resgate"});
    events2.sort((a,b)=>a.date.localeCompare(b.date)||a.type.localeCompare(b.type));

    for (const ev of events2) {
      if (ev.type.startsWith("aniv-")) {
        const lote = lotes2.find(l=>l.id===ev.type.split("-")[1])!;
        if (lote.status!=="ativo"||ev.date<=(lote.ultAniv||lote.app)) continue;
        const cs = lote.ultAniv || lote.app;
        const t = pMap.get(cs);
        if (t===undefined) continue;
        const rend = Math.round(lote.val * (t/100) * 1e8) / 1e8;
        lote.val += rend;
        lote.ultAniv = ev.date;
      } else {
        let rest = 80000;
        for (const l of lotes2.sort((a,b)=>a.app.localeCompare(b.app))) {
          if (rest<=0||l.status!=="ativo") continue;
          if (rest >= l.val - 0.01) { rest-=l.val; l.val=0; l.status="resgatado"; }
          else { l.val -= rest; l.ultAniv = "2024-02-20"; rest=0; } // RESET ultAniv
        }
      }
    }
    const t2 = lotes2.reduce((s,l)=>s+l.val,0);
    console.log(`reset-ultAniv: Total=${t2.toFixed(2)}, Diff=${(t2-81166.42).toFixed(2)}`);
  }
}
main().catch(console.error);

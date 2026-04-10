import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!);

interface Lote { id:string; app:string; diaAniv:number; valorAtual:number; ultAniv:string|null; status:string; }
function getAnivDate(y:number,m:number,d:number):string { const l=new Date(y,m,0).getDate(); return `${y}-${String(m).padStart(2,"0")}-${String(Math.min(d,l)).padStart(2,"0")}`; }

async function main() {
  const poupRes = await supabase.from("historico_poupanca_rendimento").select("data,rendimento_mensal").gte("data","2024-01-01").lte("data","2025-12-31").order("data");
  const pMap = new Map<string,number>();
  for (const r of poupRes.data!) pMap.set((r as any).data, (r as any).rendimento_mensal);

  // Test: lookup by anniversary date vs ciclo start
  for (const lookupMode of ["ciclo-start", "aniv-date"]) {
    const lotes: Lote[] = [
      { id:"A", app:"2024-01-02", diaAniv:2, valorAtual:100000, ultAniv:null, status:"ativo" },
      { id:"B", app:"2024-01-10", diaAniv:10, valorAtual:50000, ultAniv:null, status:"ativo" },
    ];

    const events: {date:string, type:string}[] = [];
    for (let y=2024;y<=2025;y++) for (let m=1;m<=12;m++) {
      for (const l of lotes) {
        const dt = getAnivDate(y,m,l.diaAniv);
        if (dt > l.app && dt <= "2025-12-30") events.push({date:dt, type:`aniv-${l.id}`});
      }
    }
    events.push({date:"2024-02-20", type:"resgate"});
    events.sort((a,b)=>a.date.localeCompare(b.date)||a.type.localeCompare(b.type));

    let diffLog: string[] = [];
    for (const ev of events) {
      if (ev.type.startsWith("aniv-")) {
        const lote = lotes.find(l=>l.id===ev.type.split("-")[1])!;
        if (lote.status!=="ativo"||ev.date<=(lote.ultAniv||lote.app)) continue;
        const cicloStart = lote.ultAniv || lote.app;
        const lookupDate = lookupMode === "ciclo-start" ? cicloStart : ev.date;
        const taxa = pMap.get(lookupDate);
        if (taxa === undefined) { lote.ultAniv = ev.date; continue; }
        const rend = Math.round(lote.valorAtual * (taxa / 100) * 1e8) / 1e8;
        lote.valorAtual += rend;
        lote.ultAniv = ev.date;
      } else {
        let rest = 80000;
        for (const l of lotes.sort((a,b)=>a.app.localeCompare(b.app))) {
          if (rest<=0||l.status!=="ativo") continue;
          if (rest >= l.valorAtual - 0.01) { rest -= l.valorAtual; l.valorAtual=0; l.status="resgatado"; }
          else { l.valorAtual -= rest; rest=0; }
        }
      }
    }
    const total = lotes.reduce((s,l)=>s+l.valorAtual,0);
    console.log(`${lookupMode}: Total=${total.toFixed(2)}, Diff=${(total-81166.42).toFixed(2)}`);
  }

  // Test: what if rendimento is rounded to centavos (2 dec) per lote
  {
    const lotes: Lote[] = [
      { id:"A", app:"2024-01-02", diaAniv:2, valorAtual:100000, ultAniv:null, status:"ativo" },
      { id:"B", app:"2024-01-10", diaAniv:10, valorAtual:50000, ultAniv:null, status:"ativo" },
    ];
    const events: {date:string, type:string}[] = [];
    for (let y=2024;y<=2025;y++) for (let m=1;m<=12;m++) {
      for (const l of lotes) { const dt=getAnivDate(y,m,l.diaAniv); if(dt>l.app&&dt<="2025-12-30") events.push({date:dt,type:`aniv-${l.id}`}); }
    }
    events.push({date:"2024-02-20", type:"resgate"});
    events.sort((a,b)=>a.date.localeCompare(b.date)||a.type.localeCompare(b.type));
    for (const ev of events) {
      if (ev.type.startsWith("aniv-")) {
        const lote = lotes.find(l=>l.id===ev.type.split("-")[1])!;
        if (lote.status!=="ativo"||ev.date<=(lote.ultAniv||lote.app)) continue;
        const cicloStart = lote.ultAniv || lote.app;
        const taxa = pMap.get(cicloStart);
        if (taxa===undefined) continue;
        const rend = Math.round(lote.valorAtual * (taxa/100) * 100) / 100; // 2 dec
        lote.valorAtual = Math.round((lote.valorAtual + rend) * 100) / 100; // round total too
        lote.ultAniv = ev.date;
      } else {
        let rest = 80000;
        for (const l of lotes.sort((a,b)=>a.app.localeCompare(b.app))) {
          if (rest<=0||l.status!=="ativo") continue;
          if (rest >= l.valorAtual - 0.01) { rest -= l.valorAtual; l.valorAtual=0; l.status="resgatado"; }
          else { l.valorAtual -= rest; rest=0; }
        }
      }
    }
    const total = lotes.reduce((s,l)=>s+l.valorAtual,0);
    console.log(`2dec-total-round: Total=${total.toFixed(2)}, Diff=${(total-81166.42).toFixed(2)}`);
  }

  // Test: What if Gorila truncates (floor) rendimento instead of rounding?
  {
    const lotes: Lote[] = [
      { id:"A", app:"2024-01-02", diaAniv:2, valorAtual:100000, ultAniv:null, status:"ativo" },
      { id:"B", app:"2024-01-10", diaAniv:10, valorAtual:50000, ultAniv:null, status:"ativo" },
    ];
    const events: {date:string, type:string}[] = [];
    for (let y=2024;y<=2025;y++) for (let m=1;m<=12;m++) {
      for (const l of lotes) { const dt=getAnivDate(y,m,l.diaAniv); if(dt>l.app&&dt<="2025-12-30") events.push({date:dt,type:`aniv-${l.id}`}); }
    }
    events.push({date:"2024-02-20", type:"resgate"});
    events.sort((a,b)=>a.date.localeCompare(b.date)||a.type.localeCompare(b.type));
    for (const ev of events) {
      if (ev.type.startsWith("aniv-")) {
        const lote = lotes.find(l=>l.id===ev.type.split("-")[1])!;
        if (lote.status!=="ativo"||ev.date<=(lote.ultAniv||lote.app)) continue;
        const cicloStart = lote.ultAniv || lote.app;
        const taxa = pMap.get(cicloStart);
        if (taxa===undefined) continue;
        const rend = Math.floor(lote.valorAtual * (taxa/100) * 100) / 100; // truncate to 2dec
        lote.valorAtual += rend;
        lote.ultAniv = ev.date;
      } else {
        let rest = 80000;
        for (const l of lotes.sort((a,b)=>a.app.localeCompare(b.app))) {
          if (rest<=0||l.status!=="ativo") continue;
          if (rest >= l.valorAtual - 0.01) { rest -= l.valorAtual; l.valorAtual=0; l.status="resgatado"; }
          else { l.valorAtual -= rest; rest=0; }
        }
      }
    }
    const total = lotes.reduce((s,l)=>s+l.valorAtual,0);
    console.log(`truncate-2dec: Total=${total.toFixed(2)}, Diff=${(total-81166.42).toFixed(2)}`);
  }
}
main().catch(console.error);

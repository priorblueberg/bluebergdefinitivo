import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Easter & Brazilian holidays ──────────────────────────────────────

function computeEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function getBrazilianHolidays(year: number): Set<string> {
  const holidays = new Set<string>();
  // Fixed holidays
  const fixed = [
    [1, 1], [4, 21], [5, 1], [9, 7], [10, 12],
    [11, 2], [11, 15], [11, 20], [12, 25],
  ];
  for (const [m, d] of fixed) {
    holidays.add(`${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  // Easter-dependent
  const easter = computeEaster(year);
  // Carnival: Mon + Tue before Ash Wednesday (47 and 46 days before Easter)
  holidays.add(toISO(addDays(easter, -48))); // Carnival Monday
  holidays.add(toISO(addDays(easter, -47))); // Carnival Tuesday
  holidays.add(toISO(addDays(easter, -2)));  // Good Friday
  holidays.add(toISO(addDays(easter, 60)));  // Corpus Christi
  return holidays;
}

// ── Main handler ─────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const results: Record<string, string> = {};

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── 1. CDI ───────────────────────────────────────────────────────
    try {
      // Get max date in table
      const { data: maxCdi } = await supabase
        .from("historico_cdi")
        .select("data")
        .order("data", { ascending: false })
        .limit(1)
        .single();

      const startDate = maxCdi
        ? addDays(new Date(maxCdi.data + "T12:00:00"), 1)
        : new Date(2024, 0, 2);

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      if (startDate <= yesterday) {
        const fmt = (d: Date) =>
          `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

        const bcbUrl = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.4389/dados?formato=json&dataInicial=${fmt(startDate)}&dataFinal=${fmt(yesterday)}`;
        console.log("Fetching CDI from BCB:", bcbUrl);

        const resp = await fetch(bcbUrl);
        if (!resp.ok) throw new Error(`BCB API error ${resp.status}`);

        const cdiData: { data: string; valor: string }[] = await resp.json();

        if (cdiData.length > 0) {
          const rows = cdiData.map((r) => {
            const [dd, mm, yyyy] = r.data.split("/");
            return {
              data: `${yyyy}-${mm}-${dd}`,
              taxa_anual: parseFloat(r.valor),
            };
          });

          const batchSize = 500;
          let inserted = 0;
          for (let i = 0; i < rows.length; i += batchSize) {
            const batch = rows.slice(i, i + batchSize);
            const { error } = await supabase
              .from("historico_cdi")
              .upsert(batch, { onConflict: "data" });
            if (error) throw new Error(`CDI insert: ${error.message}`);
            inserted += batch.length;
          }
          results.cdi = `Upserted ${inserted} CDI records`;
        } else {
          results.cdi = "No new CDI data";
        }
      } else {
        results.cdi = "CDI already up to date";
      }
    } catch (e) {
      results.cdi = `Error: ${e instanceof Error ? e.message : String(e)}`;
      console.error("CDI error:", e);
    }

    // ── 2. Ibovespa ──────────────────────────────────────────────────
    try {
      const { data: maxIbov } = await supabase
        .from("historico_ibovespa")
        .select("data")
        .order("data", { ascending: false })
        .limit(1)
        .single();

      const period1 = maxIbov
        ? Math.floor(new Date(maxIbov.data + "T12:00:00").getTime() / 1000)
        : 1704153600; // 02/01/2024

      const now = Math.floor(Date.now() / 1000);

      const url = `https://query1.finance.yahoo.com/v8/finance/chart/%5EBVSP?period1=${period1}&period2=${now}&interval=1d`;
      console.log("Fetching Ibovespa from Yahoo Finance...");

      const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Yahoo Finance error ${response.status}: ${text}`);
      }

      const data = await response.json();
      const result = data.chart?.result?.[0];

      if (!result) throw new Error("No data from Yahoo Finance");

      const timestamps = result.timestamp;
      const closes = result.indicators?.quote?.[0]?.close;

      if (timestamps && closes) {
        const rows: { data: string; pontos: number }[] = [];
        for (let i = 0; i < timestamps.length; i++) {
          if (closes[i] == null) continue;
          const date = new Date(timestamps[i] * 1000);
          rows.push({
            data: toISO(date),
            pontos: Math.round(closes[i] * 100) / 100,
          });
        }

        const batchSize = 500;
        let inserted = 0;
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          const { error } = await supabase
            .from("historico_ibovespa")
            .upsert(batch, { onConflict: "data" });
          if (error) throw new Error(`Ibovespa insert: ${error.message}`);
          inserted += batch.length;
        }
        results.ibovespa = `Upserted ${inserted} Ibovespa records`;
      } else {
        results.ibovespa = "No timestamp/close data";
      }
    } catch (e) {
      results.ibovespa = `Error: ${e instanceof Error ? e.message : String(e)}`;
      console.error("Ibovespa error:", e);
    }

    // ── 3. Calendário Dias Úteis ─────────────────────────────────────
    try {
      // Get max date in calendar
      const { data: maxCal } = await supabase
        .from("calendario_dias_uteis")
        .select("data")
        .order("data", { ascending: false })
        .limit(1)
        .single();

      const today = new Date();
      const endYear = today.getFullYear() + 1;
      const endDate = new Date(endYear, 11, 31);

      const startCal = maxCal
        ? addDays(new Date(maxCal.data + "T12:00:00"), 1)
        : new Date(2024, 0, 1);

      if (startCal <= endDate) {
        // Collect holidays for all relevant years
        const allHolidays = new Set<string>();
        for (let y = startCal.getFullYear(); y <= endYear; y++) {
          getBrazilianHolidays(y).forEach((h) => allHolidays.add(h));
        }

        const rows: { data: string; dia_util: boolean }[] = [];
        const cursor = new Date(startCal);
        while (cursor <= endDate) {
          const iso = toISO(cursor);
          const dow = cursor.getDay(); // 0=Sun, 6=Sat
          const isWeekday = dow >= 1 && dow <= 5;
          const isHoliday = allHolidays.has(iso);
          rows.push({ data: iso, dia_util: isWeekday && !isHoliday });
          cursor.setDate(cursor.getDate() + 1);
        }

        const batchSize = 500;
        let inserted = 0;
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          const { error } = await supabase
            .from("calendario_dias_uteis")
            .upsert(batch, { onConflict: "data" });
          if (error) throw new Error(`Calendar insert: ${error.message}`);
          inserted += batch.length;
        }
        results.calendario = `Upserted ${inserted} calendar records through ${endYear}`;
      } else {
        results.calendario = "Calendar already up to date";
      }
    } catch (e) {
      results.calendario = `Error: ${e instanceof Error ? e.message : String(e)}`;
      console.error("Calendar error:", e);
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Fatal error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        results,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

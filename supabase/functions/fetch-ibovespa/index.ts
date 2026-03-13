import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 02/01/2024 00:00:00 UTC
    const period1 = 1704153600;
    const now = Math.floor(Date.now() / 1000);

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/%5EBVSP?period1=${period1}&period2=${now}&interval=1d`;

    console.log("Fetching Ibovespa data from Yahoo Finance...");

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Yahoo Finance API error ${response.status}: ${text}`);
    }

    const data = await response.json();
    const result = data.chart?.result?.[0];

    if (!result) {
      throw new Error("No data returned from Yahoo Finance");
    }

    const timestamps = result.timestamp;
    const closes = result.indicators?.quote?.[0]?.close;

    if (!timestamps || !closes) {
      throw new Error("Missing timestamp or close data");
    }

    // Build rows
    const rows: { data: string; pontos: number }[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const close = closes[i];
      if (close == null) continue;

      const date = new Date(timestamps[i] * 1000);
      const dateStr = date.toISOString().split("T")[0];
      rows.push({ data: dateStr, pontos: Math.round(close * 100) / 100 });
    }

    console.log(`Parsed ${rows.length} data points`);

    // Delete existing data and insert fresh
    await supabase.from("historico_ibovespa").delete().gte("data", "2024-01-01");

    // Insert in batches of 500
    const batchSize = 500;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { error } = await supabase.from("historico_ibovespa").insert(batch);
      if (error) {
        throw new Error(`Insert error: ${error.message}`);
      }
      inserted += batch.length;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Inserted ${inserted} Ibovespa data points from ${rows[0]?.data} to ${rows[rows.length - 1]?.data}`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

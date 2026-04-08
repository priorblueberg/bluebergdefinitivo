/**
 * Helper to fetch IPCA records for the rendaFixaEngine.
 * Used by all pages that call calcularRendaFixaDiario for IPCA products.
 */
import { supabase } from "@/integrations/supabase/client";

export interface IpcaRecord {
  competencia: string;
  fator_mensal: number;
}

/**
 * Fetch IPCA data (official + projections) for a date range.
 * Returns undefined if indexador is not IPCA.
 */
export async function fetchIpcaRecords(
  indexador: string | null | undefined,
  dataInicio: string,
  dataFim: string
): Promise<IpcaRecord[] | undefined> {
  if (indexador !== "IPCA") return undefined;

  const startMonth = dataInicio.substring(0, 7) + "-01";
  const endMonth = dataFim.substring(0, 7) + "-01";

  const [oficialRes, projecaoRes] = await Promise.all([
    supabase
      .from("historico_ipca")
      .select("competencia, fator_mensal")
      .gte("competencia", startMonth)
      .lte("competencia", endMonth)
      .order("competencia"),
    supabase
      .from("historico_ipca_projecao")
      .select("competencia, fator_projetado")
      .gte("competencia", startMonth)
      .lte("competencia", endMonth)
      .order("competencia"),
  ]);

  const records: IpcaRecord[] = (oficialRes.data || []).map((r: any) => ({
    competencia: r.competencia,
    fator_mensal: Number(r.fator_mensal),
  }));

  // Fill in projections for months without official data
  if (projecaoRes.data) {
    const oficialSet = new Set(records.map((r) => r.competencia));
    for (const p of projecaoRes.data) {
      if (!oficialSet.has(p.competencia)) {
        records.push({
          competencia: p.competencia,
          fator_mensal: Number(p.fator_projetado),
        });
      }
    }
    records.sort((a, b) => a.competencia.localeCompare(b.competencia));
  }

  return records.length > 0 ? records : undefined;
}

/**
 * Batch fetch IPCA records for multiple products.
 * Returns a single array covering the full date range if any product uses IPCA.
 */
export async function fetchIpcaRecordsBatch(
  products: { indexador?: string | null; data_inicio: string }[],
  dataFim: string
): Promise<IpcaRecord[] | undefined> {
  const hasIpca = products.some((p) => p.indexador === "IPCA");
  if (!hasIpca) return undefined;

  const minDate = products
    .filter((p) => p.indexador === "IPCA")
    .reduce((min, p) => (p.data_inicio < min ? p.data_inicio : min), "9999-12-31");

  return fetchIpcaRecords("IPCA", minDate, dataFim);
}

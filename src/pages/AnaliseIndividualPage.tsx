import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDataReferencia } from "@/contexts/DataReferenciaContext";
import { Search, ChevronUp, ChevronDown, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  buildCdiSeries,
  CdiRecord, DiaUtilRecord,
} from "@/lib/cdiCalculations";
import { calcularRendaFixaDiario, DailyRow } from "@/lib/rendaFixaEngine";
import RentabilidadeDetailTable, { DetailRow } from "@/components/RentabilidadeDetailTable";
import MovimentacoesAtivo from "@/components/MovimentacoesAtivo";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

interface CustodiaProduct {
  id: string;
  nome: string | null;
  codigo_custodia: number;
  data_inicio: string;
  data_calculo: string | null;
  data_limite: string | null;
  valor_investido: number;
  taxa: number | null;
  indexador: string | null;
  vencimento: string | null;
  modalidade: string | null;
  categoria_nome: string;
  produto_nome: string;
  instituicao_nome: string;
  resgate_total: string | null;
  preco_unitario: number | null;
  pagamento: string | null;
}

type SortKey = "nome" | "categoria_nome" | "produto_nome" | "instituicao_nome";
type SortDir = "asc" | "desc";

const CustomTooltipChart = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-sm">
        <p className="text-foreground font-medium mb-1">{label}</p>
        {payload.map((entry: any) => (
          <p key={entry.dataKey} style={{ color: entry.color }} className="font-semibold">
            {entry.name}: {entry.value?.toFixed(2)}%
          </p>
        ))}
      </div>
    );
  }
  return null;
};

/* ── helper: derive DetailRow[] from engine DailyRow[] + CDI records ── */

function calcFatorDiarioCdi(taxaAnual: number): number {
  return Math.pow(taxaAnual / 100 + 1, 1 / 252) - 1;
}

function buildDetailRowsFromEngine(
  dailyRows: DailyRow[],
  cdiRecords: CdiRecord[],
  dataInicio: string,
): DetailRow[] {
  if (dailyRows.length === 0) return [];

  // CDI factor tracking
  const cdiMap = new Map<string, CdiRecord>();
  cdiRecords.forEach(r => cdiMap.set(r.data, r));

  let cdiFatorMensal = 1;
  let cdiFatorAnual = 1;

  let currentMonth = -1;
  let currentYear = -1;

  // Aggregation maps
  const rentMonthly = new Map<number, Map<number, number>>();
  const cdiMonthly = new Map<number, Map<number, number>>();
  const patrimonioMonthly = new Map<number, Map<number, number>>();
  const ganhoMensalMonthly = new Map<number, Map<number, number>>();
  const ganhoAnualMap = new Map<number, number>();
  const rentYearly = new Map<number, number>();
  const cdiYearly = new Map<number, number>();

  let rentFatorMensal = 1;
  let rentFatorAnual = 1;

  let patrimonioFimMesAnterior = 0;
  let patrimonioInicioAno = 0;
  let aplicacoesMes = 0;
  let resgatesMes = 0;
  let aplicacoesAno = 0;
  let resgatesAno = 0;

  for (const row of dailyRows) {
    // Skip the initial day (day before data_inicio with saldoCotas=0)
    if (row.saldoCotas === 0 && row.liquido === 0) continue;

    const dt = new Date(row.data + "T00:00:00");
    const m = dt.getMonth();
    const y = dt.getFullYear();

    if (currentMonth === -1) {
      currentMonth = m;
      currentYear = y;
      patrimonioFimMesAnterior = 0;
      patrimonioInicioAno = 0;
      aplicacoesMes = 0;
      resgatesMes = 0;
      aplicacoesAno = 0;
      resgatesAno = 0;
    } else if (m !== currentMonth) {
      patrimonioFimMesAnterior = (() => {
        const pMap = patrimonioMonthly.get(currentYear);
        return pMap?.get(currentMonth) ?? row.liquido;
      })();
      rentFatorMensal = 1;
      cdiFatorMensal = 1;
      aplicacoesMes = 0;
      resgatesMes = 0;
      currentMonth = m;
      if (y !== currentYear) {
        patrimonioInicioAno = patrimonioFimMesAnterior;
        rentFatorAnual = 1;
        cdiFatorAnual = 1;
        aplicacoesAno = 0;
        resgatesAno = 0;
        currentYear = y;
      }
    }

    // Accumulate flows
    aplicacoesMes += row.aplicacoes;
    resgatesMes += row.resgates;
    aplicacoesAno += row.aplicacoes;
    resgatesAno += row.resgates;

    // Titulo/rent factor from engine's rentabilidadeDiaria
    if (row.rentabilidadeDiaria !== null && row.rentabilidadeDiaria !== 0) {
      rentFatorMensal *= 1 + row.rentabilidadeDiaria;
      rentFatorAnual *= 1 + row.rentabilidadeDiaria;
    }

    // CDI factor
    const cdiRec = cdiMap.get(row.data);
    if (cdiRec && row.diaUtil) {
      const fd = calcFatorDiarioCdi(cdiRec.taxa_anual);
      cdiFatorMensal *= 1 + fd;
      cdiFatorAnual *= 1 + fd;
    }

    // Store monthly values
    if (!rentMonthly.has(y)) rentMonthly.set(y, new Map());
    rentMonthly.get(y)!.set(m, (rentFatorMensal - 1) * 100);

    if (!cdiMonthly.has(y)) cdiMonthly.set(y, new Map());
    cdiMonthly.get(y)!.set(m, (cdiFatorMensal - 1) * 100);

    if (!patrimonioMonthly.has(y)) patrimonioMonthly.set(y, new Map());
    patrimonioMonthly.get(y)!.set(m, row.liquido);

    // Ganho Financeiro = variação do patrimônio - fluxos líquidos (aplicações - resgates)
    if (!ganhoMensalMonthly.has(y)) ganhoMensalMonthly.set(y, new Map());
    ganhoMensalMonthly.get(y)!.set(m, row.liquido - patrimonioFimMesAnterior - aplicacoesMes + resgatesMes);

    ganhoAnualMap.set(y, row.liquido - patrimonioInicioAno - aplicacoesAno + resgatesAno);
    rentYearly.set(y, (rentFatorAnual - 1) * 100);
    cdiYearly.set(y, (cdiFatorAnual - 1) * 100);
  }

  // Build DetailRow[] per year
  const years = Array.from(new Set([...rentMonthly.keys(), ...cdiMonthly.keys()])).sort();
  const rows: DetailRow[] = [];
  let rentFatorAcum = 1;
  let cdiFatorAcumRows = 1;

  // Total flows for ganho acumulado
  const totalAplicacoes = dailyRows.reduce((sum, r) => sum + r.aplicacoes, 0);
  const totalResgates = dailyRows.reduce((sum, r) => sum + r.resgates, 0);

  for (const year of years) {
    const tMap = rentMonthly.get(year);
    const cMap = cdiMonthly.get(year);
    const pMap = patrimonioMonthly.get(year);
    const gMap = ganhoMensalMonthly.get(year);

    const patrimonioMs: (number | null)[] = [];
    const ganhoMs: (number | null)[] = [];
    const rentMs: (number | null)[] = [];
    const cdiMs: (number | null)[] = [];

    for (let mm = 0; mm < 12; mm++) {
      if (tMap?.has(mm)) {
        const pct = tMap.get(mm)!;
        rentMs.push(parseFloat(pct.toFixed(2)));
        rentFatorAcum *= 1 + pct / 100;
      } else {
        rentMs.push(null);
      }
      if (cMap?.has(mm)) {
        const pct = cMap.get(mm)!;
        cdiMs.push(parseFloat(pct.toFixed(2)));
        cdiFatorAcumRows *= 1 + pct / 100;
      } else {
        cdiMs.push(null);
      }
      patrimonioMs.push(pMap?.has(mm) ? parseFloat(pMap.get(mm)!.toFixed(2)) : null);
      ganhoMs.push(gMap?.has(mm) ? parseFloat(gMap.get(mm)!.toFixed(2)) : null);
    }

    // Ganho acumulado: usar diretamente o valor do engine
    // Use the very last engine row (don't filter out resgate day where liquido=0)
    const lastRow = dailyRows.length > 0 ? dailyRows[dailyRows.length - 1] : null;
    const ganhoAcum = lastRow ? parseFloat(lastRow.ganhoAcumulado.toFixed(2)) : null;

    rows.push({
      year,
      patrimonioMonths: patrimonioMs,
      ganhoFinanceiroMonths: ganhoMs,
      rentabilidadeMonths: rentMs,
      cdiMonths: cdiMs,
      rentNoAno: rentYearly.has(year) ? parseFloat(rentYearly.get(year)!.toFixed(2)) : null,
      rentAcumulado: parseFloat(((rentFatorAcum - 1) * 100).toFixed(2)),
      cdiNoAno: cdiYearly.has(year) ? parseFloat(cdiYearly.get(year)!.toFixed(2)) : null,
      cdiAcumulado: parseFloat(((cdiFatorAcumRows - 1) * 100).toFixed(2)),
      ganhoNoAno: ganhoAnualMap.has(year) ? parseFloat(ganhoAnualMap.get(year)!.toFixed(2)) : null,
      ganhoAcumulado: ganhoAcum,
    });
  }

  return rows.reverse();
}
function getDateMinus(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function ProductDetail({ product, onBack }: { product: CustodiaProduct; onBack: () => void }) {
  const { appliedVersion, dataReferenciaISO, dataReferencia } = useDataReferencia();
  const [cdiRecords, setCdiRecords] = useState<CdiRecord[]>([]);
  const [diasUteis, setDiasUteis] = useState<DiaUtilRecord[]>([]);
  const [engineRows, setEngineRows] = useState<DailyRow[]>([]);
  const [loading, setLoading] = useState(true);

  const isPrefixado = product.categoria_nome === "Renda Fixa" && product.modalidade === "Prefixado";

  useEffect(() => {
    (async () => {
      setLoading(true);
      const endDate = product.data_calculo || "2099-12-31";

      // Fetch CDI, dias_uteis, and movimentacoes in parallel
      const [cdiRes, diasRes, movsRes] = await Promise.all([
        supabase
          .from("historico_cdi")
          .select("data, taxa_anual")
          .gte("data", product.data_inicio)
          .lte("data", endDate)
          .order("data"),
        supabase
          .from("calendario_dias_uteis")
          .select("data, dia_util")
          .gte("data", getDateMinus(product.data_inicio, 5))
          .lte("data", endDate)
          .order("data"),
        supabase
          .from("movimentacoes")
          .select("data, tipo_movimentacao, valor")
          .eq("codigo_custodia", product.codigo_custodia)
          .order("data"),
      ]);

      const diasData = (diasRes.data || []).map((d: any) => ({ data: d.data, dia_util: d.dia_util }));
      const diasMap = new Map<string, boolean>();
      diasData.forEach((d) => diasMap.set(d.data, d.dia_util));

      const merged: CdiRecord[] = (cdiRes.data || []).map((r: any) => ({
        data: r.data,
        taxa_anual: r.taxa_anual,
        dia_util: diasMap.get(r.data) ?? true,
      }));

      setCdiRecords(merged);
      setDiasUteis(diasData);

      // Run engine for Prefixado
      if (isPrefixado) {
        const rows = calcularRendaFixaDiario({
          dataInicio: product.data_inicio,
          dataCalculo: endDate,
          taxa: product.taxa || 0,
          modalidade: product.modalidade || "Prefixado",
          puInicial: product.preco_unitario || 1000,
          calendario: diasData.map(d => ({ data: d.data, dia_util: d.dia_util })),
          movimentacoes: (movsRes.data || []).map((m: any) => ({
            data: m.data,
            tipo_movimentacao: m.tipo_movimentacao,
            valor: m.valor,
          })),
          dataResgateTotal: product.resgate_total,
          pagamento: product.pagamento,
          vencimento: product.vencimento,
        });
        setEngineRows(rows);
      }

      setLoading(false);
    })();
  }, [product, appliedVersion]);

  // Chart data: merge both series
  const chartData = useMemo(() => {
    const cdiSeries = buildCdiSeries(cdiRecords, product.data_inicio, product.data_calculo || undefined);

    if (isPrefixado && engineRows.length > 0) {
      // Build titulo_acumulado from engine's rentabilidadeDiaria
      let fatorAcum = 1;
      const enginePoints: { data: string; label: string; titulo_acumulado: number }[] = [];
      for (const row of engineRows) {
        if (row.saldoCotas === 0 && row.liquido === 0) {
          enginePoints.push({
            data: row.data,
            label: new Date(row.data + "T00:00:00").toLocaleDateString("pt-BR"),
            titulo_acumulado: 0,
          });
          continue;
        }
        if (row.rentabilidadeDiaria !== null && row.rentabilidadeDiaria !== 0) {
          fatorAcum *= 1 + row.rentabilidadeDiaria;
        }
        enginePoints.push({
          data: row.data,
          label: new Date(row.data + "T00:00:00").toLocaleDateString("pt-BR"),
          titulo_acumulado: parseFloat(((fatorAcum - 1) * 100).toFixed(4)),
        });
      }

      // Merge by date
      const map = new Map<string, any>();
      for (const p of cdiSeries) {
        map.set(p.data, { data: p.data, label: p.label, cdi_acumulado: p.cdi_acumulado });
      }
      for (const p of enginePoints) {
        const existing = map.get(p.data) || { data: p.data, label: p.label };
        existing.titulo_acumulado = p.titulo_acumulado;
        existing.label = existing.label || p.label;
        map.set(p.data, existing);
      }
      return Array.from(map.values()).sort((a, b) => a.data.localeCompare(b.data));
    }

    // Non-prefixado: titulo = CDI
    return cdiSeries.map(p => ({
      ...p,
      titulo_acumulado: p.cdi_acumulado,
    }));
  }, [cdiRecords, engineRows, product, isPrefixado]);

  // Detail table rows
  const detailRows = useMemo(() => {
    if (isPrefixado && engineRows.length > 0) {
      return buildDetailRowsFromEngine(engineRows, cdiRecords, product.data_inicio);
    }
    // Fallback for non-prefixado: simple CDI-based detail rows
    // (reuse legacy inline logic or return empty for now)
    return buildDetailRowsFromEngine([], cdiRecords, product.data_inicio);
  }, [cdiRecords, engineRows, product, isPrefixado]);

  const tituloLabel = "Rentabilidade";

  const fmtDate = (d: string | null) =>
    d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  const isBeforeStart = dataReferenciaISO < product.data_inicio;

  // Status logic: "Em custódia" if ref date < resgate_total AND > data_inicio
  const isEmCustodia = !isBeforeStart && (
    !product.resgate_total || dataReferenciaISO < product.resgate_total
  );

  const fmtDateShort = (d: Date) => d.toLocaleDateString("pt-BR");

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft size={16} />
          Voltar para lista de produtos
        </button>
        <div className="flex items-start gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              {product.nome || product.produto_nome}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Período: {fmtDate(product.data_inicio)} a {fmtDate(product.data_calculo)}
            </p>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-muted-foreground">Status em {fmtDateShort(dataReferencia)}</span>
            <Badge variant={isEmCustodia ? "default" : "secondary"} className={isEmCustodia ? "bg-emerald-600 hover:bg-emerald-600 text-white" : "bg-muted text-muted-foreground"}>
              {isBeforeStart ? "Não iniciado" : isEmCustodia ? "Em custódia" : "Liquidado"}
            </Badge>
          </div>
        </div>
      </div>

      {isBeforeStart ? (
        <div className="flex items-center justify-center py-20 rounded-lg border border-border bg-muted/50">
          <p className="text-muted-foreground text-sm">Data de consulta anterior ao início do investimento</p>
        </div>
      ) : (
        <>
          {/* Summary cards at data_calculo */}
          {detailRows.length > 0 && (() => {
            const topRow = detailRows[0];
            // Use engine row at dataReferenciaISO for accurate patrimônio
            let lastPatrimonio: number | null = null;
            if (isPrefixado && engineRows.length > 0) {
              const refRow = engineRows.filter(r => r.data <= dataReferenciaISO).pop();
              lastPatrimonio = refRow ? refRow.liquido : null;
            } else {
              for (let m = 11; m >= 0; m--) {
                if (topRow.patrimonioMonths[m] !== null) { lastPatrimonio = topRow.patrimonioMonths[m]; break; }
              }
            }
            const ganho = topRow.ganhoAcumulado;
            const rent = topRow.rentAcumulado;
            const cdiAcum = topRow.cdiAcumulado;
            const pctSobreCdi = rent != null && cdiAcum != null && cdiAcum !== 0
              ? parseFloat(((rent / cdiAcum) * 100).toFixed(2)) : null;

            const fmtBrlCard = (v: number | null) =>
              v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";
            const fmtPctCard = (v: number | null) =>
              v != null ? `${v.toFixed(2)}%` : "—";

            const cards = [
              { label: "Patrimônio", value: fmtBrlCard(lastPatrimonio), color: "text-foreground" },
              { label: "Ganho Financeiro", value: fmtBrlCard(ganho), color: "text-foreground" },
              { label: "Rentabilidade", value: fmtPctCard(rent), color: "text-foreground" },
              { label: "CDI Acumulado", value: fmtPctCard(cdiAcum), color: "text-foreground" },
            ];

            return (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {cards.map((c) => (
                  <div key={c.label} className="rounded-lg border border-border bg-card p-4 shadow-sm">
                    <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
                    <p className={`text-lg font-semibold ${c.color}`}>{c.value}</p>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Charts side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Line chart */}
            <div className="rounded-md border border-border bg-card p-6">
              <h2 className="text-sm font-semibold text-foreground">
                Histórico de Rentabilidade
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">Variação acumulada (%) no período</p>
              <div className="mt-4 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                      tickLine={false}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip content={<CustomTooltipChart />} />
                    <Legend iconType="plainline" wrapperStyle={{ fontSize: 11 }} />
                    <Line
                      type="monotone"
                      dataKey="titulo_acumulado"
                      name={tituloLabel}
                      stroke="hsl(210, 100%, 45%)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="cdi_acumulado"
                      name="CDI"
                      stroke="hsl(0, 0%, 55%)"
                      strokeWidth={1.5}
                      dot={false}
                      activeDot={{ r: 3, strokeWidth: 0 }}
                      strokeDasharray="5 3"
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bar chart — Patrimônio Mensal */}
            <div className="rounded-md border border-border bg-card p-6">
              <h2 className="text-sm font-semibold text-foreground">
                Patrimônio Mensal
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">Evolução do patrimônio por mês (R$)</p>
              <div className="mt-4 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={(() => {
                    const MONTH_LABELS = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
                    const barData: { mes: string; patrimonio: number }[] = [];
                    const chronRows = [...detailRows].reverse();
                    for (const row of chronRows) {
                      for (let m = 0; m < 12; m++) {
                        if (row.patrimonioMonths[m] !== null) {
                          barData.push({
                            mes: `${MONTH_LABELS[m]}/${String(row.year).slice(2)}`,
                            patrimonio: row.patrimonioMonths[m]!,
                          });
                        }
                      }
                    }
                    return barData;
                  })()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="mes"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                      tickLine={false}
                      tickFormatter={(v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                    />
                    <Tooltip
                      formatter={(value: number) => [value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), "Patrimônio"]}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                      labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                    />
                    <Bar dataKey="patrimonio" name="Patrimônio" fill="hsl(210, 100%, 45%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Detail tables — one per year */}
          <RentabilidadeDetailTable rows={detailRows} tituloLabel={tituloLabel} />

          {/* Movimentações do ativo */}
          <MovimentacoesAtivo codigoCustodia={product.codigo_custodia} />
        </>
      )}
    </div>
  );
}

export default function AnaliseIndividualPage() {
  const [products, setProducts] = useState<CustodiaProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("nome");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedProduct, setSelectedProduct] = useState<CustodiaProduct | null>(null);
  const { appliedVersion } = useDataReferencia();

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("custodia")
        .select("id, nome, codigo_custodia, data_inicio, data_calculo, data_limite, valor_investido, taxa, indexador, vencimento, modalidade, preco_unitario, categoria_id, produto_id, instituicao_id, resgate_total, pagamento, produtos(nome), instituicoes(nome), categorias(nome)");

      if (data) {
        const mapped: CustodiaProduct[] = data.map((row: any) => ({
          id: row.id,
          nome: row.nome,
          codigo_custodia: row.codigo_custodia,
          data_inicio: row.data_inicio,
          data_calculo: row.data_calculo,
          data_limite: row.data_limite,
          valor_investido: row.valor_investido,
          taxa: row.taxa,
          indexador: row.indexador,
          vencimento: row.vencimento,
          modalidade: row.modalidade,
          categoria_nome: row.categorias?.nome || "—",
          produto_nome: row.produtos?.nome || "—",
          instituicao_nome: row.instituicoes?.nome || "—",
          resgate_total: row.resgate_total,
          preco_unitario: row.preco_unitario,
          pagamento: row.pagamento,
        }));
        setProducts(mapped);

        // Update selectedProduct with fresh data if it exists
        if (selectedProduct) {
          const updated = mapped.find(p => p.id === selectedProduct.id);
          if (updated) setSelectedProduct(updated);
        }
      }
      setLoading(false);
    })();
  }, [appliedVersion]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter(
      (p) =>
        (p.nome || "").toLowerCase().includes(q) ||
        p.produto_nome.toLowerCase().includes(q) ||
        p.categoria_nome.toLowerCase().includes(q) ||
        p.instituicao_nome.toLowerCase().includes(q)
    );
  }, [products, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const valA = (a[sortKey] || "").toLowerCase();
      const valB = (b[sortKey] || "").toLowerCase();
      const cmp = valA.localeCompare(valB, "pt-BR");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  if (selectedProduct) {
    return <ProductDetail product={selectedProduct} onBack={() => setSelectedProduct(null)} />;
  }

  const columns: { key: SortKey; label: string }[] = [
    { key: "nome", label: "Nome" },
    { key: "produto_nome", label: "Tipo de Produto" },
    { key: "categoria_nome", label: "Carteira" },
    { key: "instituicao_nome", label: "Instituição" },
  ];

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronUp size={12} className="ml-1 opacity-40" />;
    return sortDir === "asc" ? <ChevronUp size={12} className="ml-1" /> : <ChevronDown size={12} className="ml-1" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Análise Individual por Produto</h1>
        <p className="mt-1 text-xs text-muted-foreground">Consulte informações detalhadas de cada produto</p>
      </div>

      <div className="space-y-2">
        <span className="text-sm font-medium text-foreground">Buscar Produto</span>
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Digite o nome ou ticker do produto..."
            className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Produtos Encontrados ({sorted.length})</h2>
        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primary text-primary-foreground">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="px-4 py-2.5 text-left font-medium cursor-pointer select-none hover:bg-primary/90 transition-colors"
                    onClick={() => handleSort(col.key)}
                  >
                    <span className="inline-flex items-center">
                      {col.label}
                      <SortIcon col={col.key} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => (
                <tr
                  key={row.id}
                  onClick={() => setSelectedProduct(row)}
                  className={`border-t border-border cursor-pointer ${i % 2 === 0 ? "bg-card" : "bg-muted/30"} hover:bg-accent/50 transition-colors`}
                >
                  <td className="px-4 py-2.5 text-foreground font-medium">{row.nome || row.produto_nome}</td>
                  <td className="px-4 py-2.5 text-foreground">{row.produto_nome}</td>
                  <td className="px-4 py-2.5 text-foreground">{row.categoria_nome}</td>
                  <td className="px-4 py-2.5 text-foreground">{row.instituicao_nome}</td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum produto encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

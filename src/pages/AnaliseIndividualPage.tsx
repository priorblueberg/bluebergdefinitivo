import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDataReferencia } from "@/contexts/DataReferenciaContext";
import { Search, ChevronUp, ChevronDown, ArrowLeft } from "lucide-react";
import {
  buildCdiSeries, buildRentabilidadeRows,
  buildPrefixadoSeries, buildPrefixadoRentabilidadeRows,
  CdiRecord, DiaUtilRecord,
} from "@/lib/cdiCalculations";
import RentabilidadeDetailTable, { DetailRow } from "@/components/RentabilidadeDetailTable";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
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

/* ── helpers to compute patrimônio from valor_investido + monthly returns ── */

function calcFatorDiarioPre(taxaAnual: number): number {
  return Math.pow(taxaAnual / 100 + 1, 1 / 252) - 1;
}

function calcFatorDiarioCdi(taxaAnual: number): number {
  return Math.pow(taxaAnual / 100 + 1, 1 / 252) - 1;
}

function buildDetailRows(
  cdiRecords: CdiRecord[],
  diasUteis: DiaUtilRecord[],
  isPrefixado: boolean,
  taxaAnual: number,
  valorInvestido: number,
  dataInicio: string,
  dataCalculo?: string,
): DetailRow[] {
  // We need to iterate day-by-day and track:
  // - prefixado/titulo accumulated factor (monthly, yearly, total)
  // - CDI accumulated factor (monthly, yearly, total)
  // - patrimonio at end of each month

  const endDate = dataCalculo || "2099-12-31";

  // Build a combined day-by-day list
  // For prefixado: use diasUteis for titulo calc, cdiRecords for CDI calc
  // For CDI-only: both come from cdiRecords

  // Collect all dates
  const allDatesSet = new Set<string>();
  cdiRecords.forEach(r => { if (r.data <= endDate) allDatesSet.add(r.data); });
  diasUteis.forEach(r => { if (r.data <= endDate) allDatesSet.add(r.data); });
  const allDates = Array.from(allDatesSet).sort();

  if (allDates.length === 0) return [];

  // Maps for quick lookup
  const cdiMap = new Map<string, CdiRecord>();
  cdiRecords.forEach(r => cdiMap.set(r.data, r));
  const duMap = new Map<string, boolean>();
  diasUteis.forEach(r => duMap.set(r.data, r.dia_util));

  // Tracking variables
  let tituloFatorAcum = 1;
  let tituloFatorMensal = 1;
  let tituloFatorAnual = 1;
  let cdiFatorAcum = 1;
  let cdiFatorMensal = 1;
  let cdiFatorAnual = 1;

  let currentMonth = -1;
  let currentYear = -1;

  // year -> month(0-11) -> values
  const tituloMonthly = new Map<number, Map<number, number>>();
  const cdiMonthly = new Map<number, Map<number, number>>();
  const patrimonioMonthly = new Map<number, Map<number, number>>();
  const tituloYearly = new Map<number, number>();
  const cdiYearly = new Map<number, number>();

  const fatorDiarioPre = isPrefixado ? calcFatorDiarioPre(taxaAnual) : 0;

  for (const dateStr of allDates) {
    const dt = new Date(dateStr + "T00:00:00");
    const m = dt.getMonth();
    const y = dt.getFullYear();

    if (currentMonth === -1) {
      currentMonth = m;
      currentYear = y;
    } else if (m !== currentMonth) {
      tituloFatorMensal = 1;
      cdiFatorMensal = 1;
      currentMonth = m;
      if (y !== currentYear) {
        tituloFatorAnual = 1;
        cdiFatorAnual = 1;
        currentYear = y;
      }
    }

    // Titulo factor — prefixado não rentabiliza no D0 (dia da aplicação)
    if (isPrefixado) {
      const isDiaUtil = duMap.get(dateStr) ?? cdiMap.get(dateStr)?.dia_util ?? false;
      if (isDiaUtil && dateStr !== dataInicio) {
        tituloFatorAcum *= 1 + fatorDiarioPre;
        tituloFatorMensal *= 1 + fatorDiarioPre;
        tituloFatorAnual *= 1 + fatorDiarioPre;
      }
    } else {
      // For non-prefixado, titulo = CDI (same values)
      const cdiRec = cdiMap.get(dateStr);
      if (cdiRec && cdiRec.dia_util) {
        const fd = calcFatorDiarioCdi(cdiRec.taxa_anual);
        tituloFatorAcum *= 1 + fd;
        tituloFatorMensal *= 1 + fd;
        tituloFatorAnual *= 1 + fd;
      }
    }

    // CDI factor (always from cdiRecords)
    const cdiRec = cdiMap.get(dateStr);
    if (cdiRec && cdiRec.dia_util) {
      const fd = calcFatorDiarioCdi(cdiRec.taxa_anual);
      cdiFatorAcum *= 1 + fd;
      cdiFatorMensal *= 1 + fd;
      cdiFatorAnual *= 1 + fd;
    }

    // Store latest values for this month
    if (!tituloMonthly.has(y)) tituloMonthly.set(y, new Map());
    tituloMonthly.get(y)!.set(m, (tituloFatorMensal - 1) * 100);

    if (!cdiMonthly.has(y)) cdiMonthly.set(y, new Map());
    cdiMonthly.get(y)!.set(m, (cdiFatorMensal - 1) * 100);

    if (!patrimonioMonthly.has(y)) patrimonioMonthly.set(y, new Map());
    patrimonioMonthly.get(y)!.set(m, valorInvestido * tituloFatorAcum);

    tituloYearly.set(y, (tituloFatorAnual - 1) * 100);
    cdiYearly.set(y, (cdiFatorAnual - 1) * 100);
  }

  // Build rows per year (most recent first)
  const years = Array.from(new Set([
    ...tituloMonthly.keys(), ...cdiMonthly.keys(),
  ])).sort((a, b) => b - a);

  const rows: DetailRow[] = [];
  let rentFatorAcum = 1;
  let cdiFatorAcumRows = 1;

  for (const year of years) {
    const tMap = tituloMonthly.get(year);
    const cMap = cdiMonthly.get(year);
    const pMap = patrimonioMonthly.get(year);

    const patrimonioMs: (number | null)[] = [];
    const rentMs: (number | null)[] = [];
    const cdiMs: (number | null)[] = [];

    for (let m = 0; m < 12; m++) {
      if (tMap?.has(m)) {
        const pct = tMap.get(m)!;
        rentMs.push(parseFloat(pct.toFixed(2)));
        rentFatorAcum *= 1 + pct / 100;
      } else {
        rentMs.push(null);
      }

      if (cMap?.has(m)) {
        const pct = cMap.get(m)!;
        cdiMs.push(parseFloat(pct.toFixed(2)));
        cdiFatorAcumRows *= 1 + pct / 100;
      } else {
        cdiMs.push(null);
      }

      patrimonioMs.push(pMap?.has(m) ? parseFloat((pMap.get(m)!).toFixed(2)) : null);
    }

    rows.push({
      year,
      patrimonioMonths: patrimonioMs,
      rentabilidadeMonths: rentMs,
      cdiMonths: cdiMs,
      rentNoAno: tituloYearly.has(year) ? parseFloat(tituloYearly.get(year)!.toFixed(2)) : null,
      rentAcumulado: parseFloat(((rentFatorAcum - 1) * 100).toFixed(2)),
      cdiNoAno: cdiYearly.has(year) ? parseFloat(cdiYearly.get(year)!.toFixed(2)) : null,
      cdiAcumulado: parseFloat(((cdiFatorAcumRows - 1) * 100).toFixed(2)),
    });
  }

  return rows;
}

function ProductDetail({ product, onBack }: { product: CustodiaProduct; onBack: () => void }) {
  const { appliedVersion } = useDataReferencia();
  const [cdiRecords, setCdiRecords] = useState<CdiRecord[]>([]);
  const [diasUteis, setDiasUteis] = useState<DiaUtilRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const isPrefixado = product.categoria_nome === "Renda Fixa" && product.modalidade === "Prefixado";

  useEffect(() => {
    (async () => {
      setLoading(true);
      const endDate = product.data_calculo || "2099-12-31";

      // Always fetch both CDI and dias_uteis for comparison
      const [cdiRes, diasRes] = await Promise.all([
        supabase
          .from("historico_cdi")
          .select("data, taxa_anual")
          .gte("data", product.data_inicio)
          .lte("data", endDate)
          .order("data"),
        supabase
          .from("calendario_dias_uteis")
          .select("data, dia_util")
          .gte("data", product.data_inicio)
          .lte("data", endDate)
          .order("data"),
      ]);

      const diasMap = new Map<string, boolean>();
      (diasRes.data || []).forEach((d: any) => diasMap.set(d.data, d.dia_util));

      const merged: CdiRecord[] = (cdiRes.data || []).map((r: any) => ({
        data: r.data,
        taxa_anual: r.taxa_anual,
        dia_util: diasMap.get(r.data) ?? true,
      }));

      setCdiRecords(merged);
      setDiasUteis((diasRes.data || []).map((d: any) => ({ data: d.data, dia_util: d.dia_util })));
      setLoading(false);
    })();
  }, [product, appliedVersion]);

  // Chart data: merge both series
  const chartData = useMemo(() => {
    const cdiSeries = buildCdiSeries(cdiRecords, product.data_inicio, product.data_calculo || undefined);

    if (isPrefixado) {
      const prefSeries = buildPrefixadoSeries(diasUteis, product.taxa || 0, product.data_inicio, product.data_calculo || undefined);

      // Merge by date
      const map = new Map<string, any>();
      for (const p of cdiSeries) {
        map.set(p.data, { data: p.data, label: p.label, cdi_acumulado: p.cdi_acumulado });
      }
      for (const p of prefSeries) {
        const existing = map.get(p.data) || { data: p.data, label: p.label };
        existing.titulo_acumulado = p.cdi_acumulado; // prefixado series uses cdi_acumulado field
        existing.label = existing.label || p.label;
        map.set(p.data, existing);
      }
      return Array.from(map.values()).sort((a, b) => a.data.localeCompare(b.data));
    }

    // Non-prefixado: titulo = CDI (single line, but we still show both identical for now)
    return cdiSeries.map(p => ({
      ...p,
      titulo_acumulado: p.cdi_acumulado,
    }));
  }, [cdiRecords, diasUteis, product, isPrefixado]);

  // Detail table rows
  const detailRows = useMemo(() => {
    return buildDetailRows(
      cdiRecords,
      diasUteis,
      isPrefixado,
      product.taxa || 0,
      product.valor_investido,
      product.data_inicio,
      product.data_calculo || undefined,
    );
  }, [cdiRecords, diasUteis, product, isPrefixado]);

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
        <h1 className="text-lg font-semibold text-foreground">
          {product.nome || product.produto_nome}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Período: {fmtDate(product.data_inicio)} a {fmtDate(product.data_calculo)}
        </p>
        <div className="flex flex-wrap gap-2 mt-2">
          <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {product.categoria_nome}
          </span>
          <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {product.instituicao_nome}
          </span>
          {product.modalidade && (
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {product.modalidade}
            </span>
          )}
          {product.indexador && (
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {product.indexador}{product.taxa != null ? ` ${product.taxa}%` : ""}
            </span>
          )}
          {isPrefixado && product.taxa != null && (
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              Taxa: {product.taxa}% a.a.
            </span>
          )}
        </div>
      </div>

      {/* Chart with two lines */}
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

      {/* Detail tables — one per year */}
      <RentabilidadeDetailTable rows={detailRows} tituloLabel={tituloLabel} />
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
        .select("id, nome, codigo_custodia, data_inicio, data_calculo, data_limite, valor_investido, taxa, indexador, vencimento, modalidade, categoria_id, produto_id, instituicao_id, produtos(nome), instituicoes(nome), categorias(nome)");

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
        }));
        setProducts(mapped);
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

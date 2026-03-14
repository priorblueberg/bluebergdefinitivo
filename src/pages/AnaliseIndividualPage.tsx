import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDataReferencia } from "@/contexts/DataReferenciaContext";
import { Search, ChevronUp, ChevronDown, ArrowLeft } from "lucide-react";
import { buildCdiSeries, buildRentabilidadeRows, CdiRecord, DiaUtilRecord, buildPrefixadoSeries, buildPrefixadoRentabilidadeRows } from "@/lib/cdiCalculations";
import RentabilidadeTable from "@/components/RentabilidadeTable";
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

      if (isPrefixado) {
        // Prefixado only needs business day calendar
        const diasRes = await supabase
          .from("calendario_dias_uteis")
          .select("data, dia_util")
          .gte("data", product.data_inicio)
          .lte("data", endDate)
          .order("data");

        setDiasUteis((diasRes.data || []).map((d: any) => ({ data: d.data, dia_util: d.dia_util })));
        setCdiRecords([]);
      } else {
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
        setDiasUteis([]);
      }
      setLoading(false);
    })();
  }, [product, appliedVersion, isPrefixado]);

  const chartData = useMemo(() => {
    if (isPrefixado) {
      return buildPrefixadoSeries(diasUteis, product.taxa || 0, product.data_inicio, product.data_calculo || undefined);
    }
    return buildCdiSeries(cdiRecords, product.data_inicio, product.data_calculo || undefined);
  }, [cdiRecords, diasUteis, product, isPrefixado]);

  const rentabilidadeRows = useMemo(() => {
    if (isPrefixado) {
      return buildPrefixadoRentabilidadeRows(diasUteis, product.taxa || 0, product.data_inicio, product.data_calculo || undefined);
    }
    return buildRentabilidadeRows(cdiRecords, product.data_inicio, product.data_calculo || undefined);
  }, [cdiRecords, diasUteis, product, isPrefixado]);

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
          {product.indexador && (
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {product.indexador}{product.taxa != null ? ` ${product.taxa}%` : ""}
            </span>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-md border border-border bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground">Histórico de Rentabilidade (CDI)</h2>
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
                dataKey="cdi_acumulado"
                name="CDI Acumulado"
                stroke="hsl(210, 100%, 45%)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table */}
      <RentabilidadeTable rows={rentabilidadeRows} />
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

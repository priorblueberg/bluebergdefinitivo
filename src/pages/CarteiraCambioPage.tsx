import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDataReferencia } from "@/contexts/DataReferenciaContext";
import { calcularCambioDiario, type CambioDailyRow } from "@/lib/cambioEngine";
import { Badge } from "@/components/ui/badge";
import { CircleCheck, CircleX } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

function getDateMinus(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

const CustomTooltipChart = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-sm">
        <p className="text-foreground font-medium mb-1">{label}</p>
        {payload.map((entry: any) => (
          <p key={entry.dataKey} style={{ color: entry.color }} className="font-semibold">
            {entry.name}: {typeof entry.value === "number" ? entry.value.toFixed(2) : entry.value}%
          </p>
        ))}
      </div>
    );
  }
  return null;
};

interface CustodiaProduct {
  id: string;
  codigo_custodia: number;
  nome: string | null;
  data_inicio: string;
  data_calculo: string | null;
  preco_unitario: number | null;
  resgate_total: string | null;
  valor_investido: number;
  quantidade: number | null;
  instituicao_nome: string;
  categoria_id: string;
  produto_id: string;
  produto_nome: string;
}

export default function CarteiraCambioPage() {
  const { user } = useAuth();
  const { appliedVersion, dataReferenciaISO } = useDataReferencia();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<CustodiaProduct[]>([]);
  const [cambioRows, setCambioRows] = useState<CambioDailyRow[]>([]);
  const [carteiraStatus, setCarteiraStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user, appliedVersion]);

  async function loadData() {
    setLoading(true);
    try {
      // Load carteira info
      const { data: carteira } = await supabase
        .from("controle_de_carteiras")
        .select("status, data_inicio, data_calculo")
        .eq("nome_carteira", "Câmbio")
        .eq("user_id", user!.id)
        .maybeSingle();

      setCarteiraStatus(carteira?.status || null);

      // Load custodia products for Moedas category
      const { data: catData } = await supabase
        .from("categorias")
        .select("id")
        .eq("nome", "Moedas")
        .single();

      if (!catData) { setLoading(false); setProducts([]); return; }

      const { data: custodiaData } = await supabase
        .from("custodia")
        .select("id, codigo_custodia, nome, data_inicio, data_calculo, preco_unitario, resgate_total, valor_investido, quantidade, categoria_id, produto_id, instituicao_id, produtos(nome), instituicoes(nome)")
        .eq("user_id", user!.id)
        .eq("categoria_id", catData.id);

      if (!custodiaData || custodiaData.length === 0) { setLoading(false); setProducts([]); return; }

      const mapped: CustodiaProduct[] = custodiaData.map((r: any) => ({
        id: r.id,
        codigo_custodia: r.codigo_custodia,
        nome: r.nome,
        data_inicio: r.data_inicio,
        data_calculo: r.data_calculo,
        preco_unitario: r.preco_unitario != null ? Number(r.preco_unitario) : null,
        resgate_total: r.resgate_total,
        valor_investido: Number(r.valor_investido),
        quantidade: r.quantidade != null ? Number(r.quantidade) : null,
        instituicao_nome: r.instituicoes?.nome || "—",
        categoria_id: r.categoria_id,
        produto_id: r.produto_id,
        produto_nome: r.produtos?.nome || "",
      }));

      setProducts(mapped);

      // Fetch data for calculations
      const minDate = mapped.reduce((min, p) => p.data_inicio < min ? p.data_inicio : min, mapped[0].data_inicio);
      const allCodigos = mapped.map(p => p.codigo_custodia);

      const [calRes, dolarRes, movRes] = await Promise.all([
        supabase.from("calendario_dias_uteis").select("data, dia_util").gte("data", getDateMinus(minDate, 5)).lte("data", dataReferenciaISO).order("data"),
        supabase.from("historico_dolar").select("data, cotacao_venda").gte("data", getDateMinus(minDate, 5)).lte("data", dataReferenciaISO).order("data"),
        supabase.from("movimentacoes").select("data, tipo_movimentacao, valor, preco_unitario, quantidade, codigo_custodia").in("codigo_custodia", allCodigos).eq("user_id", user!.id).order("data"),
      ]);

      const calendario = (calRes.data || []).map((c: any) => ({ data: c.data, dia_util: c.dia_util }));
      const dolarRecords = (dolarRes.data || []).map((d: any) => ({ data: d.data, cotacao_venda: Number(d.cotacao_venda) }));

      const movByCodigo = new Map<number, any[]>();
      for (const m of (movRes.data || [])) {
        const code = m.codigo_custodia as number;
        if (!movByCodigo.has(code)) movByCodigo.set(code, []);
        movByCodigo.get(code)!.push({ data: m.data, tipo_movimentacao: m.tipo_movimentacao, valor: Number(m.valor), preco_unitario: m.preco_unitario != null ? Number(m.preco_unitario) : null, quantidade: m.quantidade != null ? Number(m.quantidade) : null });
      }

      // Aggregate all cambio rows for portfolio chart
      let allRows: CambioDailyRow[] = [];
      for (const product of mapped) {
        const rows = calcularCambioDiario({
          dataInicio: product.data_inicio,
          dataCalculo: dataReferenciaISO,
          cotacaoInicial: product.preco_unitario || 1,
          calendario,
          movimentacoes: movByCodigo.get(product.codigo_custodia) || [],
          historicoCotacao: dolarRecords,
          dataResgateTotal: product.resgate_total,
        });
        if (rows.length > allRows.length) allRows = rows;
      }
      setCambioRows(allRows);
    } catch (err) {
      console.error("Erro ao carregar carteira Câmbio:", err);
    } finally {
      setLoading(false);
    }
  }

  const chartData = useMemo(() => {
    return cambioRows
      .filter((_, i) => i % Math.max(1, Math.floor(cambioRows.length / 120)) === 0 || _ === cambioRows[cambioRows.length - 1])
      .map(r => ({
        data: new Date(r.data + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
        "Rentabilidade": +(r.rentAcumuladaPct * 100).toFixed(2),
        "Cotação USD": r.cotacao,
      }));
  }, [cambioRows]);

  const lastRow = cambioRows.length > 0 ? cambioRows[cambioRows.length - 1] : null;
  const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (loading) {
    return <div className="p-6 text-muted-foreground text-sm">Carregando carteira Câmbio...</div>;
  }

  if (products.length === 0) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p className="text-lg font-medium mb-2">Carteira Câmbio</p>
        <p className="text-sm">Nenhuma posição encontrada. Cadastre uma aplicação em Dólar para começar.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-foreground">Carteira Câmbio</h1>
        {carteiraStatus && (
          <Badge variant={carteiraStatus === "Ativa" ? "default" : "secondary"} className="gap-1 text-xs">
            {carteiraStatus === "Ativa" ? <CircleCheck className="h-3 w-3" /> : <CircleX className="h-3 w-3" />}
            {carteiraStatus}
          </Badge>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Patrimônio</p>
          <p className="text-lg font-bold text-foreground">{lastRow ? fmtBRL(lastRow.valorBRL) : "—"}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Ganho Acumulado</p>
          <p className="text-lg font-bold text-foreground">{lastRow ? fmtBRL(lastRow.rentAcumuladaBRL) : "—"}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Rentabilidade</p>
          <p className="text-lg font-bold text-foreground">{lastRow ? `${(lastRow.rentAcumuladaPct * 100).toFixed(2)}%` : "—"}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Cotação Atual (USD)</p>
          <p className="text-lg font-bold text-foreground">{lastRow ? `R$ ${lastRow.cotacao.toFixed(4)}` : "—"}</p>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 1 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Evolução da Rentabilidade</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="data" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
              <Tooltip content={<CustomTooltipChart />} />
              <Legend />
              <Line type="monotone" dataKey="Rentabilidade" stroke="hsl(210, 100%, 45%)" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Position Table */}
      <div className="rounded-lg border border-border bg-card">
        <h2 className="text-sm font-semibold text-foreground p-4 pb-2">Posição Consolidada</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Ativo</TableHead>
              <TableHead className="text-xs">Instituição</TableHead>
              <TableHead className="text-xs text-right">Qtd (USD)</TableHead>
              <TableHead className="text-xs text-right">Cotação</TableHead>
              <TableHead className="text-xs text-right">Valor Atual (BRL)</TableHead>
              <TableHead className="text-xs text-right">Valorização</TableHead>
              <TableHead className="text-xs text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((p) => {
              const qty = p.quantidade || 0;
              const cotacaoAtual = lastRow?.cotacao || p.preco_unitario || 0;
              const valorAtual = qty * cotacaoAtual;
              const ganho = valorAtual - p.valor_investido;
              const isAtivo = qty > 0.000001;
              return (
                <TableRow key={p.id}>
                  <TableCell className="text-xs font-medium">{p.nome || p.produto_nome}</TableCell>
                  <TableCell className="text-xs">{p.instituicao_nome}</TableCell>
                  <TableCell className="text-xs text-right">{qty.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-xs text-right">R$ {cotacaoAtual.toFixed(4)}</TableCell>
                  <TableCell className="text-xs text-right font-medium">{fmtBRL(valorAtual)}</TableCell>
                  <TableCell className={`text-xs text-right font-medium ${ganho >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    {fmtBRL(ganho)}
                  </TableCell>
                  <TableCell className="text-xs text-center">
                    <Badge variant={isAtivo ? "default" : "secondary"} className="text-[10px]">
                      {isAtivo ? "Ativa" : "Encerrada"}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

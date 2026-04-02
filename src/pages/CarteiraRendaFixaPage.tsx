import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDataReferencia } from "@/contexts/DataReferenciaContext";
import { calcularRendaFixaDiario, DailyRow } from "@/lib/rendaFixaEngine";
import { calcularCarteiraRendaFixa, CarteiraRFRow } from "@/lib/carteiraRendaFixaEngine";
import { buildCdiSeries, CdiRecord } from "@/lib/cdiCalculations";
import { buildDetailRowsFromEngine } from "@/lib/detailRowsBuilder";
import RentabilidadeDetailTable from "@/components/RentabilidadeDetailTable";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

interface CarteiraInfo {
  nome_carteira: string;
  status: string;
  data_inicio: string | null;
  data_calculo: string | null;
  data_limite: string | null;
  resgate_total: string | null;
}

interface CustodiaProduct {
  id: string;
  codigo_custodia: number;
  nome: string | null;
  data_inicio: string;
  taxa: number | null;
  modalidade: string | null;
  preco_unitario: number | null;
  resgate_total: string | null;
  pagamento: string | null;
  vencimento: string | null;
  indexador: string | null;
  data_limite: string | null;
  categoria_nome: string;
}

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

function getDateMinus(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function CarteiraRendaFixaPage() {
  const { user } = useAuth();
  const { appliedVersion, dataReferenciaISO } = useDataReferencia();
  const [carteiraInfo, setCarteiraInfo] = useState<CarteiraInfo | null>(null);
  const [carteiraRows, setCarteiraRows] = useState<CarteiraRFRow[]>([]);
  const [allProductRows, setAllProductRows] = useState<DailyRow[][]>([]);
  const [cdiRecords, setCdiRecords] = useState<CdiRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);

      const { data: cartData } = await supabase
        .from("controle_de_carteiras")
        .select("nome_carteira, status, data_inicio, data_calculo, data_limite, resgate_total")
        .eq("nome_carteira", "Renda Fixa")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!cartData || !cartData.data_inicio || !cartData.data_calculo || cartData.status === "Não Iniciada") {
        setCarteiraInfo(cartData ? {
          nome_carteira: cartData.nome_carteira,
          status: cartData.status,
          data_inicio: cartData.data_inicio,
          data_calculo: cartData.data_calculo,
          data_limite: cartData.data_limite,
          resgate_total: cartData.resgate_total,
        } : null);
        setCarteiraRows([]);
        setAllProductRows([]);
        setCdiRecords([]);
        setLoading(false);
        return;
      }

      const info: CarteiraInfo = {
        nome_carteira: cartData.nome_carteira,
        status: cartData.status,
        data_inicio: cartData.data_inicio,
        data_calculo: cartData.data_calculo,
        data_limite: cartData.data_limite,
        resgate_total: cartData.resgate_total,
      };
      setCarteiraInfo(info);

      const dataInicio = cartData.data_inicio;
      const dataCalculo = cartData.data_calculo;

      const { data: custodiaData } = await supabase
        .from("custodia")
        .select("id, codigo_custodia, nome, data_inicio, taxa, modalidade, preco_unitario, resgate_total, pagamento, vencimento, indexador, data_limite, categorias(nome)")
        .eq("user_id", user.id);

      const rfProducts: CustodiaProduct[] = (custodiaData || [])
        .filter((r: any) => r.categorias?.nome === "Renda Fixa")
        .map((r: any) => ({
          id: r.id,
          codigo_custodia: r.codigo_custodia,
          nome: r.nome,
          data_inicio: r.data_inicio,
          taxa: r.taxa,
          modalidade: r.modalidade,
          preco_unitario: r.preco_unitario,
          resgate_total: r.resgate_total,
          pagamento: r.pagamento,
          vencimento: r.vencimento,
          indexador: r.indexador,
          data_limite: r.data_limite,
          categoria_nome: r.categorias?.nome || "",
        }));

      if (rfProducts.length === 0) {
        setCarteiraRows([]);
        setAllProductRows([]);
        setCdiRecords([]);
        setLoading(false);
        return;
      }

      // Calendar must extend to max product end date for correct payment date generation
      const maxEndDate = rfProducts.reduce((max, p) => {
        const end = p.resgate_total || p.vencimento || dataCalculo;
        return end > max ? end : max;
      }, dataCalculo);

      const [calRes, cdiRes] = await Promise.all([
        supabase.from("calendario_dias_uteis").select("data, dia_util")
          .gte("data", getDateMinus(dataInicio, 5)).lte("data", maxEndDate).order("data"),
        supabase.from("historico_cdi").select("data, taxa_anual")
          .gte("data", dataInicio).lte("data", dataCalculo).order("data"),
      ]);

      const calendario = (calRes.data || []).map((c: any) => ({ data: c.data, dia_util: c.dia_util }));
      const cdiRaw = (cdiRes.data || []).map((c: any) => ({ data: c.data, taxa_anual: Number(c.taxa_anual) }));

      const calMap = new Map<string, boolean>();
      calendario.forEach(c => calMap.set(c.data, c.dia_util));
      const mergedCdi: CdiRecord[] = cdiRaw.map(r => ({
        ...r,
        dia_util: calMap.get(r.data) ?? false,
      }));
      setCdiRecords(mergedCdi);

      // Pre-compute CDI map once for all products
      const cdiMap = new Map<string, number>();
      for (const c of cdiRaw) cdiMap.set(c.data, c.taxa_anual);

      // Batch fetch all movimentações in a single query
      const allCodigos = rfProducts.map(p => p.codigo_custodia);
      const { data: allMovData } = await supabase
        .from("movimentacoes")
        .select("data, tipo_movimentacao, valor, codigo_custodia")
        .in("codigo_custodia", allCodigos)
        .eq("user_id", user!.id)
        .order("data");

      const movByCodigo = new Map<number, { data: string; tipo_movimentacao: string; valor: number }[]>();
      for (const m of (allMovData || [])) {
        const code = m.codigo_custodia as number;
        if (!movByCodigo.has(code)) movByCodigo.set(code, []);
        movByCodigo.get(code)!.push({ data: m.data, tipo_movimentacao: m.tipo_movimentacao, valor: Number(m.valor) });
      }

      const allProdRows = rfProducts.map((product) => {
        const dataFim = product.resgate_total || product.vencimento || dataCalculo;
        return calcularRendaFixaDiario({
          dataInicio: product.data_inicio,
          dataCalculo: dataFim > dataCalculo ? dataCalculo : dataFim,
          taxa: product.taxa || 0,
          modalidade: product.modalidade || "",
          puInicial: product.preco_unitario || 1000,
          calendario,
          movimentacoes: movByCodigo.get(product.codigo_custodia) || [],
          dataResgateTotal: product.resgate_total,
          pagamento: product.pagamento,
          vencimento: product.vencimento,
          indexador: product.indexador,
          cdiRecords: cdiRaw,
          dataLimite: product.data_limite,
          precomputedCdiMap: cdiMap,
          calendarioSorted: true,
        });
      });

      setAllProductRows(allProdRows);

      const result = calcularCarteiraRendaFixa({
        productRows: allProdRows,
        calendario,
        dataInicio,
        dataCalculo,
      });

      setCarteiraRows(result);
      setLoading(false);
    })();
  }, [user, appliedVersion]);

  // Chart: Rentabilidade vs CDI
  const chartData = useMemo(() => {
    if (!carteiraInfo?.data_inicio || carteiraRows.length === 0) return [];

    const cdiSeries = buildCdiSeries(cdiRecords, carteiraInfo.data_inicio, carteiraInfo.data_calculo ?? undefined);

    const enginePoints = carteiraRows
      .filter(r => r.liquido > 0 || r.liquido2 > 0)
      .map(r => ({
        data: r.data,
        label: new Date(r.data + "T00:00:00").toLocaleDateString("pt-BR"),
        titulo_acumulado: parseFloat((r.rentAcumuladaPct * 100).toFixed(4)),
      }));

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
    return Array.from(map.values()).sort((a: any, b: any) => a.data.localeCompare(b.data));
  }, [carteiraRows, cdiRecords, carteiraInfo]);

  // Detail rows: use the merged individual product rows for the detail table
  const detailRows = useMemo(() => {
    if (allProductRows.length === 0 || !carteiraInfo?.data_inicio || !carteiraInfo?.data_calculo) return [];

    // Merge all product rows by date into an EngineRowLike-compatible structure
    const dateMap = new Map<string, {
      data: string; diaUtil: boolean; liquido: number; aplicacoes: number;
      resgates: number; jurosPago: number; saldoCotas: number;
      ganhoAcumulado: number; ganhoDiario: number; rentabilidadeDiaria: number | null;
    }>();

    for (const prodRows of allProductRows) {
      for (const row of prodRows) {
        if (row.data < carteiraInfo.data_inicio! || row.data > carteiraInfo.data_calculo!) continue;
        const existing = dateMap.get(row.data);
        if (existing) {
          existing.liquido += row.liquido;
          existing.aplicacoes += row.aplicacoes;
          existing.resgates += row.resgates;
          existing.jurosPago += row.jurosPago;
          existing.saldoCotas += row.saldoCotas;
          existing.ganhoDiario += row.ganhoDiario;
        } else {
          dateMap.set(row.data, {
            data: row.data,
            diaUtil: row.diaUtil,
            liquido: row.liquido,
            aplicacoes: row.aplicacoes,
            resgates: row.resgates,
            jurosPago: row.jurosPago,
            saldoCotas: row.saldoCotas,
            ganhoAcumulado: 0,
            ganhoDiario: row.ganhoDiario,
            rentabilidadeDiaria: null,
          });
        }
      }
    }

    // Sort and compute ganhoAcumulado + rentabilidadeDiaria from carteiraRows
    const merged = Array.from(dateMap.values()).sort((a, b) => a.data.localeCompare(b.data));
    const carteiraMap = new Map<string, CarteiraRFRow>();
    carteiraRows.forEach(r => carteiraMap.set(r.data, r));

    let ganhoAcum = 0;
    for (const row of merged) {
      ganhoAcum += row.ganhoDiario;
      row.ganhoAcumulado = ganhoAcum;
      const cr = carteiraMap.get(row.data);
      row.rentabilidadeDiaria = cr ? cr.rentDiariaPct : null;
    }

    return buildDetailRowsFromEngine(merged, cdiRecords, carteiraInfo.data_inicio!);
  }, [allProductRows, carteiraRows, cdiRecords, carteiraInfo]);

  const fmtDate = (d: string | null) =>
    d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";

  const showContent = carteiraInfo && (carteiraInfo.status === "Ativa" || carteiraInfo.status === "Encerrada") && carteiraRows.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Renda Fixa</h1>
        {carteiraInfo && (
          carteiraInfo.status === "Ativa" ? (
            <p className="text-sm text-muted-foreground mt-1">
              Período de Análise: De {fmtDate(carteiraInfo.data_inicio)} a {fmtDate(carteiraInfo.data_calculo)}
            </p>
          ) : carteiraInfo.status === "Não Iniciada" ? (
            <p className="text-sm text-muted-foreground mt-1">
              Data selecionada anterior ao início dos seus investimentos em Renda Fixa
            </p>
          ) : carteiraInfo.status === "Encerrada" ? (
            <p className="text-sm text-muted-foreground mt-1">
              Carteira Encerrada em {fmtDate(carteiraInfo.data_calculo)}
            </p>
          ) : null
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      ) : !showContent ? (
        <div className="rounded-md border border-border p-8 text-center text-muted-foreground">
          Nenhum dado disponível para o período selecionado.
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          {(() => {
            let patrimonioValue: number | null = null;
            let rentValue: number | null = null;
            let ganhoValue: number | null = null;

            for (let i = carteiraRows.length - 1; i >= 0; i--) {
              if (carteiraRows[i].data <= dataReferenciaISO) {
                patrimonioValue = carteiraRows[i].liquido;
                rentValue = parseFloat((carteiraRows[i].rentAcumuladaPct * 100).toFixed(2));
                ganhoValue = carteiraRows[i].rentAcumuladaRS;
                break;
              }
            }

            // CDI from detail rows
            const cdiAcum = detailRows.length > 0 ? detailRows[0].cdiAcumulado : null;

            const fmtBrl = (v: number | null) =>
              v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";
            const fmtPct = (v: number | null) =>
              v != null ? `${v.toFixed(2)}%` : "—";

            const cards = [
              { label: "Patrimônio", value: fmtBrl(patrimonioValue) },
              { label: "Ganho Financeiro", value: fmtBrl(ganhoValue) },
              { label: "Rentabilidade", value: fmtPct(rentValue) },
              { label: "CDI Acumulado", value: fmtPct(cdiAcum) },
            ];

            return (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {cards.map((c) => (
                  <div key={c.label} className="rounded-lg border border-border bg-card p-4 shadow-sm">
                    <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
                    <p className="text-lg font-semibold text-foreground">{c.value}</p>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-md border border-border bg-card p-6">
              <h2 className="text-sm font-semibold text-foreground">Histórico de Rentabilidade</h2>
              <p className="mt-1 text-xs text-muted-foreground">Variação acumulada (%) no período</p>
              <div className="mt-4 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false} tickFormatter={(v) => `${v}%`} />
                    <Tooltip content={<CustomTooltipChart />} />
                    <Legend iconType="plainline" wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="titulo_acumulado" name="Carteira RF" stroke="hsl(210, 100%, 45%)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} connectNulls />
                    <Line type="monotone" dataKey="cdi_acumulado" name="CDI" stroke="hsl(0, 0%, 55%)" strokeWidth={1.5} dot={false} activeDot={{ r: 3, strokeWidth: 0 }} strokeDasharray="5 3" connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-md border border-border bg-card p-6">
              <h2 className="text-sm font-semibold text-foreground">Patrimônio Mensal</h2>
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
                          barData.push({ mes: `${MONTH_LABELS[m]}/${String(row.year).slice(2)}`, patrimonio: row.patrimonioMonths[m]! });
                        }
                      }
                    }
                    return barData;
                  })()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false} tickFormatter={(v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })} />
                    <Tooltip formatter={(value: number) => [value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), "Patrimônio"]} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }} />
                    <Bar dataKey="patrimonio" name="Patrimônio" fill="hsl(210, 100%, 45%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Detail Table */}
          <RentabilidadeDetailTable rows={detailRows} tituloLabel="Rentabilidade" />
        </>
      )}
    </div>
  );
}

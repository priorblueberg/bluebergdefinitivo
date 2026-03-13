import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDataReferencia } from "@/contexts/DataReferenciaContext";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { buildCdiSeries, buildRentabilidadeRows, CdiRecord } from "@/lib/cdiCalculations";
import RentabilidadeTable from "@/components/RentabilidadeTable";

interface CarteiraInfo {
  nome_carteira: string;
  status: string;
  data_inicio: string | null;
  data_calculo: string | null;
}

interface CdiRaw { data: string; taxa_anual: number; }
interface DiaUtil { data: string; dia_util: boolean; }

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-sm">
        <p className="text-foreground">{label}</p>
        <p className="text-primary font-semibold">
          CDI Acumulado: {Number(payload[0].value).toFixed(2)}%
        </p>
      </div>
    );
  }
  return null;
};

export default function CarteiraRendaFixaPage() {
  const [carteiraInfo, setCarteiraInfo] = useState<CarteiraInfo | null>(null);
  const [cdiRecords, setCdiRecords] = useState<CdiRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { appliedVersion } = useDataReferencia();

  useEffect(() => {
    (async () => {
      setLoading(true);

      const { data: carteiraData } = await supabase
        .from("controle_de_carteiras")
        .select("nome_carteira, status, data_inicio, data_calculo")
        .eq("nome_carteira", "Renda Fixa")
        .maybeSingle();

      if (carteiraData) {
        setCarteiraInfo({
          nome_carteira: carteiraData.nome_carteira,
          status: carteiraData.status,
          data_inicio: carteiraData.data_inicio,
          data_calculo: carteiraData.data_calculo,
        });

        if (carteiraData.data_inicio && carteiraData.data_calculo && carteiraData.status !== "Não Iniciada") {
          const [{ data: cdiData }, { data: calData }] = await Promise.all([
            supabase
              .from("historico_cdi")
              .select("data, taxa_anual")
              .gte("data", carteiraData.data_inicio)
              .lte("data", carteiraData.data_calculo)
              .order("data", { ascending: true }),
            supabase
              .from("calendario_dias_uteis")
              .select("data, dia_util")
              .gte("data", carteiraData.data_inicio)
              .lte("data", carteiraData.data_calculo),
          ]);

          if (cdiData && calData) {
            const calMap = new Map((calData as DiaUtil[]).map(d => [d.data, d.dia_util]));
            const merged: CdiRecord[] = (cdiData as CdiRaw[]).map(r => ({
              ...r,
              dia_util: calMap.get(r.data) ?? false,
            }));
            setCdiRecords(merged);
          }
        } else {
          setCdiRecords([]);
        }
      } else {
        setCarteiraInfo(null);
        setCdiRecords([]);
      }

      setLoading(false);
    })();
  }, [appliedVersion]);

  const chartData = useMemo(
    () => buildCdiSeries(cdiRecords, carteiraInfo?.data_inicio ?? ""),
    [cdiRecords, carteiraInfo?.data_inicio]
  );

  const rentabilidadeRows = useMemo(
    () => buildRentabilidadeRows(cdiRecords, carteiraInfo?.data_inicio ?? ""),
    [cdiRecords, carteiraInfo?.data_inicio]
  );

  const fmtDate = (d: string | null) =>
    d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";

  const renderStatusMessage = () => {
    if (!carteiraInfo) return null;
    if (carteiraInfo.status === "Ativa") {
      return (
        <p className="text-sm text-muted-foreground mt-1">
          Período de Análise: De {fmtDate(carteiraInfo.data_inicio)} a {fmtDate(carteiraInfo.data_calculo)}
        </p>
      );
    }
    if (carteiraInfo.status === "Não Iniciada") {
      return (
        <p className="text-sm text-muted-foreground mt-1">
          Data selecionada anterior ao início dos seus investimentos em Renda Fixa
        </p>
      );
    }
    if (carteiraInfo.status === "Encerrada") {
      return (
        <p className="text-sm text-muted-foreground mt-1">
          Carteira Encerrada em {fmtDate(carteiraInfo.data_calculo)}
        </p>
      );
    }
    return null;
  };

  const showContent = carteiraInfo?.status === "Ativa" || carteiraInfo?.status === "Encerrada";
  const tickInterval = chartData.length > 60 ? Math.floor(chartData.length / 12) : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Renda Fixa</h1>
        {renderStatusMessage()}
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
          <div className="rounded-md border border-border bg-card p-6">
            <h2 className="text-sm font-semibold text-foreground">Histórico de Rentabilidade</h2>
            <p className="mt-1 text-xs text-muted-foreground">CDI Acumulado no período</p>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 20%, 88%)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "hsl(215, 15%, 50%)" }}
                    axisLine={{ stroke: "hsl(215, 20%, 88%)" }}
                    tickLine={false}
                    interval={tickInterval}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "hsl(215, 15%, 50%)" }}
                    axisLine={{ stroke: "hsl(215, 20%, 88%)" }}
                    tickLine={false}
                    tickFormatter={(v) => `${v.toFixed(1)}%`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    iconType="plainline"
                    wrapperStyle={{ fontSize: 11 }}
                    formatter={(value: string) => <span className="text-muted-foreground">{value}</span>}
                  />
                  <Line
                    type="monotone"
                    dataKey="cdi_acumulado"
                    name="CDI Acumulado"
                    stroke="hsl(210, 100%, 45%)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5, fill: "hsl(210, 100%, 45%)", strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <RentabilidadeTable rows={rentabilidadeRows} />
        </>
      )}
    </div>
  );
}

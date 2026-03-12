import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDataReferencia } from "@/contexts/DataReferenciaContext";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";

interface CarteiraInfo {
  nome_carteira: string;
  status: string;
  data_inicio: string | null;
  data_calculo: string | null;
}

interface CdiRecord {
  data: string;
  taxa_anual: number;
  dia_util: boolean;
}

interface ChartPoint {
  data: string;
  label: string;
  cdi_acumulado: number;
}

const chartConfig: ChartConfig = {
  cdi_acumulado: {
    label: "CDI Acumulado (%)",
    color: "hsl(var(--primary))",
  },
};

function buildCdiSeries(cdiRecords: CdiRecord[]): ChartPoint[] {
  if (cdiRecords.length === 0) return [];

  const points: ChartPoint[] = [];
  let fatorAcumulado = 1;

  for (let i = 0; i < cdiRecords.length; i++) {
    const rec = cdiRecords[i];

    if (i === 0) {
      fatorAcumulado = 1;
    } else if (rec.dia_util) {
      const fatorDiario = Math.pow(rec.taxa_anual / 100 + 1, 1 / 252) - 1;
      fatorAcumulado = fatorAcumulado * (1 + fatorDiario);
    }
    // dias não úteis: fatorAcumulado permanece o mesmo

    const cdiAcumulado = (fatorAcumulado - 1) * 100;

    points.push({
      data: rec.data,
      label: new Date(rec.data + "T00:00:00").toLocaleDateString("pt-BR"),
      cdi_acumulado: parseFloat(cdiAcumulado.toFixed(4)),
    });
  }

  return points;
}

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
          const { data: cdiData } = await supabase
            .from("historico_cdi")
            .select("data, taxa_anual, dia_util")
            .gte("data", carteiraData.data_inicio)
            .lte("data", carteiraData.data_calculo)
            .order("data", { ascending: true });

          if (cdiData) {
            setCdiRecords(cdiData as CdiRecord[]);
          }
        }
      } else {
        setCarteiraInfo(null);
      }

      setCdiRecords((prev) => (carteiraData?.status === "Não Iniciada" ? [] : prev));
      setLoading(false);
    })();
  }, [appliedVersion]);

  const chartData = useMemo(() => buildCdiSeries(cdiRecords), [cdiRecords]);

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

  // Reduce tick count for readability
  const tickInterval = chartData.length > 60 ? Math.floor(chartData.length / 12) : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Renda Fixa</h1>
        {renderStatusMessage()}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          Carregando...
        </div>
      ) : chartData.length === 0 ? (
        <div className="rounded-md border border-border p-8 text-center text-muted-foreground">
          Nenhum dado disponível para o período selecionado.
        </div>
      ) : (
        <div className="rounded-md border border-border p-4 bg-card">
          <h2 className="text-sm font-medium text-foreground mb-4">CDI Acumulado (%)</h2>
          <ChartContainer config={chartConfig} className="aspect-[2.5/1] w-full">
            <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                interval={tickInterval}
                className="fill-muted-foreground"
              />
              <YAxis
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => `${v.toFixed(1)}%`}
                className="fill-muted-foreground"
                width={55}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => [`${Number(value).toFixed(4)}%`, "CDI Acumulado"]}
                    labelKey="data"
                  />
                }
              />
              <Line
                type="monotone"
                dataKey="cdi_acumulado"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
                name="CDI Acumulado"
              />
            </LineChart>
          </ChartContainer>
        </div>
      )}
    </div>
  );
}

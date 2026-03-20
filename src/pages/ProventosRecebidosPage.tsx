import { useEffect, useState } from "react";
import { ArrowUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDataReferencia } from "@/contexts/DataReferenciaContext";
import { useAuth } from "@/hooks/useAuth";
import { calcularRendaFixaDiario } from "@/lib/rendaFixaEngine";

interface ProventoRow {
  data: string;
  nome: string;
  valor: number;
  valorUnitario: number;
  quantidade: number;
}

type SortField = keyof ProventoRow;
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortField; label: string }[] = [
  { key: "data", label: "Data" },
  { key: "nome", label: "Nome" },
  { key: "valor", label: "Valor Recebido" },
  { key: "valorUnitario", label: "Valor Unitário" },
  { key: "quantidade", label: "Quantidade" },
];

function getDateMinus(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function ProventosRecebidosPage() {
  const { appliedVersion, dataReferenciaISO } = useDataReferencia();
  const { user } = useAuth();
  const [rows, setRows] = useState<ProventoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>("data");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);

      // 1. Load all custodia products for this user
      const { data: custodias } = await supabase
        .from("custodia")
        .select("codigo_custodia, nome, data_inicio, data_calculo, taxa, modalidade, preco_unitario, resgate_total, pagamento, vencimento")
        .eq("user_id", user.id);

      if (!custodias || custodias.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      // Filter only products with periodic payment
      const withPayment = custodias.filter(
        (c) => c.pagamento && c.pagamento !== "No Vencimento" && c.modalidade === "Prefixado"
      );

      if (withPayment.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      const allProventos: ProventoRow[] = [];

      for (const prod of withPayment) {
        const endDate = prod.data_calculo || dataReferenciaISO;

        const [calRes, movsRes] = await Promise.all([
          supabase
            .from("calendario_dias_uteis")
            .select("data, dia_util")
            .gte("data", getDateMinus(prod.data_inicio, 5))
            .lte("data", endDate)
            .order("data"),
          supabase
            .from("movimentacoes")
            .select("data, tipo_movimentacao, valor")
            .eq("codigo_custodia", prod.codigo_custodia)
            .eq("user_id", user.id)
            .order("data"),
        ]);

        const calendario = (calRes.data || []).map((d: any) => ({
          data: d.data,
          dia_util: d.dia_util,
        }));

        const movimentacoes = (movsRes.data || []).map((m: any) => ({
          data: m.data,
          tipo_movimentacao: m.tipo_movimentacao,
          valor: Number(m.valor),
        }));

        const engineRows = calcularRendaFixaDiario({
          dataInicio: prod.data_inicio,
          dataCalculo: endDate,
          taxa: prod.taxa || 0,
          modalidade: prod.modalidade || "Prefixado",
          puInicial: prod.preco_unitario || 1000,
          calendario,
          movimentacoes,
          dataResgateTotal: prod.resgate_total,
          pagamento: prod.pagamento,
          vencimento: prod.vencimento,
        });

        for (const row of engineRows) {
          if (row.pagamentoJuros > 0.01) {
            const qty = row.saldoCotas || 0;
            allProventos.push({
              data: row.data,
              nome: prod.nome || "—",
              valor: row.pagamentoJuros,
              valorUnitario: qty > 0 ? row.pagamentoJuros / qty : row.pagamentoJuros,
              quantidade: qty,
            });
          }
        }
      }

      setRows(allProventos);
      setLoading(false);
    })();
  }, [user, appliedVersion, dataReferenciaISO]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const sortedRows = [...rows].sort((a, b) => {
    const valA = a[sortField] ?? "";
    const valB = b[sortField] ?? "";
    if (typeof valA === "number" && typeof valB === "number") {
      return sortDir === "asc" ? valA - valB : valB - valA;
    }
    const cmp = String(valA).localeCompare(String(valB), "pt-BR", { numeric: true });
    return sortDir === "asc" ? cmp : -cmp;
  });

  const fmtDate = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString("pt-BR");

  const fmtBrl = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Proventos Recebidos</h1>
        <p className="text-xs text-muted-foreground">Pagamentos de juros periódicos dos seus títulos</p>
      </div>

      <div className="rounded-md border border-border overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-primary text-primary-foreground">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className="px-3 py-2 text-left font-medium whitespace-nowrap cursor-pointer select-none hover:bg-primary/80 transition-colors"
                  onClick={() => handleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    <ArrowUpDown size={12} className={sortField === col.key ? "opacity-100" : "opacity-40"} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={COLUMNS.length} className="px-4 py-8 text-center text-muted-foreground">
                  Carregando...
                </td>
              </tr>
            ) : sortedRows.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhum provento encontrado.
                </td>
              </tr>
            ) : (
              sortedRows.map((r, i) => (
                <tr
                  key={`${r.data}-${r.nome}-${i}`}
                  className={`border-t border-border ${i % 2 === 0 ? "bg-card" : "bg-muted/30"}`}
                >
                  <td className="px-3 py-2 text-foreground whitespace-nowrap">{fmtDate(r.data)}</td>
                  <td className="px-3 py-2 text-foreground">{r.nome}</td>
                  <td className="px-3 py-2 text-foreground whitespace-nowrap">{fmtBrl(r.valor)}</td>
                  <td className="px-3 py-2 text-foreground whitespace-nowrap">{fmtBrl(r.valorUnitario)}</td>
                  <td className="px-3 py-2 text-foreground whitespace-nowrap text-right">
                    {r.quantidade.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

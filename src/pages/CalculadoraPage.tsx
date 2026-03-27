import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDataReferencia } from "@/contexts/DataReferenciaContext";
import { calcularRendaFixaDiario, DailyRow } from "@/lib/rendaFixaEngine";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import CalculadoraTable from "@/components/CalculadoraTable";

interface CustodiaOption {
  id: string;
  codigo_custodia: number;
  nome: string | null;
  data_inicio: string;
  data_calculo: string | null;
  taxa: number | null;
  modalidade: string | null;
  multiplicador: string | null;
  preco_unitario: number | null;
  categoria_nome: string;
  produto_nome: string;
  resgate_total: string | null;
  pagamento: string | null;
  vencimento: string | null;
  indexador: string | null;
  data_limite: string | null;
}

export default function CalculadoraPage() {
  const { user } = useAuth();
  const { appliedVersion } = useDataReferencia();
  const [products, setProducts] = useState<CustodiaOption[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [rows, setRows] = useState<DailyRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Load custodia products
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("custodia")
        .select("id, codigo_custodia, nome, data_inicio, data_calculo, taxa, modalidade, multiplicador, preco_unitario, resgate_total, pagamento, vencimento, indexador, data_limite, categorias(nome), produtos(nome)")
        .eq("user_id", user.id);

      if (data) {
        setProducts(
          data.map((r: any) => ({
            id: r.id,
            codigo_custodia: r.codigo_custodia,
            nome: r.nome,
            data_inicio: r.data_inicio,
            data_calculo: r.data_calculo,
            taxa: r.taxa,
            modalidade: r.modalidade,
            multiplicador: r.multiplicador,
            preco_unitario: r.preco_unitario,
            categoria_nome: r.categorias?.nome || "",
            produto_nome: r.produtos?.nome || "",
            resgate_total: r.resgate_total,
            pagamento: r.pagamento,
            vencimento: r.vencimento,
            indexador: r.indexador,
            data_limite: r.data_limite,
          }))
        );
      }
    })();
  }, [user, appliedVersion]);

  // Calculate when product is selected
  useEffect(() => {
    if (!selectedId || !user) return;
    const product = products.find((p) => p.id === selectedId);
    if (!product) return;

    (async () => {
      setLoading(true);
      try {
        // End date: always show full lifecycle (resgate_total or vencimento)
        const dataFim = product.resgate_total || product.vencimento || product.data_calculo || "2099-12-31";

        const { data: calData } = await supabase
          .from("calendario_dias_uteis")
          .select("data, dia_util")
          .gte("data", getDateMinus(product.data_inicio, 5))
          .lte("data", dataFim)
          .order("data", { ascending: true });

        const { data: movData } = await supabase
          .from("movimentacoes")
          .select("data, tipo_movimentacao, valor")
          .eq("codigo_custodia", product.codigo_custodia)
          .eq("user_id", user.id)
          .order("data", { ascending: true });

        // Fetch CDI records for the period
        const { data: cdiData } = await supabase
          .from("historico_cdi")
          .select("data, taxa_anual")
          .gte("data", getDateMinus(product.data_inicio, 5))
          .lte("data", dataFim)
          .order("data", { ascending: true });

        const result = calcularRendaFixaDiario({
          dataInicio: product.data_inicio,
          dataCalculo: dataFim,
          taxa: product.taxa || 0,
          modalidade: product.modalidade || "",
          puInicial: product.preco_unitario || 1000,
          calendario: (calData || []).map((c: any) => ({
            data: c.data,
            dia_util: c.dia_util,
          })),
          movimentacoes: (movData || []).map((m: any) => ({
            data: m.data,
            tipo_movimentacao: m.tipo_movimentacao,
            valor: Number(m.valor),
          })),
          dataResgateTotal: product.resgate_total,
          pagamento: product.pagamento,
          vencimento: product.vencimento,
          indexador: product.indexador,
          cdiRecords: (cdiData || []).map((c: any) => ({
            data: c.data,
            taxa_anual: Number(c.taxa_anual),
          })),
          dataLimite: product.data_limite,
        });

        setRows(result);
      } catch (err) {
        console.error("Erro ao calcular:", err);
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, appliedVersion]);

  const selectedProduct = products.find((p) => p.id === selectedId);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Calculadora</h1>

      <div className="max-w-md">
        <label className="mb-1 block text-sm font-medium text-muted-foreground">
          Selecione o produto da custódia
        </label>
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger>
            <SelectValue placeholder="Escolha um produto..." />
          </SelectTrigger>
          <SelectContent>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nome || p.produto_nome} — {p.categoria_nome}{" "}
                {p.modalidade ? `(${p.modalidade})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedProduct && (
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            {selectedProduct.nome || selectedProduct.produto_nome}
          </span>{" "}
          | Taxa: {selectedProduct.taxa != null ? `${selectedProduct.taxa.toFixed(2)}%` : "—"} |
          Modalidade: {selectedProduct.modalidade || "—"} | Multiplicador:{" "}
          {selectedProduct.multiplicador || "—"} | Pagamento:{" "}
          {selectedProduct.pagamento || "—"}
        </div>
      )}

      {loading && (
        <p className="text-sm text-muted-foreground">Calculando...</p>
      )}

      {!loading && rows.length > 0 && (
        <CalculadoraTable rows={rows} />
      )}

      {!loading && selectedId && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhum dado encontrado para o produto selecionado.
        </p>
      )}
    </div>
  );
}

function getDateMinus(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDataReferencia } from "@/contexts/DataReferenciaContext";
import { calcularRendaFixaDiario, DailyRow } from "@/lib/rendaFixaEngine";
import { calcularCarteiraRendaFixa, CarteiraRFRow } from "@/lib/carteiraRendaFixaEngine";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import CalculadoraTable from "@/components/CalculadoraTable";
import CalculadoraCarteiraTable from "@/components/CalculadoraCarteiraTable";

const CARTEIRA_RF_ID = "__carteira_rf__";

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
  const [carteiraRows, setCarteiraRows] = useState<CarteiraRFRow[]>([]);
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

    if (selectedId === CARTEIRA_RF_ID) {
      calculateCarteira();
      return;
    }

    const product = products.find((p) => p.id === selectedId);
    if (!product) return;

    (async () => {
      setLoading(true);
      setCarteiraRows([]);
      try {
        const dataFim = product.resgate_total || product.vencimento || product.data_calculo || "2099-12-31";

        const [calRes, movRes, cdiRes] = await Promise.all([
          supabase.from("calendario_dias_uteis").select("data, dia_util")
            .gte("data", getDateMinus(product.data_inicio, 5)).lte("data", dataFim).order("data"),
          supabase.from("movimentacoes").select("data, tipo_movimentacao, valor")
            .eq("codigo_custodia", product.codigo_custodia).eq("user_id", user.id).order("data"),
          supabase.from("historico_cdi").select("data, taxa_anual")
            .gte("data", getDateMinus(product.data_inicio, 5)).lte("data", dataFim).order("data"),
        ]);

        const result = calcularRendaFixaDiario({
          dataInicio: product.data_inicio,
          dataCalculo: dataFim,
          taxa: product.taxa || 0,
          modalidade: product.modalidade || "",
          puInicial: product.preco_unitario || 1000,
          calendario: (calRes.data || []).map((c: any) => ({ data: c.data, dia_util: c.dia_util })),
          movimentacoes: (movRes.data || []).map((m: any) => ({ data: m.data, tipo_movimentacao: m.tipo_movimentacao, valor: Number(m.valor) })),
          dataResgateTotal: product.resgate_total,
          pagamento: product.pagamento,
          vencimento: product.vencimento,
          indexador: product.indexador,
          cdiRecords: (cdiRes.data || []).map((c: any) => ({ data: c.data, taxa_anual: Number(c.taxa_anual) })),
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

  async function calculateCarteira() {
    if (!user) return;
    setLoading(true);
    setRows([]);
    try {
      // Fetch carteira info
      const { data: carteiraData } = await supabase
        .from("controle_de_carteiras")
        .select("data_inicio, data_calculo, data_limite, resgate_total")
        .eq("nome_carteira", "Renda Fixa")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!carteiraData?.data_inicio || !carteiraData?.data_calculo) {
        setCarteiraRows([]);
        setLoading(false);
        return;
      }

      const dataInicio = carteiraData.data_inicio;
      const dataCalculo = carteiraData.data_calculo;

      // Fetch RF products
      const rfProducts = products.filter(p => p.categoria_nome === "Renda Fixa");
      if (rfProducts.length === 0) { setCarteiraRows([]); setLoading(false); return; }

      // Fetch calendar + CDI for portfolio period
      const [calRes, cdiRes] = await Promise.all([
        supabase.from("calendario_dias_uteis").select("data, dia_util")
          .gte("data", getDateMinus(dataInicio, 5)).lte("data", dataCalculo).order("data"),
        supabase.from("historico_cdi").select("data, taxa_anual")
          .gte("data", getDateMinus(dataInicio, 5)).lte("data", dataCalculo).order("data"),
      ]);

      const calendario = (calRes.data || []).map((c: any) => ({ data: c.data, dia_util: c.dia_util }));
      const cdiRecords = (cdiRes.data || []).map((c: any) => ({ data: c.data, taxa_anual: Number(c.taxa_anual) }));

      // For each RF product, fetch movs and run individual engine
      const productRowsPromises = rfProducts.map(async (product) => {
        const dataFim = product.resgate_total || product.vencimento || dataCalculo;
        const { data: movData } = await supabase
          .from("movimentacoes")
          .select("data, tipo_movimentacao, valor")
          .eq("codigo_custodia", product.codigo_custodia)
          .eq("user_id", user!.id)
          .order("data");

        return calcularRendaFixaDiario({
          dataInicio: product.data_inicio,
          dataCalculo: dataFim > dataCalculo ? dataCalculo : dataFim,
          taxa: product.taxa || 0,
          modalidade: product.modalidade || "",
          puInicial: product.preco_unitario || 1000,
          calendario,
          movimentacoes: (movData || []).map((m: any) => ({ data: m.data, tipo_movimentacao: m.tipo_movimentacao, valor: Number(m.valor) })),
          dataResgateTotal: product.resgate_total,
          pagamento: product.pagamento,
          vencimento: product.vencimento,
          indexador: product.indexador,
          cdiRecords,
          dataLimite: product.data_limite,
        });
      });

      const allProductRows = await Promise.all(productRowsPromises);

      const result = calcularCarteiraRendaFixa({
        productRows: allProductRows,
        calendario,
        dataInicio,
        dataCalculo,
        resgateTotal: carteiraData.resgate_total,
      });

      setCarteiraRows(result);
    } catch (err) {
      console.error("Erro ao calcular carteira RF:", err);
    } finally {
      setLoading(false);
    }
  }

  const selectedProduct = selectedId !== CARTEIRA_RF_ID ? products.find((p) => p.id === selectedId) : null;
  const isCarteira = selectedId === CARTEIRA_RF_ID;

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
            <SelectItem value={CARTEIRA_RF_ID} className="font-semibold text-primary">
              📊 Carteira Renda Fixa (Consolidado)
            </SelectItem>
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

      {isCarteira && !loading && (
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Carteira Renda Fixa</span>{" "}
          | Visão consolidada de todos os produtos de Renda Fixa
        </div>
      )}

      {loading && <p className="text-sm text-muted-foreground">Calculando...</p>}

      {!loading && !isCarteira && rows.length > 0 && <CalculadoraTable rows={rows} />}

      {!loading && isCarteira && carteiraRows.length > 0 && <CalculadoraCarteiraTable rows={carteiraRows} />}

      {!loading && selectedId && !isCarteira && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum dado encontrado para o produto selecionado.</p>
      )}

      {!loading && isCarteira && carteiraRows.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum dado encontrado para a Carteira de Renda Fixa.</p>
      )}
    </div>
  );
}

function getDateMinus(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

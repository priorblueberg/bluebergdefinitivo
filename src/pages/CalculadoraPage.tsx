import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDataReferencia } from "@/contexts/DataReferenciaContext";
import { calcularRendaFixaDiario, DailyRow } from "@/lib/rendaFixaEngine";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
}

export default function CalculadoraPage() {
  const { user } = useAuth();
  const { dataReferencia, appliedVersion } = useDataReferencia();
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
        .select("id, codigo_custodia, nome, data_inicio, data_calculo, taxa, modalidade, multiplicador, preco_unitario, categorias(nome), produtos(nome)")
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
        const refDate = format(dataReferencia, "yyyy-MM-dd");
        const dataCalc = product.data_calculo || refDate;

        // Fetch calendario from a reasonable range before data_inicio to dataCalculo
        const { data: calData } = await supabase
          .from("calendario_dias_uteis")
          .select("data, dia_util")
          .gte("data", getDateMinus(product.data_inicio, 5))
          .lte("data", dataCalc)
          .order("data", { ascending: true });

        // Fetch movimentacoes for this codigo_custodia
        const { data: movData } = await supabase
          .from("movimentacoes")
          .select("data, tipo_movimentacao, valor")
          .eq("codigo_custodia", product.codigo_custodia)
          .eq("user_id", user.id)
          .order("data", { ascending: true });

        const result = calcularRendaFixaDiario({
          dataInicio: product.data_inicio,
          dataCalculo: dataCalc,
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
          {selectedProduct.multiplicador || "—"}
        </div>
      )}

      {loading && (
        <p className="text-sm text-muted-foreground">Calculando...</p>
      )}

      {!loading && rows.length > 0 && (
        <div className="rounded-md border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs whitespace-nowrap">Data</TableHead>
                <TableHead className="text-xs whitespace-nowrap text-center">Dia Útil</TableHead>
                <TableHead className="text-xs whitespace-nowrap text-right">Valor da Cota (1)</TableHead>
                <TableHead className="text-xs whitespace-nowrap text-right">Saldo de Cotas (1)</TableHead>
                <TableHead className="text-xs whitespace-nowrap text-right">Líquido (1)</TableHead>
                <TableHead className="text-xs whitespace-nowrap text-right">Aplicações</TableHead>
                <TableHead className="text-xs whitespace-nowrap text-right">QTD Cotas (Compra)</TableHead>
                <TableHead className="text-xs whitespace-nowrap text-right">Resgates</TableHead>
                <TableHead className="text-xs whitespace-nowrap text-right">Rent. Diária</TableHead>
                <TableHead className="text-xs whitespace-nowrap text-right">Multiplicador</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={r.data} className={i % 2 === 0 ? "" : "bg-muted/30"}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {formatDate(r.data)}
                  </TableCell>
                  <TableCell className="text-xs text-center">
                    {r.diaUtil ? "Sim" : "Não"}
                  </TableCell>
                  <TableCell className="text-xs text-right font-mono">
                    {fmt(r.valorCota, 6)}
                  </TableCell>
                  <TableCell className="text-xs text-right font-mono">
                    {fmt(r.saldoCotas, 6)}
                  </TableCell>
                  <TableCell className="text-xs text-right font-mono">
                    {fmtCurrency(r.liquido)}
                  </TableCell>
                  <TableCell className="text-xs text-right font-mono">
                    {r.aplicacoes > 0 ? fmtCurrency(r.aplicacoes) : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-right font-mono">
                    {r.qtdCotasCompra > 0 ? fmt(r.qtdCotasCompra, 6) : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-right font-mono">
                    {r.resgates > 0 ? fmtCurrency(r.resgates) : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-right font-mono">
                    {r.rentabilidadeDiaria != null
                      ? `${(r.rentabilidadeDiaria * 100).toFixed(2)}%`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-right font-mono">
                    {r.multiplicador > 0
                      ? (r.multiplicador * 100).toFixed(6) + "%"
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {!loading && selectedId && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhum dado encontrado para o produto selecionado.
        </p>
      )}
    </div>
  );
}

// Helpers
function getDateMinus(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function formatDate(d: string): string {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function fmt(v: number, decimals: number): string {
  return v.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtCurrency(v: number): string {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDataReferencia } from "@/contexts/DataReferenciaContext";
import { calcularRendaFixaDiario } from "@/lib/rendaFixaEngine";
import { Input } from "@/components/ui/input";
import { Search, CircleCheck, CircleX } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface CustodiaProduct {
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
  valor_investido: number;
  instituicao_nome: string;
  quantidade: number | null;
}

interface PosicaoRow {
  nome: string;
  valorAtualizado: number;
  ganhoFinanceiro: number;
  rentabilidade: number;
  quantidade: number | null;
  precoUnitario: number;
  custodiante: string;
  ativo: boolean;
}

export default function PosicaoConsolidadaPage() {
  const { user } = useAuth();
  const { appliedVersion, dataReferenciaISO } = useDataReferencia();
  const [rows, setRows] = useState<PosicaoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user) return;
    calculate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, appliedVersion]);

  async function calculate() {
    setLoading(true);
    try {
      const { data: products } = await supabase
        .from("custodia")
        .select("id, codigo_custodia, nome, data_inicio, data_calculo, taxa, modalidade, multiplicador, preco_unitario, valor_investido, resgate_total, pagamento, vencimento, indexador, data_limite, quantidade, categorias(nome), produtos(nome), instituicoes(nome)")
        .eq("user_id", user!.id);

      if (!products || products.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      const mapped = products.map((r: any) => ({
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
        valor_investido: Number(r.valor_investido),
        instituicao_nome: r.instituicoes?.nome || "—",
        quantidade: r.quantidade != null ? Number(r.quantidade) : null,
      })) as CustodiaProduct[];

      // Only process Renda Fixa (Prefixado/Pós-fixado/Mista) for now
      const rfProducts = mapped.filter((p) => p.categoria_nome === "Renda Fixa");
      const otherProducts = mapped.filter((p) => p.categoria_nome !== "Renda Fixa");

      // Determine date range
      const minDate = rfProducts.reduce((min, p) => (p.data_inicio < min ? p.data_inicio : min), rfProducts[0]?.data_inicio || dataReferenciaISO);
      const maxDate = rfProducts.reduce((max, p) => {
        const end = p.resgate_total || p.vencimento || dataReferenciaISO;
        return end > max ? end : max;
      }, dataReferenciaISO);

      // Batch fetch calendar, CDI, and movements
      const allCodigos = rfProducts.map((p) => p.codigo_custodia);
      const [calRes, cdiRes, movRes] = await Promise.all([
        supabase.from("calendario_dias_uteis").select("data, dia_util")
          .gte("data", getDateMinus(minDate, 5)).lte("data", maxDate).order("data"),
        supabase.from("historico_cdi").select("data, taxa_anual")
          .gte("data", getDateMinus(minDate, 5)).lte("data", maxDate).order("data"),
        allCodigos.length > 0
          ? supabase.from("movimentacoes").select("data, tipo_movimentacao, valor, codigo_custodia")
              .in("codigo_custodia", allCodigos).eq("user_id", user!.id).order("data")
          : Promise.resolve({ data: [] }),
      ]);

      const calendario = (calRes.data || []).map((c: any) => ({ data: c.data, dia_util: c.dia_util }));
      const cdiRecords = (cdiRes.data || []).map((c: any) => ({ data: c.data, taxa_anual: Number(c.taxa_anual) }));

      const cdiMap = new Map<string, number>();
      for (const c of cdiRecords) cdiMap.set(c.data, c.taxa_anual);

      const movByCodigo = new Map<number, { data: string; tipo_movimentacao: string; valor: number }[]>();
      for (const m of ((movRes as any).data || [])) {
        const code = m.codigo_custodia as number;
        if (!movByCodigo.has(code)) movByCodigo.set(code, []);
        movByCodigo.get(code)!.push({ data: m.data, tipo_movimentacao: m.tipo_movimentacao, valor: Number(m.valor) });
      }

      const posicaoRows: PosicaoRow[] = [];

      for (const product of rfProducts) {
        const dataFim = product.resgate_total || product.vencimento || product.data_calculo || "2099-12-31";
        const isEncerrado = product.resgate_total
          ? product.resgate_total <= dataReferenciaISO
          : product.vencimento
            ? product.vencimento <= dataReferenciaISO
            : false;

        const calcEnd = dataFim > dataReferenciaISO ? dataReferenciaISO : dataFim;

        const engineRows = calcularRendaFixaDiario({
          dataInicio: product.data_inicio,
          dataCalculo: calcEnd,
          taxa: product.taxa || 0,
          modalidade: product.modalidade || "",
          puInicial: product.preco_unitario || 1000,
          calendario,
          movimentacoes: movByCodigo.get(product.codigo_custodia) || [],
          dataResgateTotal: product.resgate_total,
          pagamento: product.pagamento,
          vencimento: product.vencimento,
          indexador: product.indexador,
          cdiRecords,
          dataLimite: product.data_limite,
          precomputedCdiMap: cdiMap,
          calendarioSorted: true,
        });

        const lastRow = engineRows.length > 0 ? engineRows[engineRows.length - 1] : null;

        if (lastRow) {
          const usePeriodic = product.pagamento && product.pagamento !== "No Vencimento";
          const rentPct = usePeriodic ? lastRow.rentAcumulada2 : lastRow.rentabilidadeAcumuladaPct;

          posicaoRows.push({
            nome: product.nome || product.produto_nome,
            valorAtualizado: isEncerrado ? 0 : lastRow.liquido,
            ganhoFinanceiro: lastRow.ganhoAcumulado,
            rentabilidade: (rentPct ?? 0) * 100,
            quantidade: product.quantidade,
            precoUnitario: lastRow.precoUnitario,
            custodiante: product.instituicao_nome,
            ativo: !isEncerrado,
          });
        }
      }

      // Non-RF products: show basic info without engine calculation
      for (const product of otherProducts) {
        posicaoRows.push({
          nome: product.nome || product.produto_nome,
          valorAtualizado: product.valor_investido,
          ganhoFinanceiro: 0,
          rentabilidade: 0,
          quantidade: product.quantidade,
          precoUnitario: product.preco_unitario || 0,
          custodiante: product.instituicao_nome,
          ativo: true,
        });
      }

      setRows(posicaoRows);
    } catch (err) {
      console.error("Erro ao calcular posição consolidada:", err);
    } finally {
      setLoading(false);
    }
  }

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const term = search.toLowerCase();
    return rows.filter((r) => r.nome.toLowerCase().includes(term));
  }, [rows, search]);

  const totalValor = useMemo(() => filteredRows.reduce((s, r) => s + r.valorAtualizado, 0), [filteredRows]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Posição Consolidada</h1>

      <div className="flex items-center gap-4">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar ativo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <span className="text-sm text-muted-foreground">
          Data de referência:{" "}
          <span className="font-medium text-foreground">
            {new Date(dataReferenciaISO + "T12:00:00").toLocaleDateString("pt-BR")}
          </span>
        </span>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Carregando posição...</p>}

      {!loading && filteredRows.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum ativo encontrado.</p>
      )}

      {!loading && filteredRows.length > 0 && (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[50px]">Status</TableHead>
                <TableHead className="min-w-[250px]">Ativo</TableHead>
                <TableHead className="min-w-[130px]">Valor Atualizado</TableHead>
                <TableHead className="min-w-[130px]">Ganho Financeiro</TableHead>
                <TableHead className="min-w-[110px]">Rentabilidade</TableHead>
                <TableHead className="min-w-[100px]">Quantidade</TableHead>
                <TableHead className="min-w-[130px]">Preço Unitário</TableHead>
                <TableHead className="min-w-[150px]">Custodiante</TableHead>
                <TableHead className="min-w-[110px] text-right">% do Portfólio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row, i) => {
                const pctPortfolio = totalValor > 0 ? (row.valorAtualizado / totalValor) * 100 : 0;
                return (
                  <TableRow key={i}>
                    <TableCell>
                      {row.ativo ? (
                        <CircleCheck className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <CircleX className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{row.nome}</TableCell>
                    <TableCell>{fmtBrl(row.valorAtualizado)}</TableCell>
                    <TableCell className={row.ganhoFinanceiro >= 0 ? "text-emerald-600" : "text-destructive"}>
                      {fmtBrl(row.ganhoFinanceiro)}
                    </TableCell>
                    <TableCell className={row.rentabilidade >= 0 ? "text-emerald-600" : "text-destructive"}>
                      {row.rentabilidade.toFixed(2)}%
                    </TableCell>
                    <TableCell>{row.quantidade != null ? row.quantidade.toLocaleString("pt-BR") : "—"}</TableCell>
                    <TableCell>{fmtBrl(row.precoUnitario)}</TableCell>
                    <TableCell>{row.custodiante}</TableCell>
                    <TableCell className="text-right font-medium">{pctPortfolio.toFixed(2)}%</TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell />
                <TableCell>Total</TableCell>
                <TableCell>{fmtBrl(totalValor)}</TableCell>
                <TableCell className="text-emerald-600">
                  {fmtBrl(filteredRows.reduce((s, r) => s + r.ganhoFinanceiro, 0))}
                </TableCell>
                <TableCell />
                <TableCell />
                <TableCell />
                <TableCell />
                <TableCell className="text-right">100,00%</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function fmtBrl(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getDateMinus(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

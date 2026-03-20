import { useEffect, useState } from "react";
import { ArrowUpDown, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { fullSyncAfterDelete } from "@/lib/syncEngine";
import { useDataReferencia } from "@/contexts/DataReferenciaContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Movimentacao {
  id: string;
  created_at: string;
  data: string;
  tipo_movimentacao: string;
  pagamento: string | null;
  nome_ativo: string | null;
  instituicao: string | null;
  quantidade: number | null;
  preco_unitario: number | null;
  valor: number | null;
  origem: string;
  codigo_custodia: number | null;
}

type SortField = keyof Movimentacao;
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortField; label: string }[] = [
  { key: "data", label: "Data" },
  { key: "nome_ativo", label: "Nome do Ativo" },
  { key: "tipo_movimentacao", label: "Tipo Mov." },
  { key: "instituicao", label: "Instituição" },
  { key: "pagamento", label: "Pagamento" },
  { key: "quantidade", label: "Quantidade" },
  { key: "preco_unitario", label: "Preço Unitário" },
  { key: "valor", label: "Valor" },
];

export default function MovimentacoesPage() {
  const navigate = useNavigate();
  const { dataReferenciaISO, applyDataReferencia, appliedVersion } = useDataReferencia();
  const [rows, setRows] = useState<Movimentacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>("data");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchData = async () => {
    const { data, error } = await supabase
      .from("movimentacoes")
      .select(`
        id, created_at, data, tipo_movimentacao,
        pagamento, nome_ativo, quantidade, preco_unitario,
        valor, origem, codigo_custodia,
        instituicoes(nome)
      `)
      .order("data", { ascending: false });

    if (!error && data) {
      setRows(
        data.map((r: any) => ({
          id: r.id,
          created_at: r.created_at,
          data: r.data,
          tipo_movimentacao: r.tipo_movimentacao,
          pagamento: r.pagamento,
          nome_ativo: r.nome_ativo,
          instituicao: r.instituicoes?.nome ?? null,
          quantidade: r.quantidade ?? null,
          preco_unitario: r.preco_unitario ?? null,
          valor: r.valor ?? null,
          origem: r.origem ?? "manual",
          codigo_custodia: r.codigo_custodia ?? null,
        }))
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [appliedVersion]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    // Find the row to check if it's "Aplicação Inicial"
    const deletingRow = rows.find((r) => r.id === deleteId);

    // Fetch movimentacao details before deleting (for sync)
    const { data: movData } = await supabase
      .from("movimentacoes")
      .select("codigo_custodia, categoria_id, user_id, tipo_movimentacao")
      .eq("id", deleteId)
      .single();

    const isAplicacaoInicial = movData?.tipo_movimentacao === "Aplicação Inicial";

    if (isAplicacaoInicial && movData?.codigo_custodia) {
      // Delete all movimentações for this codigo_custodia
      const { error: movError } = await supabase
        .from("movimentacoes")
        .delete()
        .eq("codigo_custodia", movData.codigo_custodia)
        .eq("user_id", movData.user_id!);

      if (movError) {
        toast.error("Erro ao excluir movimentações do ativo.");
        console.error(movError);
        setDeleteId(null);
        return;
      }

      // Delete custodia record
      const { error: custError } = await supabase
        .from("custodia")
        .delete()
        .eq("codigo_custodia", movData.codigo_custodia)
        .eq("user_id", movData.user_id!);

      if (custError) {
        console.error(custError);
      }

      toast.success("Ativo, custódia e todas as movimentações excluídos com sucesso.");
      setRows((prev) => prev.filter((r) => r.codigo_custodia !== movData.codigo_custodia));

      await fullSyncAfterDelete(
        movData.codigo_custodia,
        movData.categoria_id,
        movData.user_id!,
        dataReferenciaISO
      );
      applyDataReferencia();
    } else {
      // Normal single delete
      const { error } = await supabase.from("movimentacoes").delete().eq("id", deleteId);
      if (error) {
        toast.error("Erro ao excluir movimentação.");
        console.error(error);
      } else {
        toast.success("Movimentação excluída com sucesso.");
        setRows((prev) => prev.filter((r) => r.id !== deleteId));

        if (movData) {
          await fullSyncAfterDelete(
            movData.codigo_custodia,
            movData.categoria_id,
            movData.user_id!,
            dataReferenciaISO
          );
          applyDataReferencia();
        }
      }
    }
    setDeleteId(null);
  };

  const handleEdit = (id: string) => {
    navigate(`/cadastrar-transacao?edit=${id}`);
  };

  const sortedRows = [...rows].sort((a, b) => {
    const valA = a[sortField] ?? "";
    const valB = b[sortField] ?? "";
    const cmp = String(valA).localeCompare(String(valB), "pt-BR", { numeric: true });
    return sortDir === "asc" ? cmp : -cmp;
  });

  const fmtDate = (d: string | null) =>
    d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";

  const colSpan = COLUMNS.length + 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Movimentações</h1>
        <p className="text-xs text-muted-foreground">Extrato de todas as movimentações registradas</p>
      </div>

      <div className="rounded-md border border-border overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-primary text-primary-foreground">
              {COLUMNS.map((col) => {
                const isNumeric = false;
                return (
                  <th
                    key={col.key}
                    className={`px-3 py-2 font-medium whitespace-nowrap cursor-pointer select-none hover:bg-primary/80 transition-colors ${isNumeric ? "text-right" : "text-left"}`}
                    onClick={() => handleSort(col.key)}
                  >
                    <span className={`inline-flex items-center gap-1 ${isNumeric ? "justify-end" : ""}`}>
                      {col.label}
                      <ArrowUpDown size={12} className={sortField === col.key ? "opacity-100" : "opacity-40"} />
                    </span>
                  </th>
                );
              })}
              <th className="px-3 py-2 text-center font-medium whitespace-nowrap">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={colSpan} className="px-4 py-8 text-center text-muted-foreground">Carregando...</td></tr>
            ) : sortedRows.length === 0 ? (
              <tr><td colSpan={colSpan} className="px-4 py-8 text-center text-muted-foreground">Nenhuma movimentação encontrada.</td></tr>
            ) : (
              sortedRows.map((r, i) => (
                <tr key={r.id} className={`border-t border-border ${i % 2 === 0 ? "bg-card" : "bg-muted/30"}`}>
                  <td className="px-3 py-2 text-foreground whitespace-nowrap">{fmtDate(r.data)}</td>
                  <td className="px-3 py-2 text-foreground whitespace-nowrap">{r.nome_ativo ?? "—"}</td>
                  <td className="px-3 py-2 text-foreground whitespace-nowrap">{r.tipo_movimentacao}</td>
                  <td className="px-3 py-2 text-foreground">{r.instituicao ?? "—"}</td>
                  <td className="px-3 py-2 text-foreground">{r.pagamento ?? "—"}</td>
                  <td className="px-3 py-2 text-foreground whitespace-nowrap">
                    {r.quantidade != null ? r.quantidade.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                  </td>
                  <td className="px-3 py-2 text-foreground whitespace-nowrap">
                    {r.preco_unitario != null ? r.preco_unitario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
                  </td>
                  <td className="px-3 py-2 text-foreground whitespace-nowrap">
                    {r.valor != null ? r.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-center">
                    {r.origem === "automatico" ? (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Auto</Badge>
                    ) : (
                      <>
                        <button
                          onClick={() => handleEdit(r.id)}
                          className="text-muted-foreground hover:text-foreground transition-colors mr-2"
                          title="Editar"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteId(r.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const row = rows.find((r) => r.id === deleteId);
                if (row?.tipo_movimentacao === "Aplicação Inicial") {
                  return "Ao excluir uma Aplicação Inicial, o título será removido da custódia e todas as movimentações deste código serão excluídas permanentemente.";
                }
                return "Tem certeza que deseja excluir esta movimentação? Esta ação não pode ser desfeita.";
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { useEffect, useState } from "react";
import { ArrowUpDown, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
  vencimento: string | null;
  nome_ativo: string | null;
  categoria: string;
  instituicao: string | null;
  valor_extrato: string | null;
  codigo_custodia: number | null;
  categoria_id: string;
  user_id: string | null;
}

type SortField = "data" | "categoria" | "nome_ativo" | "tipo_movimentacao" | "instituicao" | "pagamento" | "valor_extrato" | "vencimento";
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortField; label: string }[] = [
  { key: "data", label: "Data" },
  { key: "tipo_movimentacao", label: "Tipo Mov." },
  { key: "valor_extrato", label: "Valor Extrato" },
];

interface Props {
  codigoCustodia: number;
}

export default function MovimentacoesAtivo({ codigoCustodia }: Props) {
  const navigate = useNavigate();
  const { dataReferenciaISO } = useDataReferencia();
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
        pagamento, vencimento, nome_ativo,
        valor_extrato, codigo_custodia, categoria_id, user_id,
        categorias(nome), instituicoes(nome)
      `)
      .eq("codigo_custodia", codigoCustodia)
      .order("data", { ascending: false });

    if (!error && data) {
      setRows(
        data.map((r: any) => ({
          id: r.id,
          created_at: r.created_at,
          data: r.data,
          tipo_movimentacao: r.tipo_movimentacao,
          pagamento: r.pagamento,
          vencimento: r.vencimento,
          nome_ativo: r.nome_ativo,
          categoria: r.categorias?.nome ?? "—",
          instituicao: r.instituicoes?.nome ?? null,
          valor_extrato: r.valor_extrato,
          codigo_custodia: r.codigo_custodia,
          categoria_id: r.categoria_id,
          user_id: r.user_id,
        }))
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [codigoCustodia]);

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
    const mov = rows.find((r) => r.id === deleteId);
    const { error } = await supabase.from("movimentacoes").delete().eq("id", deleteId);
    if (error) {
      toast.error("Erro ao excluir movimentação.");
    } else {
      toast.success("Movimentação excluída com sucesso.");
      setRows((prev) => prev.filter((r) => r.id !== deleteId));
      if (mov) {
        await fullSyncAfterDelete(
          mov.codigo_custodia,
          mov.categoria_id,
          mov.user_id!,
          dataReferenciaISO
        );
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
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">Movimentações do Ativo</h2>
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
                  <td className="px-3 py-2 text-foreground whitespace-nowrap">{r.tipo_movimentacao}</td>
                  <td className="px-3 py-2 text-foreground whitespace-nowrap">{r.valor_extrato ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-center">
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
              Tem certeza que deseja excluir esta movimentação? Esta ação não pode ser desfeita.
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

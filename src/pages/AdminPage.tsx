import { useState } from "react";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function AdminPage() {
  const [deleting, setDeleting] = useState(false);

  const handlePurge = async () => {
    if (!window.confirm("Tem certeza que deseja excluir TODOS os registros de Movimentações e Custódia? Esta ação é irreversível.")) {
      return;
    }

    setDeleting(true);
    try {
      // Delete custodia first (no FK dependency on movimentacoes but logically linked)
      const { error: custErr } = await supabase.from("custodia").delete().gte("codigo_custodia", 0);
      if (custErr) throw custErr;

      const { error: movErr } = await supabase.from("movimentacoes").delete().gte("created_at", "1970-01-01");
      if (movErr) throw movErr;

      const { error: cartErr } = await supabase.from("controle_de_carteiras").delete().gte("created_at", "1970-01-01");
      if (cartErr) throw cartErr;

      toast.success("Todos os registros foram excluídos com sucesso.");
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao excluir registros.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Admin</h1>
        <p className="text-xs text-muted-foreground">Ferramentas administrativas do sistema</p>
      </div>

      <div className="rounded-md border border-border bg-card p-6 max-w-lg space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Limpar Base de Dados</h2>
        <p className="text-xs text-muted-foreground">
          Remove todos os registros das tabelas de Movimentações e Custódia. Esta ação é irreversível.
        </p>
        <button
          onClick={handlePurge}
          disabled={deleting}
          className="inline-flex items-center gap-2 rounded-md bg-destructive px-5 py-2.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
        >
          <Trash2 size={16} />
          {deleting ? "Excluindo..." : "Excluir Todos os Registros"}
        </button>
      </div>
    </div>
  );
}

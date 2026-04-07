import { useState } from "react";
import { Trash2, HelpCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserSettings } from "@/hooks/useUserSettings";
import { useDataReferencia } from "@/contexts/DataReferenciaContext";
import { recalculateAllForDataReferencia } from "@/lib/syncEngine";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function ConfiguracoesPage() {
  const { user } = useAuth();
  const { poupancaFifo, setPoupancaFifo, loading } = useUserSettings();
  const { dataReferencia, applyDataReferencia, setIsRecalculating } = useDataReferencia();
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);

  const handleToggleFifo = async (value: boolean) => {
    if (!user || toggling) return;
    setToggling(true);
    setIsRecalculating(true);
    try {
      await setPoupancaFifo(value);
      await recalculateAllForDataReferencia(user.id, format(dataReferencia, "yyyy-MM-dd"));
      applyDataReferencia();
      toast.success("Modelo de poupança atualizado com sucesso");
    } catch (err) {
      console.error("Erro ao recalcular após alteração do modelo", err);
      toast.error("Erro ao recalcular");
    } finally {
      setIsRecalculating(false);
      setToggling(false);
    }
  };

  const handleReset = async () => {
    if (!user) return;
    if (
      !window.confirm(
        "Tem certeza que deseja redefinir TODAS as movimentações, custódia e carteiras? Esta ação é irreversível."
      )
    )
      return;

    setDeleting(true);
    try {
      const { error: custErr } = await supabase
        .from("custodia")
        .delete()
        .gte("codigo_custodia", 0);
      if (custErr) throw custErr;

      const { error: movErr } = await supabase
        .from("movimentacoes")
        .delete()
        .gte("created_at", "1970-01-01");
      if (movErr) throw movErr;

      const { error: cartErr } = await supabase
        .from("controle_de_carteiras")
        .delete()
        .gte("created_at", "1970-01-01");
      if (cartErr) throw cartErr;

      toast.success("Todos os registros foram redefinidos com sucesso.");
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao redefinir registros.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Configurações</h1>
        <p className="text-xs text-muted-foreground">
          Personalize o comportamento da sua ferramenta
        </p>
      </div>

      {/* Poupança FIFO */}
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-sm">Poupança</CardTitle>
          <CardDescription>Modelo de resgate da poupança</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-foreground">
                Poupança com resgate no modelo FIFO (First In, First Out)
              </span>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle
                      size={15}
                      className="text-muted-foreground cursor-help shrink-0"
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                    <p>
                      No modelo FIFO os resgates sempre procuram as aplicações
                      mais antigas para desconto. Metodologia usada pelos bancos
                      para pagamento. Sua ferramenta irá apresentar apenas uma
                      linha de produto. &quot;Poupança&quot;.
                    </p>
                    <p className="mt-2">
                      <strong>Modelo de resgate por certificado:</strong> Ideal
                      para simulações. Não indicado para quem quer reproduzir os
                      valores do extrato bancário.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Switch
              checked={poupancaFifo}
              onCheckedChange={setPoupancaFifo}
              disabled={loading}
            />
          </div>
        </CardContent>
      </Card>

      {/* Redefinir Movimentações */}
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-sm">Redefinir Movimentações</CardTitle>
          <CardDescription>
            Remove todos os registros das tabelas de Movimentações, Custódia e
            Carteiras. Esta ação é irreversível.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <button
            onClick={handleReset}
            disabled={deleting}
            className="inline-flex items-center gap-2 rounded-md bg-destructive px-5 py-2.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
          >
            <Trash2 size={16} />
            {deleting ? "Redefinindo..." : "Redefinir Movimentações"}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}

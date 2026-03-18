import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { fullSyncAfterMovimentacao } from "@/lib/syncEngine";
import { calcSaldoPrefixado } from "@/lib/saldoCalculations";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Alert, AlertDescription } from "@/components/ui/alert";

export interface CustodiaRowForBoleta {
  id: string;
  codigo_custodia: number;
  data_inicio: string;
  nome: string | null;
  categoria: string;
  categoria_id: string;
  produto: string;
  produto_id: string;
  instituicao: string | null;
  instituicao_id: string | null;
  emissor: string | null;
  emissor_id: string | null;
  modalidade: string | null;
  indexador: string | null;
  taxa: number | null;
  pagamento: string | null;
  vencimento: string | null;
  preco_unitario: number | null;
  valor_investido: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  tipo: "Aplicação" | "Resgate";
  row: CustodiaRowForBoleta;
  userId: string;
  dataReferenciaISO: string;
  onSuccess: () => void;
}

function formatCurrency(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  const num = parseInt(digits, 10) / 100;
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseCurrencyToNumber(value: string): number {
  const cleaned = value.replace(/\./g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
}

export default function BoletaCustodiaDialog({
  open,
  onClose,
  tipo,
  row,
  userId,
  dataReferenciaISO,
  onSuccess,
}: Props) {
  const [date, setDate] = useState<Date | undefined>();
  const [valor, setValor] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [saldoDisponivel, setSaldoDisponivel] = useState<number | null>(null);
  const [loadingSaldo, setLoadingSaldo] = useState(false);

  const fmtReadonly = (v: string | null | undefined) => v ?? "—";
  const fmtTaxa = (v: number | null) =>
    v != null ? `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : "—";
  const fmtDate = (d: string | null) =>
    d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";

  const handleDateSelect = async (d: Date | undefined) => {
    setDate(d);
    if (!d || tipo !== "Resgate") return;

    // Calcular saldo disponível para resgate
    if (row.modalidade === "Prefixado" && row.taxa) {
      setLoadingSaldo(true);
      try {
        const dateISO = format(d, "yyyy-MM-dd");
        const saldo = await calcSaldoPrefixado(
          row.valor_investido,
          row.taxa,
          row.data_inicio,
          dateISO,
          row.codigo_custodia,
          userId
        );
        setSaldoDisponivel(saldo);
      } catch {
        setSaldoDisponivel(null);
      } finally {
        setLoadingSaldo(false);
      }
    }
  };

  const handleSubmit = async () => {
    if (!date) {
      toast.error("Selecione a data da operação.");
      return;
    }
    const valorNum = parseCurrencyToNumber(valor);
    if (valorNum <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }

    const dateISO = format(date, "yyyy-MM-dd");

    // Validar dia útil
    const { data: diaUtil } = await supabase
      .from("calendario_dias_uteis")
      .select("dia_util")
      .eq("data", dateISO)
      .maybeSingle();

    if (!diaUtil || !diaUtil.dia_util) {
      toast.error("A data selecionada não é um dia útil.");
      return;
    }

    // Validar saldo para resgate
    if (tipo === "Resgate" && saldoDisponivel != null && valorNum > saldoDisponivel) {
      toast.error("Valor excede o saldo disponível para resgate.");
      return;
    }

    setSubmitting(true);
    try {
      const isAplicacao = tipo === "Aplicação";
      const quantidade = isAplicacao && row.preco_unitario
        ? valorNum / row.preco_unitario
        : null;
      const pu = isAplicacao ? row.preco_unitario : null;

      let valorExtrato: string;
      if (isAplicacao && pu && quantidade) {
        const fmtVal = valorNum.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const fmtPU = pu.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const fmtQtd = quantidade.toLocaleString("pt-BR", { minimumFractionDigits: 6, maximumFractionDigits: 6 });
        valorExtrato = `R$ ${fmtVal} (${fmtPU} x ${fmtQtd})`;
      } else {
        valorExtrato = `R$ ${valorNum.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }

      const { data: inserted, error } = await supabase
        .from("movimentacoes")
        .insert({
          user_id: userId,
          data: dateISO,
          tipo_movimentacao: tipo,
          codigo_custodia: row.codigo_custodia,
          categoria_id: row.categoria_id,
          produto_id: row.produto_id,
          instituicao_id: row.instituicao_id,
          emissor_id: row.emissor_id,
          modalidade: row.modalidade,
          indexador: row.indexador,
          taxa: row.taxa,
          pagamento: row.pagamento,
          vencimento: row.vencimento,
          preco_unitario: pu,
          quantidade,
          valor: valorNum,
          valor_extrato: valorExtrato,
          nome_ativo: row.nome,
        })
        .select("id")
        .single();

      if (error) throw error;

      await fullSyncAfterMovimentacao(inserted.id, row.categoria_id, userId, dataReferenciaISO);
      toast.success(`${tipo} registrada com sucesso!`);
      handleClose();
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Erro ao registrar movimentação.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setDate(undefined);
    setValor("");
    setSaldoDisponivel(null);
    onClose();
  };

  const readonlyFields = [
    { label: "Nome", value: fmtReadonly(row.nome) },
    { label: "Categoria", value: row.categoria },
    { label: "Produto", value: row.produto },
    { label: "Instituição", value: fmtReadonly(row.instituicao) },
    { label: "Emissor", value: fmtReadonly(row.emissor) },
    { label: "Modalidade", value: fmtReadonly(row.modalidade) },
    { label: "Indexador", value: fmtReadonly(row.indexador) },
    { label: "Taxa", value: fmtTaxa(row.taxa) },
    { label: "Pagamento", value: fmtReadonly(row.pagamento) },
    { label: "Vencimento", value: fmtDate(row.vencimento) },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            {tipo === "Aplicação" ? "Aplicação Adicional" : "Resgate"} — {row.nome ?? `Cód. ${row.codigo_custodia}`}
          </DialogTitle>
        </DialogHeader>

        {/* Campos somente leitura */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {readonlyFields.map((f) => (
            <div key={f.label}>
              <span className="text-muted-foreground text-xs">{f.label}</span>
              <p className="font-medium text-foreground truncate">{f.value}</p>
            </div>
          ))}
        </div>

        <div className="border-t border-border my-2" />

        {/* Data */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground">Data da Transação *</label>
          <Input
            type="date"
            value={date ? format(date, "yyyy-MM-dd") : ""}
            onChange={(e) => {
              const val = e.target.value;
              if (val) {
                const d = new Date(val + "T00:00:00");
                handleDateSelect(d);
              } else {
                handleDateSelect(undefined);
              }
            }}
          />
        </div>

        {/* Valor */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Valor (R$) *</label>
          <Input
            placeholder="0,00"
            value={valor}
            onChange={(e) => setValor(formatCurrency(e.target.value))}
          />
        </div>

        {/* Saldo disponível para resgate */}
        {tipo === "Resgate" && date && (
          <div className="text-sm">
            {loadingSaldo ? (
              <p className="text-muted-foreground">Calculando saldo...</p>
            ) : saldoDisponivel != null ? (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Saldo disponível para resgate:{" "}
                  <strong>
                    R${" "}
                    {saldoDisponivel.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </strong>
                </AlertDescription>
              </Alert>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Registrando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

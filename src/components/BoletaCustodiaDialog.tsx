import { useState, useEffect } from "react";
import { format } from "date-fns";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { fullSyncAfterMovimentacao } from "@/lib/syncEngine";
import { calcularRendaFixaDiario } from "@/lib/rendaFixaEngine";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";

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

function numberToCurrency(num: number): string {
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  const [valorCotaDia, setValorCotaDia] = useState<number | null>(null);
  const [loadingCota, setLoadingCota] = useState(false);
  const [fecharPosicao, setFecharPosicao] = useState(false);

  const fmtReadonly = (v: string | null | undefined) => v ?? "—";
  const fmtTaxa = (v: number | null) =>
    v != null ? `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : "—";
  const fmtDate = (d: string | null) =>
    d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";

  // Auto-check fecharPosicao when valor matches saldoDisponivel
  useEffect(() => {
    if (tipo !== "Resgate" || saldoDisponivel == null || saldoDisponivel <= 0) return;
    const valorNum = parseCurrencyToNumber(valor);
    if (valorNum > 0 && Math.abs(valorNum - saldoDisponivel) < 0.01) {
      if (!fecharPosicao) setFecharPosicao(true);
    }
  }, [valor, saldoDisponivel, tipo]);

  const handleFecharPosicaoChange = (checked: boolean) => {
    setFecharPosicao(checked);
    if (checked && saldoDisponivel != null && saldoDisponivel > 0) {
      setValor(numberToCurrency(saldoDisponivel));
    } else if (!checked) {
      setValor("");
    }
  };

  const handleDateSelect = async (d: Date | undefined) => {
    setDate(d);
    setValorCotaDia(null);
    setSaldoDisponivel(null);
    setFecharPosicao(false);
    setValor("");
    if (!d) return;

    const dateISO = format(d, "yyyy-MM-dd");

    if (row.modalidade === "Prefixado" && row.taxa && row.preco_unitario) {
      setLoadingCota(true);
      if (tipo === "Resgate") setLoadingSaldo(true);
      try {
        const [calRes, movRes, custRes] = await Promise.all([
          supabase
            .from("calendario_dias_uteis")
            .select("data, dia_util")
            .gte("data", row.data_inicio)
            .lte("data", dateISO)
            .order("data"),
          supabase
            .from("movimentacoes")
            .select("data, tipo_movimentacao, valor")
            .eq("codigo_custodia", row.codigo_custodia)
            .eq("user_id", userId)
            .order("data"),
          supabase
            .from("custodia")
            .select("resgate_total")
            .eq("codigo_custodia", row.codigo_custodia)
            .eq("user_id", userId)
            .maybeSingle(),
        ]);

        const calendario = calRes.data || [];
        const movimentacoes = (movRes.data || []).map((m: any) => ({
          data: m.data,
          tipo_movimentacao: m.tipo_movimentacao,
          valor: Number(m.valor),
        }));

        const rows = calcularRendaFixaDiario({
          dataInicio: row.data_inicio,
          dataCalculo: dateISO,
          taxa: row.taxa,
          modalidade: row.modalidade,
          puInicial: row.preco_unitario,
          calendario,
          movimentacoes,
          dataResgateTotal: custRes.data?.resgate_total ?? null,
        });

        const rowDia = rows.find((r) => r.data === dateISO);
        if (rowDia) {
          setValorCotaDia(tipo === "Aplicação" ? rowDia.valorCota : rowDia.valorCota2);
          if (tipo === "Resgate") {
            setSaldoDisponivel(rowDia.liquido);
          }
        }
      } catch {
        setValorCotaDia(null);
        setSaldoDisponivel(null);
      } finally {
        setLoadingCota(false);
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

    const { data: diaUtil } = await supabase
      .from("calendario_dias_uteis")
      .select("dia_util")
      .eq("data", dateISO)
      .maybeSingle();

    if (!diaUtil || !diaUtil.dia_util) {
      toast.error("A data selecionada não é um dia útil.");
      return;
    }

    if (tipo === "Resgate" && saldoDisponivel != null && valorNum > saldoDisponivel) {
      toast.error("Valor excede o saldo disponível para resgate.");
      return;
    }

    setSubmitting(true);
    try {
      const tipoMovimentacao = fecharPosicao ? "Resgate Total" : tipo;
      const pu = valorCotaDia ?? row.preco_unitario;
      const quantidade = pu && pu > 0 ? valorNum / pu : null;

      let valorExtrato: string;
      if (pu && quantidade) {
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
          tipo_movimentacao: tipoMovimentacao,
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
          origem: "manual",
        })
        .select("id")
        .single();

      if (error) throw error;

      await fullSyncAfterMovimentacao(inserted.id, row.categoria_id, userId, dataReferenciaISO);
      toast.success(`${tipoMovimentacao} registrado com sucesso!`);
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
    setValorCotaDia(null);
    setFecharPosicao(false);
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

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {readonlyFields.map((f) => (
            <div key={f.label}>
              <span className="text-muted-foreground text-xs">{f.label}</span>
              <p className="font-medium text-foreground truncate">{f.value}</p>
            </div>
          ))}
        </div>

        <div className="border-t border-border my-2" />

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

        {tipo === "Aplicação" && date && loadingCota && (
          <p className="text-sm text-muted-foreground">Calculando...</p>
        )}

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

        {/* Fechar Posição checkbox */}
        {tipo === "Resgate" && date && saldoDisponivel != null && saldoDisponivel > 0 && (
          <div className="flex items-center gap-2">
            <Checkbox
              id="fechar-posicao"
              checked={fecharPosicao}
              onCheckedChange={(checked) => handleFecharPosicaoChange(!!checked)}
            />
            <label htmlFor="fechar-posicao" className="text-sm font-medium text-foreground cursor-pointer">
              Fechar Posição
            </label>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Valor (R$) *</label>
          <Input
            placeholder="0,00"
            value={valor}
            disabled={fecharPosicao}
            onChange={(e) => setValor(formatCurrency(e.target.value))}
          />
        </div>

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
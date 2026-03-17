import { useState, useEffect } from "react";
import { ArrowLeft, PlusCircle, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useSearchParams, useNavigate } from "react-router-dom";
import { fullSyncAfterMovimentacao } from "@/lib/syncEngine";
import { useDataReferencia } from "@/contexts/DataReferenciaContext";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Categoria {
  id: string;
  nome: string;
}
interface Produto {
  id: string;
  nome: string;
}
interface Instituicao {
  id: string;
  nome: string;
}
interface Emissor {
  id: string;
  nome: string;
}
interface CustodiaItem {
  id: string;
  nome: string | null;
  codigo_custodia: number;
  data_inicio: string;
  valor_investido: number;
  taxa: number | null;
  indexador: string | null;
  vencimento: string | null;
  modalidade: string | null;
  pagamento: string | null;
  produto_id: string;
  instituicao_id: string | null;
  emissor_id: string | null;
  categoria_id: string;
}

const TIPOS_MOVIMENTACAO = [
  "Aplicação",
  "Aporte Adicional",
  "Resgate",
  "Pagamento de Juros",
  "Fechar Posição",
];

const PAGAMENTO_OPTIONS = [
  "Mensal",
  "Bimestral",
  "Trimestral",
  "Quatrimestral",
  "Semestral",
  "No Vencimento",
];

const MODALIDADE_OPTIONS = ["Prefixado", "Pós Fixado"];

const INDEXADOR_OPTIONS = ["% do CDI", "CDI+", "IPCA+", "IGP-M+"];

// ── Currency formatting helpers ──
function formatCurrency(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  const num = parseInt(digits, 10);
  const formatted = (num / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return formatted;
}

function parseCurrencyToNumber(value: string): number {
  const cleaned = value.replace(/\./g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
}

function buildNomeAtivo(
  produtoNome: string,
  emissorNome: string,
  modalidade: string,
  taxa: string,
  vencimento: string,
  indexador: string
): string {
  const taxaFormatted = taxa ? `${taxa.replace(".", ",")}%` : "";
  const vencFormatted = vencimento
    ? new Date(vencimento + "T00:00:00").toLocaleDateString("pt-BR")
    : "";

  if (modalidade === "Prefixado") {
    return [produtoNome, emissorNome, modalidade, taxaFormatted ? `${taxaFormatted} a.a.` : "", vencFormatted ? `- ${vencFormatted}` : ""]
      .filter(Boolean)
      .join(" ");
  }

  if (indexador === "% do CDI") {
    return [produtoNome, emissorNome, modalidade, taxaFormatted, "do", indexador.replace("% do ", ""), vencFormatted ? `- ${vencFormatted}` : ""]
      .filter(Boolean)
      .join(" ");
  }

  return [produtoNome, emissorNome, modalidade, indexador, taxaFormatted, vencFormatted ? `- ${vencFormatted}` : ""]
    .filter(Boolean)
    .join(" ");
}

// ── Saldo calculation helper ──
async function calcSaldoPrefixado(
  valorInvestido: number,
  taxa: number,
  dataInicio: string,
  dataConsulta: string,
  codigoCustodia: number,
  userId: string
): Promise<number> {
  const fd = Math.pow(1 + taxa / 100, 1 / 252) - 1;

  // Get all business days from data_inicio to dataConsulta
  const { data: diasUteis } = await supabase
    .from("calendario_dias_uteis")
    .select("data")
    .gt("data", dataInicio)
    .lte("data", dataConsulta)
    .eq("dia_util", true)
    .order("data");

  const bDays = new Set((diasUteis || []).map((d: any) => d.data));

  // Get previous resgates for this custodia
  const { data: resgates } = await supabase
    .from("movimentacoes")
    .select("data, valor")
    .eq("codigo_custodia", codigoCustodia)
    .eq("user_id", userId)
    .eq("tipo_movimentacao", "Resgate")
    .lte("data", dataConsulta)
    .order("data");

  // Build events: start + resgates
  const events: { data: string; valor: number }[] = [
    { data: dataInicio, valor: 0 },
    ...(resgates || []).map((r: any) => ({ data: r.data, valor: r.valor })),
  ];

  let patrimonio = valorInvestido;

  for (let i = 0; i < events.length; i++) {
    const segStart = events[i].data;
    const segEnd = i + 1 < events.length ? events[i + 1].data : dataConsulta;

    // Count business days in this segment (after segStart, up to segEnd)
    let count = 0;
    for (const d of bDays) {
      if (d > segStart && d <= segEnd) count++;
    }

    patrimonio *= Math.pow(1 + fd, count);

    // Apply next resgate
    if (i + 1 < events.length) {
      patrimonio -= events[i + 1].valor;
    }
  }

  return patrimonio;
}

export default function CadastrarTransacaoPage() {
  const { user } = useAuth();
  const { dataReferenciaISO } = useDataReferencia();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit");

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [instituicoes, setInstituicoes] = useState<Instituicao[]>([]);
  const [emissores, setEmissores] = useState<Emissor[]>([]);

  // Resgate-specific state
  const [custodiaItems, setCustodiaItems] = useState<CustodiaItem[]>([]);
  const [selectedCustodiaId, setSelectedCustodiaId] = useState("");
  const [saldoDisponivel, setSaldoDisponivel] = useState<number | null>(null);
  const [calculandoSaldo, setCalculandoSaldo] = useState(false);

  // form state
  const [categoriaId, setCategoriaId] = useState("");
  const [produtoId, setProdutoId] = useState("");
  const [tipoMovimentacao, setTipoMovimentacao] = useState("");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [valor, setValor] = useState("");
  const [precoUnitario, setPrecoUnitario] = useState("1.000,00");
  const [instituicaoId, setInstituicaoId] = useState("");
  const [emissorId, setEmissorId] = useState("");
  const [modalidade, setModalidade] = useState("");
  const [indexador, setIndexador] = useState("");
  const [taxa, setTaxa] = useState("");
  const [pagamento, setPagamento] = useState("No Vencimento");
  const [vencimento, setVencimento] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editLoaded, setEditLoaded] = useState(false);

  // Derived
  const categoriaSelecionada = categorias.find((c) => c.id === categoriaId);
  const isRendaFixa = categoriaSelecionada?.nome === "Renda Fixa";
  const isPosFixado = modalidade === "Pós Fixado";
  const isEditing = !!editId;
  const isResgate = tipoMovimentacao === "Resgate";
  const isAplicacao = tipoMovimentacao === "Aplicação";
  const selectedCustodia = custodiaItems.find((c) => c.id === selectedCustodiaId);

  // Load categorias on mount
  useEffect(() => {
    supabase
      .from("categorias")
      .select("id, nome")
      .eq("ativa", true)
      .order("nome")
      .then(({ data }) => {
        if (data) setCategorias(data);
      });
  }, []);

  // Load produtos when categoria changes (for Aplicação flow)
  useEffect(() => {
    if (!categoriaId) {
      setProdutos([]);
      return;
    }
    supabase
      .from("produtos")
      .select("id, nome")
      .eq("categoria_id", categoriaId)
      .eq("ativo", true)
      .order("nome")
      .then(({ data }) => {
        if (data) setProdutos(data);
      });
  }, [categoriaId]);

  // Load instituicoes and emissores once
  useEffect(() => {
    supabase
      .from("instituicoes")
      .select("id, nome")
      .eq("ativa", true)
      .order("nome")
      .then(({ data }) => {
        if (data) setInstituicoes(data);
      });
    supabase
      .from("emissores")
      .select("id, nome")
      .eq("ativo", true)
      .order("nome")
      .then(({ data }) => {
        if (data) setEmissores(data);
      });
  }, []);

  // Load custodia items when Resgate is selected
  useEffect(() => {
    if (!isResgate || !categoriaId || !user) {
      setCustodiaItems([]);
      return;
    }
    supabase
      .from("custodia")
      .select("id, nome, codigo_custodia, data_inicio, valor_investido, taxa, indexador, vencimento, modalidade, pagamento, produto_id, instituicao_id, emissor_id, categoria_id")
      .eq("categoria_id", categoriaId)
      .eq("user_id", user.id)
      .order("nome")
      .then(({ data }) => {
        if (data) setCustodiaItems(data as CustodiaItem[]);
      });
  }, [isResgate, categoriaId, user]);

  // Auto-fill fields when custodia item selected
  useEffect(() => {
    if (!selectedCustodia) return;
    setProdutoId(selectedCustodia.produto_id);
    setInstituicaoId(selectedCustodia.instituicao_id || "");
    setEmissorId(selectedCustodia.emissor_id || "");
    setModalidade(selectedCustodia.modalidade || "");
    setIndexador(selectedCustodia.indexador || "");
    setTaxa(selectedCustodia.taxa ? String(selectedCustodia.taxa) : "");
    setPagamento(selectedCustodia.pagamento || "No Vencimento");
    setVencimento(selectedCustodia.vencimento || "");
  }, [selectedCustodia]);

  // Calculate saldo disponível for Resgate
  useEffect(() => {
    if (!isResgate || !selectedCustodia || !data || !user) {
      setSaldoDisponivel(null);
      return;
    }

    let cancelled = false;
    setCalculandoSaldo(true);

    (async () => {
      try {
        if (selectedCustodia.modalidade === "Prefixado" && selectedCustodia.taxa) {
          const saldo = await calcSaldoPrefixado(
            selectedCustodia.valor_investido,
            selectedCustodia.taxa,
            selectedCustodia.data_inicio,
            data,
            selectedCustodia.codigo_custodia,
            user.id
          );
          if (!cancelled) setSaldoDisponivel(saldo);
        } else {
          // For other modalidades, use valor_investido as approximation
          if (!cancelled) setSaldoDisponivel(selectedCustodia.valor_investido);
        }
      } catch (err) {
        console.error("Erro ao calcular saldo:", err);
        if (!cancelled) setSaldoDisponivel(null);
      } finally {
        if (!cancelled) setCalculandoSaldo(false);
      }
    })();

    return () => { cancelled = true; };
  }, [isResgate, selectedCustodia, data, user]);

  // Load edit data
  useEffect(() => {
    if (!editId || editLoaded || categorias.length === 0) return;

    (async () => {
      const { data: mov } = await supabase
        .from("movimentacoes")
        .select("*")
        .eq("id", editId)
        .single();

      if (!mov) {
        toast.error("Movimentação não encontrada.");
        navigate("/movimentacoes");
        return;
      }

      setCategoriaId(mov.categoria_id);
      setTipoMovimentacao(mov.tipo_movimentacao);
      setProdutoId(mov.produto_id);
      setData(mov.data);
      setValor(mov.valor ? formatCurrency(Math.round(mov.valor * 100).toString()) : "");
      setPrecoUnitario(mov.preco_unitario ? formatCurrency(Math.round(mov.preco_unitario * 100).toString()) : "1.000,00");
      setInstituicaoId(mov.instituicao_id || "");
      setEmissorId(mov.emissor_id || "");
      setModalidade(mov.modalidade || "");
      setIndexador(mov.indexador || "");
      setTaxa(mov.taxa ? String(mov.taxa) : "");
      setPagamento(mov.pagamento || "No Vencimento");
      setVencimento(mov.vencimento || "");
      setEditLoaded(true);
    })();
  }, [editId, editLoaded, categorias]);

  // Step visibility
  const showTipoMovimentacao = !!categoriaId && isRendaFixa;
  const showAplicacaoFields = showTipoMovimentacao && !!produtoId && (isAplicacao || (isEditing && !!tipoMovimentacao && !isResgate));
  const showResgateFields = showTipoMovimentacao && isResgate && !isEditing;

  const resetForm = () => {
    setCategoriaId("");
    setProdutoId("");
    setTipoMovimentacao("");
    setData(new Date().toISOString().slice(0, 10));
    setValor("");
    setPrecoUnitario("1.000,00");
    setInstituicaoId("");
    setEmissorId("");
    setModalidade("");
    setIndexador("");
    setTaxa("");
    setPagamento("No Vencimento");
    setVencimento("");
    setSelectedCustodiaId("");
    setSaldoDisponivel(null);
    if (isEditing) {
      navigate("/movimentacoes");
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error("Usuário não autenticado. Faça login novamente.");
      return;
    }

    // Validate business day
    const { data: diaUtil } = await supabase
      .from("calendario_dias_uteis")
      .select("dia_util")
      .eq("data", data)
      .single();

    if (!diaUtil) {
      toast.error("A data informada não foi encontrada no calendário. Verifique se é um dia útil válido.");
      return;
    }

    if (!diaUtil.dia_util) {
      toast.error("A Data de Transação deve ser um dia útil.");
      return;
    }

    // ── Resgate submission ──
    if (isResgate && selectedCustodia) {
      if (!valor) {
        toast.error("Preencha o valor do resgate.");
        return;
      }

      const valorNum = parseCurrencyToNumber(valor);

      if (saldoDisponivel !== null && valorNum > saldoDisponivel) {
        toast.error("O valor do resgate excede o saldo disponível.");
        return;
      }

      setSubmitting(true);
      try {
        const fmtBR = (v: number) =>
          v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        const { error } = await supabase.from("movimentacoes").insert({
          categoria_id: selectedCustodia.categoria_id,
          tipo_movimentacao: "Resgate",
          data,
          produto_id: selectedCustodia.produto_id,
          valor: valorNum,
          preco_unitario: null,
          instituicao_id: selectedCustodia.instituicao_id,
          emissor_id: selectedCustodia.emissor_id,
          modalidade: selectedCustodia.modalidade,
          taxa: selectedCustodia.taxa,
          pagamento: selectedCustodia.pagamento,
          vencimento: selectedCustodia.vencimento,
          nome_ativo: selectedCustodia.nome,
          codigo_custodia: selectedCustodia.codigo_custodia,
          indexador: selectedCustodia.indexador,
          quantidade: null,
          valor_extrato: `R$ ${fmtBR(valorNum)}`,
          user_id: user.id,
        });

        if (error) throw error;

        // Fetch inserted ID
        const { data: inserted } = await supabase
          .from("movimentacoes")
          .select("id")
          .eq("codigo_custodia", selectedCustodia.codigo_custodia)
          .eq("user_id", user.id)
          .eq("tipo_movimentacao", "Resgate")
          .order("created_at", { ascending: false })
          .limit(1);

        const insertedId = inserted?.[0]?.id || null;
        await fullSyncAfterMovimentacao(insertedId, selectedCustodia.categoria_id, user.id, dataReferenciaISO);

        toast.success("Resgate cadastrado com sucesso!");
        resetForm();
      } catch (err: any) {
        toast.error("Erro ao cadastrar resgate.");
        console.error(err);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // ── Aplicação submission (existing logic) ──
    const requiredFields: Record<string, string> = {
      categoriaId, tipoMovimentacao, produtoId, valor, data, precoUnitario,
      instituicaoId, emissorId, modalidade, taxa, pagamento, vencimento,
    };

    if (isPosFixado) {
      requiredFields.indexador = indexador;
    }

    const emptyFields = Object.entries(requiredFields).filter(([, v]) => !v).map(([k]) => k);

    if (emptyFields.length > 0) {
      console.log("Campos vazios:", emptyFields, requiredFields);
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }

    setSubmitting(true);

    try {
      const produtoNome = produtos.find((p) => p.id === produtoId)?.nome || "";
      const emissorNome = emissores.find((e) => e.id === emissorId)?.nome || "";
      const nomeAtivo = isRendaFixa
        ? buildNomeAtivo(produtoNome, emissorNome, modalidade, taxa, vencimento, indexador)
        : null;

      const valorNum = parseCurrencyToNumber(valor);
      const puNum = parseCurrencyToNumber(precoUnitario);
      const taxaNum = parseFloat(taxa.replace(",", "."));
      const quantidade = puNum > 0 ? valorNum / puNum : null;

      const fmtBR = (v: number) =>
        v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const valorExtrato = quantidade != null
        ? `R$ ${fmtBR(valorNum)} (R$ ${fmtBR(puNum)} x ${fmtBR(quantidade)})`
        : `R$ ${fmtBR(valorNum)}`;

      if (isEditing) {
        const { error } = await supabase.from("movimentacoes").update({
          data,
          valor: valorNum,
          preco_unitario: puNum,
          instituicao_id: instituicaoId,
          emissor_id: emissorId,
          modalidade,
          taxa: taxaNum,
          pagamento,
          vencimento,
          nome_ativo: nomeAtivo,
          indexador: isPosFixado ? indexador : null,
          quantidade,
          valor_extrato: valorExtrato,
        }).eq("id", editId);

        if (error) throw error;

        await fullSyncAfterMovimentacao(editId!, categoriaId, user!.id, dataReferenciaISO);

        toast.success("Transação atualizada com sucesso!");
        navigate("/movimentacoes");
      } else {
        let codigoCustodia: number;
        let tipoFinal = tipoMovimentacao;

        if (nomeAtivo) {
          const { data: existing } = await supabase
            .from("movimentacoes")
            .select("codigo_custodia")
            .eq("nome_ativo", nomeAtivo)
            .not("codigo_custodia", "is", null)
            .limit(1);

          if (existing && existing.length > 0) {
            codigoCustodia = existing[0].codigo_custodia!;
          } else {
            const { data: maxRow } = await supabase
              .from("movimentacoes")
              .select("codigo_custodia")
              .not("codigo_custodia", "is", null)
              .order("codigo_custodia", { ascending: false })
              .limit(1);

            const maxCodigo = maxRow && maxRow.length > 0 ? (maxRow[0].codigo_custodia ?? 99) : 99;
            codigoCustodia = maxCodigo + 1;
            tipoFinal = "Aplicação Inicial";
          }
        } else {
          codigoCustodia = 0;
        }

        const { error } = await supabase.from("movimentacoes").insert({
          categoria_id: categoriaId,
          tipo_movimentacao: tipoFinal,
          data,
          produto_id: produtoId,
          valor: valorNum,
          preco_unitario: puNum,
          instituicao_id: instituicaoId,
          emissor_id: emissorId,
          modalidade,
          taxa: taxaNum,
          pagamento,
          vencimento,
          nome_ativo: nomeAtivo,
          codigo_custodia: nomeAtivo ? codigoCustodia : null,
          indexador: isPosFixado ? indexador : null,
          quantidade,
          valor_extrato: valorExtrato,
          user_id: user?.id,
        });

        if (error) throw error;

        const { data: inserted } = await supabase
          .from("movimentacoes")
          .select("id")
          .eq("codigo_custodia", nomeAtivo ? codigoCustodia : -1)
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(1);

        const insertedId = inserted?.[0]?.id || null;

        await fullSyncAfterMovimentacao(insertedId, categoriaId, user!.id, dataReferenciaISO);

        toast.success("Transação cadastrada com sucesso!");
        resetForm();
      }
    } catch (err: any) {
      toast.error(isEditing ? "Erro ao atualizar transação." : "Erro ao cadastrar transação.");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  // Helper for displaying names from IDs (for Resgate readonly fields)
  const getInstituicaoNome = (id: string) => instituicoes.find((i) => i.id === id)?.nome || "—";
  const getEmissorNome = (id: string) => emissores.find((e) => e.id === id)?.nome || "—";

  const fmtBrlDisplay = (v: number | null) =>
    v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

  const valorResgateSuperaSaldo =
    isResgate && saldoDisponivel !== null && parseCurrencyToNumber(valor) > saldoDisponivel && valor !== "";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={resetForm}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            {isEditing ? "Editar Transação" : "Nova Transação"}
          </h1>
          <p className="text-xs text-muted-foreground">
            {isEditing ? "Altere os dados da movimentação" : "Cadastre uma nova movimentação"}
          </p>
        </div>
      </div>

      {/* Form card */}
      <div className="rounded-md border border-border bg-card p-6 max-w-2xl space-y-5">
        {/* Step 1 — Categoria + Tipo de Movimentação */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Categoria do Produto" required>
            <NativeSelect
              value={categoriaId}
              onChange={(v) => {
                if (isEditing) return;
                setCategoriaId(v);
                setTipoMovimentacao("");
                setProdutoId("");
                setSelectedCustodiaId("");
              }}
              placeholder="Selecione uma categoria"
              disabled={isEditing}
              options={categorias.map((c) => ({
                value: c.id,
                label: c.nome,
                disabled: c.nome !== "Renda Fixa",
              }))}
            />
          </Field>

          {showTipoMovimentacao && (
            <Field label="Tipo de Movimentação" required>
              <NativeSelect
                value={tipoMovimentacao}
                onChange={(v) => {
                  setTipoMovimentacao(v);
                  setProdutoId("");
                  setSelectedCustodiaId("");
                  setValor("");
                  setSaldoDisponivel(null);
                  if (v === "Resgate") setData("");
                }}
                placeholder="Selecione o tipo de movimentação"
                disabled={isEditing}
                options={TIPOS_MOVIMENTACAO.map((t) => ({
                  value: t,
                  label: t,
                  disabled: t !== "Aplicação" && t !== "Resgate",
                }))}
              />
            </Field>
          )}
        </div>

        {/* ── Aplicação Flow ── */}
        {(isAplicacao || (isEditing && !!tipoMovimentacao && !isResgate)) && isRendaFixa && (
          <>
            {/* Produto selector */}
            <Field label="Produto" required>
              <NativeSelect
                value={produtoId}
                onChange={setProdutoId}
                placeholder="Selecione"
                disabled={isEditing}
                options={produtos.map((p) => ({
                  value: p.id,
                  label: p.nome,
                }))}
              />
            </Field>

            {showAplicacaoFields && (
              <>
                {/* Row 1: Data, Valor, Preço Unitário, Vencimento */}
                <div className="grid grid-cols-4 gap-4">
                  <Field label="Data de Transação" required>
                    <input
                      type="date"
                      value={data}
                      onChange={(e) => setData(e.target.value)}
                      className="input-field"
                    />
                  </Field>

                  <Field label="Valor (R$)" required>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        R$
                      </span>
                      <input
                        type="text"
                        value={valor}
                        onChange={(e) => setValor(formatCurrency(e.target.value))}
                        placeholder="0,00"
                        className="input-field pl-9"
                      />
                    </div>
                  </Field>

                  <Field label="Preço Unitário (R$)" required>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        R$
                      </span>
                      <input
                        type="text"
                        value={precoUnitario}
                        onChange={(e) => setPrecoUnitario(formatCurrency(e.target.value))}
                        placeholder="1.000,00"
                        className="input-field pl-9"
                      />
                    </div>
                  </Field>

                  <Field label="Vencimento" required>
                    <input
                      type="date"
                      value={vencimento}
                      onChange={(e) => setVencimento(e.target.value)}
                      className="input-field"
                    />
                  </Field>
                </div>

                {/* Row 2: Instituição, Emissor */}
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Instituição" required>
                    <NativeSelect
                      value={instituicaoId}
                      onChange={setInstituicaoId}
                      placeholder="Selecione"
                      options={instituicoes.map((i) => ({
                        value: i.id,
                        label: i.nome,
                      }))}
                    />
                  </Field>

                  <Field label="Emissor" required>
                    <NativeSelect
                      value={emissorId}
                      onChange={setEmissorId}
                      placeholder="Selecione"
                      options={emissores.map((e) => ({
                        value: e.id,
                        label: e.nome,
                      }))}
                    />
                  </Field>
                </div>

                {/* Row 3: Modalidade, (Indexador if Pós Fixado), Taxa, Pagamento */}
                <div className={`grid gap-4 ${isPosFixado ? "grid-cols-4" : "grid-cols-3"}`}>
                  <Field label="Modalidade" required>
                    <NativeSelect
                      value={modalidade}
                      onChange={(v) => {
                        setModalidade(v);
                        if (v !== "Pós Fixado") setIndexador("");
                      }}
                      placeholder="Selecione"
                      options={MODALIDADE_OPTIONS.map((m) => ({
                        value: m,
                        label: m,
                      }))}
                    />
                  </Field>

                  {isPosFixado && (
                    <Field label="Indexador" required>
                      <NativeSelect
                        value={indexador}
                        onChange={setIndexador}
                        placeholder="Selecione"
                        options={INDEXADOR_OPTIONS.map((idx) => ({
                          value: idx,
                          label: idx,
                        }))}
                      />
                    </Field>
                  )}

                  <Field label="Taxa" required>
                    <div className="relative">
                      <input
                        type="text"
                        value={taxa}
                        onChange={(e) => setTaxa(e.target.value)}
                        placeholder="12,5"
                        className="input-field pr-7"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        %
                      </span>
                    </div>
                  </Field>

                  <Field label="Pagamento" required>
                    <NativeSelect
                      value={pagamento}
                      onChange={setPagamento}
                      placeholder="Selecione"
                      options={PAGAMENTO_OPTIONS.map((p) => ({
                        value: p,
                        label: p,
                      }))}
                    />
                  </Field>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-md bg-destructive px-5 py-2.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-[hsl(145,63%,32%)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[hsl(145,63%,28%)] transition-colors disabled:opacity-50"
                  >
                    <PlusCircle size={16} />
                    {submitting ? "Enviando..." : isEditing ? "Salvar Alterações" : "Enviar"}
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {/* ── Resgate Flow ── */}
        {showResgateFields && (
          <>
            <Field label="Nome do Título" required>
              <NativeSelect
                value={selectedCustodiaId}
                onChange={(v) => {
                  setSelectedCustodiaId(v);
                  setValor("");
                  setData("");
                  setSaldoDisponivel(null);
                }}
                placeholder="Selecione o título em custódia"
                options={custodiaItems.map((c) => ({
                  value: c.id,
                  label: c.nome || `Custódia #${c.codigo_custodia}`,
                }))}
              />
            </Field>

            {selectedCustodia && (
              <Field label="Data de Transação" required>
                <input
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="input-field max-w-[220px]"
                />
              </Field>
            )}

            {selectedCustodia && data && (
              <>
                {/* Row 1: Valor, Vencimento */}
                <div className="grid grid-cols-2 gap-4">

                  <Field label="Valor do Resgate (R$)" required>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        R$
                      </span>
                      <input
                        type="text"
                        value={valor}
                        onChange={(e) => setValor(formatCurrency(e.target.value))}
                        placeholder="0,00"
                        className="input-field pl-9"
                      />
                    </div>
                  </Field>

                  <Field label="Vencimento">
                    <input
                      type="date"
                      value={vencimento}
                      disabled
                      className="input-field opacity-60"
                    />
                  </Field>
                </div>

                {/* Saldo disponível info */}
                <div className="rounded-md border border-border bg-muted/30 px-4 py-3">
                  <p className="text-xs text-muted-foreground">
                    Saldo disponível para resgate em{" "}
                    {new Date(data + "T00:00:00").toLocaleDateString("pt-BR")}:
                  </p>
                  <p className="text-sm font-semibold text-foreground mt-0.5">
                    {calculandoSaldo
                      ? "Calculando..."
                      : saldoDisponivel !== null
                        ? fmtBrlDisplay(saldoDisponivel)
                        : "—"
                    }
                  </p>
                </div>

                {/* Alert if valor > saldo */}
                {valorResgateSuperaSaldo && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      O valor do resgate (R$ {valor}) excede o saldo disponível ({fmtBrlDisplay(saldoDisponivel)}).
                    </AlertDescription>
                  </Alert>
                )}

                {/* Row 2: Instituição, Emissor (readonly) */}
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Instituição">
                    <input
                      type="text"
                      value={getInstituicaoNome(instituicaoId)}
                      disabled
                      className="input-field opacity-60"
                    />
                  </Field>

                  <Field label="Emissor">
                    <input
                      type="text"
                      value={getEmissorNome(emissorId)}
                      disabled
                      className="input-field opacity-60"
                    />
                  </Field>
                </div>

                {/* Row 3: Modalidade, (Indexador), Taxa, Pagamento (readonly) */}
                <div className={`grid gap-4 ${isPosFixado ? "grid-cols-4" : "grid-cols-3"}`}>
                  <Field label="Modalidade">
                    <input
                      type="text"
                      value={modalidade}
                      disabled
                      className="input-field opacity-60"
                    />
                  </Field>

                  {isPosFixado && (
                    <Field label="Indexador">
                      <input
                        type="text"
                        value={indexador}
                        disabled
                        className="input-field opacity-60"
                      />
                    </Field>
                  )}

                  <Field label="Taxa">
                    <input
                      type="text"
                      value={taxa ? `${taxa}%` : "—"}
                      disabled
                      className="input-field opacity-60"
                    />
                  </Field>

                  <Field label="Pagamento">
                    <input
                      type="text"
                      value={pagamento}
                      disabled
                      className="input-field opacity-60"
                    />
                  </Field>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-md bg-destructive px-5 py-2.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting || valorResgateSuperaSaldo}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-[hsl(145,63%,32%)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[hsl(145,63%,28%)] transition-colors disabled:opacity-50"
                  >
                    <PlusCircle size={16} />
                    {submitting ? "Enviando..." : "Registrar Resgate"}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Shared sub-components ── */

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-foreground">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function NativeSelect({
  value,
  onChange,
  placeholder,
  options,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string; disabled?: boolean }[];
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="input-field"
      disabled={disabled}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value} disabled={o.disabled}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

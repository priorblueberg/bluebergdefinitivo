import { useState, useEffect } from "react";
import { ArrowLeft, PlusCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

function buildNomeAtivo(
  produtoNome: string,
  emissorNome: string,
  modalidade: string,
  taxa: string,
  vencimento: string
): string {
  const taxaFormatted = taxa ? `${taxa.replace(".", ",")}%` : "";
  const vencFormatted = vencimento
    ? new Date(vencimento + "T00:00:00").toLocaleDateString("pt-BR")
    : "";
  return [produtoNome, emissorNome, modalidade, taxaFormatted, vencFormatted ? `- ${vencFormatted}` : ""]
    .filter(Boolean)
    .join(" ");
}

async function syncControleCarteiras(categoriaId: string) {
  // Get categoria name
  const { data: catData } = await supabase.from("categorias").select("nome").eq("id", categoriaId).single();
  const categoriaNome = catData?.nome || "Desconhecida";

  // Get aggregated data from custodia for this categoria
  const { data: custodiaRows } = await supabase
    .from("custodia")
    .select("data_inicio, data_limite, resgate_total, data_calculo")
    .eq("categoria_id", categoriaId);

  if (!custodiaRows || custodiaRows.length === 0) return;

  const dates = (field: string) =>
    custodiaRows.map((r: any) => r[field]).filter(Boolean).sort();

  const dataInicio = dates("data_inicio")[0] || null;
  const dataLimite = dates("data_limite").reverse()[0] || null;
  const resgateTotal = dates("resgate_total").reverse()[0] || null;
  const dataCalculo = dates("data_calculo").reverse()[0] || null;

  const today = new Date().toISOString().slice(0, 10);
  const status = resgateTotal && resgateTotal > today ? "Ativa" : (resgateTotal ? "Encerrada" : "Ativa");

  // Check if carteira record exists for this categoria
  const { data: existing } = await supabase
    .from("controle_de_carteiras")
    .select("id")
    .eq("categoria_id", categoriaId)
    .limit(1);

  if (existing && existing.length > 0) {
    await supabase.from("controle_de_carteiras").update({
      data_inicio: dataInicio,
      data_limite: dataLimite,
      resgate_total: resgateTotal,
      data_calculo: dataCalculo,
      status,
    }).eq("id", existing[0].id);
  } else {
    await supabase.from("controle_de_carteiras").insert({
      categoria_id: categoriaId,
      nome_carteira: categoriaNome,
      data_inicio: dataInicio,
      data_limite: dataLimite,
      resgate_total: resgateTotal,
      data_calculo: dataCalculo,
      status,
    });
  }

  // Also sync "Investimentos" (general) record
  await syncCarteiraGeral();
}

async function syncCarteiraGeral() {
  const { data: allCustodia } = await supabase
    .from("custodia")
    .select("data_inicio, data_limite, resgate_total, data_calculo");

  if (!allCustodia || allCustodia.length === 0) return;

  const dates = (field: string) =>
    allCustodia.map((r: any) => r[field]).filter(Boolean).sort();

  const dataInicio = dates("data_inicio")[0] || null;
  const dataLimite = dates("data_limite").reverse()[0] || null;
  const resgateTotal = dates("resgate_total").reverse()[0] || null;
  const dataCalculo = dates("data_calculo").reverse()[0] || null;

  const today = new Date().toISOString().slice(0, 10);
  const status = resgateTotal && resgateTotal > today ? "Ativa" : (resgateTotal ? "Encerrada" : "Ativa");

  // Use a special "general" categoria_id — we'll use the first categoria as placeholder
  // Check if "Investimentos" record exists
  const { data: existing } = await supabase
    .from("controle_de_carteiras")
    .select("id")
    .eq("nome_carteira", "Investimentos")
    .limit(1);

  // We need a valid categoria_id for FK — get the first one
  const { data: firstCat } = await supabase.from("categorias").select("id").limit(1);
  const catId = firstCat?.[0]?.id;
  if (!catId) return;

  if (existing && existing.length > 0) {
    await supabase.from("controle_de_carteiras").update({
      data_inicio: dataInicio,
      data_limite: dataLimite,
      resgate_total: resgateTotal,
      data_calculo: dataCalculo,
      status,
    }).eq("id", existing[0].id);
  } else {
    await supabase.from("controle_de_carteiras").insert({
      categoria_id: catId,
      nome_carteira: "Investimentos",
      data_inicio: dataInicio,
      data_limite: dataLimite,
      resgate_total: resgateTotal,
      data_calculo: dataCalculo,
      status,
    });
  }
}

export default function CadastrarTransacaoPage() {
  // lookup data
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [instituicoes, setInstituicoes] = useState<Instituicao[]>([]);
  const [emissores, setEmissores] = useState<Emissor[]>([]);

  // form state
  const [categoriaId, setCategoriaId] = useState("");
  const [tipoMovimentacao, setTipoMovimentacao] = useState("");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [produtoId, setProdutoId] = useState("");
  const [valor, setValor] = useState("");
  const [precoUnitario, setPrecoUnitario] = useState("1000");
  const [instituicaoId, setInstituicaoId] = useState("");
  const [emissorId, setEmissorId] = useState("");
  const [modalidade, setModalidade] = useState("");
  const [taxa, setTaxa] = useState("");
  const [pagamento, setPagamento] = useState("No Vencimento");
  const [vencimento, setVencimento] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Derived
  const categoriaSelecionada = categorias.find((c) => c.id === categoriaId);
  const isRendaFixa = categoriaSelecionada?.nome === "Renda Fixa";

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

  // Load produtos when categoria changes
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

  // Step visibility
  const showTipoMovimentacao = !!categoriaId && isRendaFixa;
  const showFields = showTipoMovimentacao && tipoMovimentacao === "Aplicação";

  const resetForm = () => {
    setCategoriaId("");
    setTipoMovimentacao("");
    setData(new Date().toISOString().slice(0, 10));
    setProdutoId("");
    setValor("");
    setPrecoUnitario("1000");
    setInstituicaoId("");
    setEmissorId("");
    setModalidade("");
    setTaxa("");
    setPagamento("No Vencimento");
    setVencimento("");
  };

  const handleSubmit = async () => {
    // All fields required
    if (
      !categoriaId || !tipoMovimentacao || !produtoId || !valor || !data ||
      !precoUnitario || !instituicaoId || !emissorId || !modalidade || !taxa ||
      !pagamento || !vencimento
    ) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    setSubmitting(true);

    try {
      // Build nome_ativo for Renda Fixa
      const produtoNome = produtos.find((p) => p.id === produtoId)?.nome || "";
      const emissorNome = emissores.find((e) => e.id === emissorId)?.nome || "";
      const nomeAtivo = isRendaFixa
        ? buildNomeAtivo(produtoNome, emissorNome, modalidade, taxa, vencimento)
        : null;

      // Check if nome_ativo already exists in movimentacoes to determine codigo_custodia
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
          // Nome found — reuse existing codigo_custodia
          codigoCustodia = existing[0].codigo_custodia!;
        } else {
          // Nome not found — generate new codigo_custodia = max + 1
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

      const valorNum = parseFloat(valor.replace(",", "."));
      const puNum = parseFloat(precoUnitario.replace(",", "."));
      const taxaNum = parseFloat(taxa.replace(",", "."));
      const quantidade = puNum > 0 ? valorNum / puNum : null;

      // Build valor_extrato: "R$ 200.000,00 (R$ 1.000,00 x 10)"
      const fmtBR = (v: number) =>
        v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const valorExtrato = quantidade != null
        ? `R$ ${fmtBR(valorNum)} (R$ ${fmtBR(puNum)} x ${fmtBR(quantidade)})`
        : `R$ ${fmtBR(valorNum)}`;

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
        indexador: null,
        quantidade,
        valor_extrato: valorExtrato,
      });

      if (error) throw error;

      // If Aplicação Inicial, also insert into custodia and update controle_de_carteiras
      if (tipoFinal === "Aplicação Inicial" && nomeAtivo) {
        const { error: custError } = await supabase.from("custodia").insert({
          codigo_custodia: codigoCustodia,
          data_inicio: data,
          produto_id: produtoId,
          tipo_movimentacao: tipoFinal,
          instituicao_id: instituicaoId,
          modalidade,
          indexador: null,
          taxa: taxaNum,
          valor_investido: valorNum,
          preco_unitario: puNum,
          quantidade,
          vencimento,
          emissor_id: emissorId,
          pagamento,
          nome: nomeAtivo,
          categoria_id: categoriaId,
        });

        if (custError) {
          console.error("Erro ao inserir custódia:", custError);
        }

        // Update controle_de_carteiras
        await syncControleCarteiras(categoriaId);
      }

      toast.success("Transação cadastrada com sucesso!");
      resetForm();
    } catch (err: any) {
      toast.error("Erro ao cadastrar transação.");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

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
            Nova Transação
          </h1>
          <p className="text-xs text-muted-foreground">
            Cadastre uma nova movimentação
          </p>
        </div>
      </div>

      {/* Form card */}
      <div className="rounded-md border border-border bg-card p-6 max-w-2xl space-y-5">
        {/* 1 — Categoria */}
        <Field label="Categoria do Produto" required>
          <NativeSelect
            value={categoriaId}
            onChange={(v) => {
              setCategoriaId(v);
              setTipoMovimentacao("");
              setProdutoId("");
            }}
            placeholder="Selecione uma categoria"
            options={categorias.map((c) => ({
              value: c.id,
              label: c.nome,
              disabled: c.nome !== "Renda Fixa",
            }))}
          />
        </Field>

        {/* 2 — Tipo de Movimentação */}
        {showTipoMovimentacao && (
          <Field label="Tipo de Movimentação" required>
            <NativeSelect
              value={tipoMovimentacao}
              onChange={setTipoMovimentacao}
              placeholder="Selecione o tipo de movimentação"
              options={TIPOS_MOVIMENTACAO.map((t) => ({
                value: t,
                label: t,
                disabled: t !== "Aplicação",
              }))}
            />
          </Field>
        )}

        {/* 3 — Remaining fields */}
        {showFields && (
          <>
            <div className="grid grid-cols-4 gap-4">
              <Field label="Data" required>
                <input
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="input-field"
                />
              </Field>

              <Field label="Produto" required>
                <NativeSelect
                  value={produtoId}
                  onChange={setProdutoId}
                  placeholder="Selecione"
                  options={produtos.map((p) => ({
                    value: p.id,
                    label: p.nome,
                  }))}
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
                    onChange={(e) => setValor(e.target.value)}
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
                    onChange={(e) => setPrecoUnitario(e.target.value)}
                    placeholder="1.000,00"
                    className="input-field pl-9"
                  />
                </div>
              </Field>
            </div>

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

            <div className="grid grid-cols-4 gap-4">
              <Field label="Modalidade" required>
                <NativeSelect
                  value={modalidade}
                  onChange={setModalidade}
                  placeholder="Selecione"
                  options={MODALIDADE_OPTIONS.map((m) => ({
                    value: m,
                    label: m,
                    disabled: m !== "Prefixado",
                  }))}
                />
              </Field>

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

              <Field label="Vencimento" required>
                <input
                  type="date"
                  value={vencimento}
                  onChange={(e) => setVencimento(e.target.value)}
                  className="input-field"
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
                {submitting ? "Enviando..." : "Enviar"}
              </button>
            </div>
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
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string; disabled?: boolean }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="input-field"
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

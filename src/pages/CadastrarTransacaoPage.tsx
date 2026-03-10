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
  const [precoUnitario, setPrecoUnitario] = useState("");
  const [instituicaoId, setInstituicaoId] = useState("");
  const [emissorId, setEmissorId] = useState("");
  const [modalidade, setModalidade] = useState("");
  const [taxa, setTaxa] = useState("");
  const [pagamento, setPagamento] = useState("No Vencimento");
  const [vencimento, setVencimento] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Derived: is Renda Fixa selected?
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
    setPrecoUnitario("");
    setInstituicaoId("");
    setEmissorId("");
    setModalidade("");
    setTaxa("");
    setPagamento("No Vencimento");
    setVencimento("");
  };

  const handleSubmit = async () => {
    if (!categoriaId || !tipoMovimentacao || !produtoId || !valor || !data) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("movimentacoes").insert({
      categoria_id: categoriaId,
      tipo_movimentacao: tipoMovimentacao,
      data,
      produto_id: produtoId,
      valor: parseFloat(valor.replace(",", ".")),
      preco_unitario: precoUnitario
        ? parseFloat(precoUnitario.replace(",", "."))
        : null,
      instituicao_id: instituicaoId || null,
      emissor_id: emissorId || null,
      modalidade: modalidade || null,
      taxa: taxa ? parseFloat(taxa.replace(",", ".")) : null,
      pagamento: pagamento || null,
      vencimento: vencimento || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Erro ao cadastrar transação.");
      console.error(error);
    } else {
      toast.success("Transação cadastrada com sucesso!");
      resetForm();
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

              <Field label="Preço Unitário">
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
              <Field label="Instituição">
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

              <Field label="Emissor">
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
              <Field label="Modalidade">
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

              <Field label="Taxa">
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

              <Field label="Pagamento">
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

              <Field label="Vencimento">
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
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-green-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50"
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

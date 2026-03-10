import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Movimentacao {
  id: string;
  created_at: string;
  data: string;
  tipo_movimentacao: string;
  valor: number;
  preco_unitario: number | null;
  modalidade: string | null;
  indexador: string | null;
  taxa: number | null;
  pagamento: string | null;
  vencimento: string | null;
  nome_ativo: string | null;
  codigo_custodia: number | null;
  categoria: string;
  produto: string;
  instituicao: string | null;
  emissor: string | null;
  quantidade: number | null;
  valor_extrato: string | null;
}

export default function MovimentacoesPage() {
  const [rows, setRows] = useState<Movimentacao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("movimentacoes")
        .select(`
          id, created_at, data, tipo_movimentacao, valor, preco_unitario,
          modalidade, indexador, taxa, pagamento, vencimento, nome_ativo, codigo_custodia,
          quantidade, valor_extrato,
          categorias(nome), produtos(nome), instituicoes(nome), emissores(nome)
        `)
        .order("data", { ascending: false });

      if (!error && data) {
        setRows(
          data.map((r: any) => ({
            id: r.id,
            created_at: r.created_at,
            data: r.data,
            tipo_movimentacao: r.tipo_movimentacao,
            valor: r.valor,
            preco_unitario: r.preco_unitario,
            modalidade: r.modalidade,
            indexador: r.indexador,
            taxa: r.taxa,
            pagamento: r.pagamento,
            vencimento: r.vencimento,
            nome_ativo: r.nome_ativo,
            codigo_custodia: r.codigo_custodia,
            categoria: r.categorias?.nome ?? "—",
            produto: r.produtos?.nome ?? "—",
            instituicao: r.instituicoes?.nome ?? null,
            emissor: r.emissores?.nome ?? null,
            quantidade: r.quantidade,
            valor_extrato: r.valor_extrato,
          }))
        );
      }
      setLoading(false);
    })();
  }, []);

  const fmt = (v: number | null) =>
    v != null
      ? v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : "—";

  const fmtDate = (d: string | null) =>
    d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";

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
              {[
                "Cód. Custódia", "Data", "Categoria", "Produto", "Nome do Ativo",
                "Tipo Mov.", "Instituição", "Emissor", "Modalidade", "Indexador",
                "Taxa", "Pagamento", "Valor (R$)", "Preço Unit. (R$)", "Quantidade",
                "Valor Extrato", "Vencimento",
              ].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={17} className="px-4 py-8 text-center text-muted-foreground">Carregando...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={17} className="px-4 py-8 text-center text-muted-foreground">Nenhuma movimentação encontrada.</td></tr>
            ) : (
              rows.map((r, i) => (
                <tr key={r.id} className={`border-t border-border ${i % 2 === 0 ? "bg-card" : "bg-muted/30"}`}>
                  <td className="px-3 py-2 text-foreground">{r.codigo_custodia ?? "—"}</td>
                  <td className="px-3 py-2 text-foreground whitespace-nowrap">{fmtDate(r.data)}</td>
                  <td className="px-3 py-2 text-foreground">{r.categoria}</td>
                  <td className="px-3 py-2 text-foreground">{r.produto}</td>
                  <td className="px-3 py-2 text-foreground whitespace-nowrap">{r.nome_ativo ?? "—"}</td>
                  <td className="px-3 py-2 text-foreground whitespace-nowrap">{r.tipo_movimentacao}</td>
                  <td className="px-3 py-2 text-foreground">{r.instituicao ?? "—"}</td>
                  <td className="px-3 py-2 text-foreground">{r.emissor ?? "—"}</td>
                  <td className="px-3 py-2 text-foreground">{r.modalidade ?? "—"}</td>
                  <td className="px-3 py-2 text-foreground">{r.indexador ?? "—"}</td>
                  <td className="px-3 py-2 text-foreground">{r.taxa != null ? `${fmt(r.taxa)}%` : "—"}</td>
                  <td className="px-3 py-2 text-foreground">{r.pagamento ?? "—"}</td>
                  <td className="px-3 py-2 text-foreground text-right whitespace-nowrap">{fmt(r.valor)}</td>
                  <td className="px-3 py-2 text-foreground text-right whitespace-nowrap">{fmt(r.preco_unitario)}</td>
                  <td className="px-3 py-2 text-foreground text-right whitespace-nowrap">{fmt(r.quantidade)}</td>
                  <td className="px-3 py-2 text-foreground whitespace-nowrap">{r.valor_extrato ?? "—"}</td>
                  <td className="px-3 py-2 text-foreground whitespace-nowrap">{fmtDate(r.vencimento)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

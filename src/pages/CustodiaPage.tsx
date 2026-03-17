import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDataReferencia } from "@/contexts/DataReferenciaContext";

interface CustodiaRow {
  id: string;
  codigo_custodia: number;
  data_inicio: string;
  tipo_movimentacao: string;
  modalidade: string | null;
  indexador: string | null;
  taxa: number | null;
  valor_investido: number;
  preco_unitario: number | null;
  quantidade: number | null;
  vencimento: string | null;
  pagamento: string | null;
  nome: string | null;
  produto: string;
  instituicao: string | null;
  emissor: string | null;
  categoria: string;
  resgate_total: number | null;
  status_variavel: string | null;
  data_calculo: string | null;
  multiplicador: string | null;
  amortizacao: number | null;
  rendimentos: number | null;
  alocacao_patrimonial: string | null;
  pu_inicial: number | null;
  data_limite: string | null;
  sigla_tesouro: string | null;
  custodia_no_dia: number | null;
  estrategia: string | null;
}

interface CarteiraInfo {
  nome_carteira: string;
  status: string;
  data_inicio: string | null;
  data_calculo: string | null;
}

export default function CustodiaPage() {
  const [rows, setRows] = useState<CustodiaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [carteiraInfo, setCarteiraInfo] = useState<CarteiraInfo | null>(null);
  const { appliedVersion } = useDataReferencia();

  useEffect(() => {
    (async () => {
      // Buscar dados da carteira Renda Fixa
      const { data: carteiraData } = await supabase
        .from("controle_de_carteiras")
        .select("nome_carteira, status, data_inicio, data_calculo")
        .eq("nome_carteira", "Renda Fixa")
        .maybeSingle();

      if (carteiraData) {
        setCarteiraInfo({
          nome_carteira: carteiraData.nome_carteira,
          status: carteiraData.status,
          data_inicio: carteiraData.data_inicio,
          data_calculo: carteiraData.data_calculo,
        });
      }

      const { data, error } = await supabase
        .from("custodia")
        .select(`
          id, codigo_custodia, data_inicio, tipo_movimentacao,
          modalidade, indexador, taxa, valor_investido, preco_unitario,
          quantidade, vencimento, pagamento, nome,
          resgate_total, status_variavel, data_calculo, multiplicador,
          amortizacao, rendimentos, alocacao_patrimonial, pu_inicial,
          data_limite, sigla_tesouro, custodia_no_dia, estrategia,
          produtos(nome), instituicoes(nome), emissores(nome), categorias(nome)
        `)
        .order("codigo_custodia", { ascending: true });

      if (!error && data) {
        setRows(
          data.map((r: any) => ({
            id: r.id,
            codigo_custodia: r.codigo_custodia,
            data_inicio: r.data_inicio,
            tipo_movimentacao: r.tipo_movimentacao,
            modalidade: r.modalidade,
            indexador: r.indexador,
            taxa: r.taxa,
            valor_investido: r.valor_investido,
            preco_unitario: r.preco_unitario,
            quantidade: r.quantidade,
            vencimento: r.vencimento,
            pagamento: r.pagamento,
            nome: r.nome,
            produto: r.produtos?.nome ?? "—",
            instituicao: r.instituicoes?.nome ?? null,
            emissor: r.emissores?.nome ?? null,
            categoria: r.categorias?.nome ?? "—",
            resgate_total: r.resgate_total,
            status_variavel: r.status_variavel,
            data_calculo: r.data_calculo,
            multiplicador: r.multiplicador,
            amortizacao: r.amortizacao,
            rendimentos: r.rendimentos,
            alocacao_patrimonial: r.alocacao_patrimonial,
            pu_inicial: r.pu_inicial,
            data_limite: r.data_limite,
            sigla_tesouro: r.sigla_tesouro,
            custodia_no_dia: r.custodia_no_dia,
            estrategia: r.estrategia,
          }))
        );
      }
      setLoading(false);
    })();
  }, [appliedVersion]);

  const fmt = (v: number | null) =>
    v != null
      ? v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : "—";

  const fmtDate = (d: string | null) =>
    d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";

  const renderCarteiraMessage = () => {
    if (!carteiraInfo) return null;
    if (carteiraInfo.status === "Ativa") {
      return (
        <p className="text-sm text-muted-foreground mt-1">
          Período de Análise: De {fmtDate(carteiraInfo.data_inicio)} a {fmtDate(carteiraInfo.data_calculo)}
        </p>
      );
    }
    if (carteiraInfo.status === "Não Iniciada") {
      return (
        <p className="text-sm text-muted-foreground mt-1">
          Data selecionada anterior ao início dos seus investimentos em Renda Fixa
        </p>
      );
    }
    if (carteiraInfo.status === "Encerrada") {
      return (
        <p className="text-sm text-muted-foreground mt-1">
          Carteira Encerrada em {fmtDate(carteiraInfo.data_calculo)}
        </p>
      );
    }
    return null;
  };

  const headers = [
    "Cód. Custódia", "Nome", "Data Início", "Categoria", "Produto",
    "Tipo Mov.", "Instituição", "Emissor", "Modalidade", "Indexador",
    "Taxa", "Valor Investido (R$)", "Preço Unit. (R$)", "Quantidade",
    "Vencimento", "Pagamento",
    "Resgate Total", "Status Variável", "Data p/ Cálculo", "Multiplicador",
    "Amortização", "Rendimentos", "Alocação Patrimonial", "PU Inicial",
    "Data Limite", "Sigla Tesouro", "Custódia no Dia", "Estratégia",
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Renda Fixa</h1>
        {renderCarteiraMessage()}
      </div>

      <div className="rounded-md border border-border overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-primary text-primary-foreground">
              {headers.map((h) => (
                <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={headers.length} className="px-4 py-8 text-center text-muted-foreground">Carregando...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={headers.length} className="px-4 py-8 text-center text-muted-foreground">Nenhum registro de custódia encontrado.</td></tr>
            ) : (
              rows.map((r, i) => (
                <tr key={r.id} className={`border-t border-border ${i % 2 === 0 ? "bg-card" : "bg-muted/30"}`}>
                  <td className="px-3 py-2 text-foreground">{r.codigo_custodia}</td>
                  <td className="px-3 py-2 text-foreground whitespace-nowrap">{r.nome ?? "—"}</td>
                  <td className="px-3 py-2 text-foreground whitespace-nowrap">{fmtDate(r.data_inicio)}</td>
                  <td className="px-3 py-2 text-foreground">{r.categoria}</td>
                  <td className="px-3 py-2 text-foreground">{r.produto}</td>
                  <td className="px-3 py-2 text-foreground whitespace-nowrap">{r.tipo_movimentacao}</td>
                  <td className="px-3 py-2 text-foreground">{r.instituicao ?? "—"}</td>
                  <td className="px-3 py-2 text-foreground">{r.emissor ?? "—"}</td>
                  <td className="px-3 py-2 text-foreground">{r.modalidade ?? "—"}</td>
                  <td className="px-3 py-2 text-foreground">{r.indexador ?? "—"}</td>
                  <td className="px-3 py-2 text-foreground">{r.taxa != null ? `${fmt(r.taxa)}%` : "—"}</td>
                  <td className="px-3 py-2 text-foreground text-right whitespace-nowrap">{fmt(r.valor_investido)}</td>
                  <td className="px-3 py-2 text-foreground text-right whitespace-nowrap">{fmt(r.preco_unitario)}</td>
                  <td className="px-3 py-2 text-foreground text-right whitespace-nowrap">{fmt(r.quantidade)}</td>
                  <td className="px-3 py-2 text-foreground whitespace-nowrap">{fmtDate(r.vencimento)}</td>
                  <td className="px-3 py-2 text-foreground">{r.pagamento ?? "—"}</td>
                  <td className="px-3 py-2 text-foreground text-right whitespace-nowrap">{fmt(r.resgate_total)}</td>
                  <td className="px-3 py-2 text-foreground">{r.status_variavel ?? "—"}</td>
                  <td className="px-3 py-2 text-foreground whitespace-nowrap">{fmtDate(r.data_calculo)}</td>
                  <td className="px-3 py-2 text-foreground whitespace-nowrap">{r.multiplicador ?? "—"}</td>
                  <td className="px-3 py-2 text-foreground text-right whitespace-nowrap">{fmt(r.amortizacao)}</td>
                  <td className="px-3 py-2 text-foreground text-right whitespace-nowrap">{fmt(r.rendimentos)}</td>
                  <td className="px-3 py-2 text-foreground">{r.alocacao_patrimonial ?? "—"}</td>
                  <td className="px-3 py-2 text-foreground text-right whitespace-nowrap">{fmt(r.pu_inicial)}</td>
                  <td className="px-3 py-2 text-foreground whitespace-nowrap">{fmtDate(r.data_limite)}</td>
                  <td className="px-3 py-2 text-foreground">{r.sigla_tesouro ?? "—"}</td>
                  <td className="px-3 py-2 text-foreground text-right whitespace-nowrap">{fmt(r.custodia_no_dia)}</td>
                  <td className="px-3 py-2 text-foreground">{r.estrategia ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

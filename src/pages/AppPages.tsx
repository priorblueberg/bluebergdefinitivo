import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useDataReferencia } from "@/contexts/DataReferenciaContext";
import { Search, ChevronUp, ChevronDown } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const chartData = [
  { month: "abr.", investimentos: 0.42 },
  { month: "mai.", investimentos: 0.89 },
  { month: "jun.", investimentos: 1.45 },
  { month: "jul.", investimentos: 2.11 },
  { month: "ago.", investimentos: 2.58 },
  { month: "set.", investimentos: 3.12 },
  { month: "out.", investimentos: 3.74 },
  { month: "nov.", investimentos: 4.31 },
  { month: "dez.", investimentos: 4.89 },
  { month: "jan.", investimentos: 5.52 },
  { month: "fev.", investimentos: 6.01 },
  { month: "mar.", investimentos: 6.34 },
];

const summaryItems = [
  { label: "Patrimônio", value: "R$ 281.217,40" },
  { label: "Ganho no período (R$)", value: "R$ 16.775,70" },
  { label: "Rentabilidade no período", value: "6,34%" },
  { label: "CDI no período", value: "25,48%" },
  { label: "% Sobre CDI", value: "24,90%" },
];

const tableData = [
  { label: "Investimentos", values: ["0,42", "0,47", "0,56", "0,42", "0,89", "0,56", "0,66", "0,47", "0,43", "0,62", "0,52", "0,32", "6,34"] },
  { label: "CDI", values: ["1,01", "0,99", "1,06", "1,01", "1,02", "1,07", "0,91", "0,87", "0,84", "0,93", "0,79", "0,98", "25,48"] },
  { label: "% do CDI", values: ["41,6", "47,5", "52,8", "41,6", "87,3", "52,3", "72,5", "54,0", "51,2", "66,7", "65,8", "32,7", "24,90"] },
];

const months = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ", "No ano"];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-sm">
        <p className="text-foreground">{label}</p>
        <p className="text-primary font-semibold">Investimentos: {payload[0].value}%</p>
      </div>
    );
  }
  return null;
};

export const CarteiraVisaoGeral = () => {
  const [carteiraInfo, setCarteiraInfo] = useState<{
    nome_carteira: string;
    status: string;
    data_inicio: string | null;
    data_calculo: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const { appliedVersion } = useDataReferencia();
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("controle_de_carteiras")
        .select("nome_carteira, status, data_inicio, data_calculo")
        .eq("nome_carteira", "Investimentos")
        .maybeSingle();

      if (data) {
        setCarteiraInfo(data);
        setNotFound(false);
      } else {
        setCarteiraInfo(null);
        setNotFound(true);
      }
      setLoading(false);
    })();
  }, [appliedVersion]);

  const fmtDate = (d: string | null) =>
    d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Carteira de Investimentos</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <p className="text-muted-foreground">Você ainda não possui investimentos cadastrados.</p>
          <button
            onClick={() => navigate("/cadastrar-transacao")}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Cadastrar primeira operação
          </button>
        </div>
      </div>
    );
  }

  const renderStatusMessage = () => {
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
          Data selecionada anterior ao início dos seus investimentos. Início em {fmtDate(carteiraInfo.data_inicio)}
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

  const showContent = carteiraInfo?.status === "Ativa" || carteiraInfo?.status === "Encerrada";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Carteira de Investimentos</h1>
        {renderStatusMessage()}
      </div>

      {showContent && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {summaryItems.map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-border bg-card p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {item.label}
                </p>
                <p className="mt-2 text-lg font-bold text-foreground">
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="rounded-md border border-border bg-card p-6">
            <h2 className="text-sm font-semibold text-foreground">Histórico de Rentabilidade</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Rentabilidade Bruta e CDI, Compra e Venda CDI, Bonificação e Subscrição
            </p>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 20%, 88%)" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: "hsl(215, 15%, 50%)" }}
                    axisLine={{ stroke: "hsl(215, 20%, 88%)" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "hsl(215, 15%, 50%)" }}
                    axisLine={{ stroke: "hsl(215, 20%, 88%)" }}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    iconType="plainline"
                    wrapperStyle={{ fontSize: 11 }}
                    formatter={(value: string) => <span className="text-muted-foreground">{value}</span>}
                  />
                  <Line
                    type="monotone"
                    dataKey="investimentos"
                    name="Investimentos"
                    stroke="hsl(210, 100%, 45%)"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "hsl(210, 100%, 45%)", strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: "hsl(210, 100%, 45%)", strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-md border border-border bg-card p-6">
            <h2 className="text-sm font-semibold text-foreground">Tabela de Rentabilidade</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Informações da rentabilidade por ano e meses
            </p>
            <div className="mt-4 overflow-x-auto">
              <div className="bg-muted rounded-t-md px-4 py-2 text-xs font-medium text-foreground">
                Ano: 2025
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-primary text-primary-foreground">
                    <th className="px-3 py-2 text-left font-medium">Rentabilidade</th>
                    {months.map((m) => (
                      <th key={m} className="px-3 py-2 text-center font-medium">{m}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableData.map((row, i) => (
                    <tr key={row.label} className={i % 2 === 0 ? "bg-card" : "bg-muted/30"}>
                      <td className="px-3 py-2 text-foreground font-medium">{row.label}</td>
                      {row.values.map((v, j) => (
                        <td key={j} className="px-3 py-2 text-center text-foreground">{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export { default as CarteiraRendaFixa } from "./CarteiraRendaFixaPage";
export const CarteiraRendaVariavel = () => <PageStub title="Renda Variável" />;
export const CarteiraFundos = () => <PageStub title="Fundos de Investimentos" />;
export const CarteiraTesouroDireto = () => <PageStub title="Tesouro Direto" />;
const productsData = [
  { nome: "BBDC4", tipo: "Renda Variável", carteira: "Renda Variável", instituicao: "Clear Corretora" },
  { nome: "BTG Pactual Absoluto FI RF", tipo: "Fundos", carteira: "Fundos", instituicao: "BTG Pactual" },
  { nome: "CDB Banco XYZ 110% CDI", tipo: "Renda Fixa", carteira: "Renda Fixa", instituicao: "Banco XYZ" },
  { nome: "Debênture Empresa GHI", tipo: "Renda Fixa", carteira: "Renda Fixa", instituicao: "Empresa GHI" },
  { nome: "Itaú Ações Dividendos FIA", tipo: "Fundos", carteira: "Fundos", instituicao: "Itaú" },
  { nome: "ITUB4", tipo: "Renda Variável", carteira: "Renda Variável", instituicao: "Clear Corretora" },
  { nome: "LCA Banco DEF 100% CDI", tipo: "Renda Fixa", carteira: "Renda Fixa", instituicao: "Banco DEF" },
  { nome: "LCI Banco ABC 95% CDI", tipo: "Renda Fixa", carteira: "Renda Fixa", instituicao: "Banco ABC" },
  { nome: "PETR4", tipo: "Renda Variável", carteira: "Renda Variável", instituicao: "XP Investimentos" },
  { nome: "Tesouro IPCA+ 2029", tipo: "Tesouro Direto", carteira: "Tesouro Direto", instituicao: "Tesouro Nacional" },
  { nome: "Tesouro Prefixado 2026", tipo: "Tesouro Direto", carteira: "Tesouro Direto", instituicao: "Tesouro Nacional" },
  { nome: "Tesouro Selic 2027", tipo: "Tesouro Direto", carteira: "Tesouro Direto", instituicao: "Tesouro Nacional" },
  { nome: "VALE3", tipo: "Renda Variável", carteira: "Renda Variável", instituicao: "XP Investimentos" },
  { nome: "WEGE3", tipo: "Renda Variável", carteira: "Renda Variável", instituicao: "BTG Pactual" },
  { nome: "XP Multimercado FIC FIM", tipo: "Fundos", carteira: "Fundos", instituicao: "XP Investimentos" },
];

type SortKey = "nome" | "tipo" | "carteira" | "instituicao";
type SortDir = "asc" | "desc";

const AnaliseIndividualPage = () => {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("nome");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return productsData.filter(
      (p) => p.nome.toLowerCase().includes(q) || p.tipo.toLowerCase().includes(q) || p.instituicao.toLowerCase().includes(q)
    );
  }, [search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const cmp = a[sortKey].localeCompare(b[sortKey], "pt-BR");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const columns: { key: SortKey; label: string }[] = [
    { key: "nome", label: "Nome" },
    { key: "tipo", label: "Tipo de Produto" },
    { key: "carteira", label: "Carteira" },
    { key: "instituicao", label: "Instituição" },
  ];

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronUp size={12} className="ml-1 opacity-40" />;
    return sortDir === "asc" ? <ChevronUp size={12} className="ml-1" /> : <ChevronDown size={12} className="ml-1" />;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Análise Individual por Produto</h1>
        <p className="mt-1 text-xs text-muted-foreground">Consulte informações detalhadas de cada produto</p>
      </div>

      {/* Search */}
      <div className="space-y-2">
        <span className="text-sm font-medium text-foreground">Buscar Produto</span>
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Digite o nome ou ticker do produto..."
            className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      {/* Table */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Produtos Encontrados ({sorted.length})</h2>
        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primary text-primary-foreground">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="px-4 py-2.5 text-left font-medium cursor-pointer select-none hover:bg-primary/90 transition-colors"
                    onClick={() => handleSort(col.key)}
                  >
                    <span className="inline-flex items-center">
                      {col.label}
                      <SortIcon col={col.key} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => (
                <tr
                  key={row.nome}
                  className={`border-t border-border ${i % 2 === 0 ? "bg-card" : "bg-muted/30"} hover:bg-accent/50 transition-colors`}
                >
                  <td className="px-4 py-2.5 text-foreground">{row.nome}</td>
                  <td className="px-4 py-2.5 text-foreground">{row.tipo}</td>
                  <td className="px-4 py-2.5 text-foreground">{row.carteira}</td>
                  <td className="px-4 py-2.5 text-foreground">{row.instituicao}</td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum produto encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const CarteiraAnaliseIndividual = () => <AnaliseIndividualPage />;
export { default as Movimentacoes } from "./MovimentacoesPage";
export const ProventosRecebidos = () => <PageStub title="Proventos Recebidos" />;
export { default as CadastrarTransacao } from "./CadastrarTransacaoPage";
export const Configuracoes = () => <PageStub title="Configurações" />;
export const Usuario = () => <PageStub title="Usuário" />;
export { default as Admin } from "./AdminPage";
export { default as Custodia } from "./CustodiaPage";
export { default as ControleCarteiras } from "./ControleCarteirasPage";

const PageStub = ({ title }: { title: string }) => (
  <div>
    <h1 className="text-lg font-semibold text-foreground">{title}</h1>
  </div>
);

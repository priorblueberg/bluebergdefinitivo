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
      <div className="border border-border bg-card px-3 py-2 text-xs">
        <p className="text-foreground">{label}</p>
        <p className="text-primary font-data">Investimentos: {payload[0].value}%</p>
      </div>
    );
  }
  return null;
};

export const CarteiraVisaoGeral = () => (
  <div className="space-y-6">
    {/* Title */}
    <div>
      <h1 className="text-lg font-medium text-foreground">Carteira de Investimentos</h1>
      <p className="mt-1 text-xs text-muted-foreground font-data">Patrimônio analítico das suas aplicações</p>
    </div>

    {/* Summary Row */}
    <div className="border border-border">
      <div className="grid grid-cols-5 bg-primary text-primary-foreground">
        {summaryItems.map((item) => (
          <div key={item.label} className="px-4 py-2 text-center text-xs font-medium">
            {item.label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-5 bg-card">
        {summaryItems.map((item) => (
          <div key={item.label} className="px-4 py-3 text-center text-sm font-data text-foreground">
            {item.value}
          </div>
        ))}
      </div>
    </div>

    {/* Chart */}
    <div className="border border-border bg-card p-6">
      <h2 className="text-sm font-medium text-foreground">Histórico de Rentabilidade</h2>
      <p className="mt-1 text-xs text-muted-foreground font-data">
        Rentabilidade Bruta e CDI, Compra e Venda CDI, Bonificação e Subscrição
      </p>
      <div className="mt-4 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(210, 28%, 23%)" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: "hsl(210, 22%, 43%)", fontFamily: "Roboto Mono" }}
              axisLine={{ stroke: "hsl(210, 28%, 23%)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "hsl(210, 22%, 43%)", fontFamily: "Roboto Mono" }}
              axisLine={{ stroke: "hsl(210, 28%, 23%)" }}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              iconType="plainline"
              wrapperStyle={{ fontSize: 11, fontFamily: "Roboto Mono" }}
              formatter={(value: string) => <span className="text-muted-foreground">{value}</span>}
            />
            <Line
              type="monotone"
              dataKey="investimentos"
              name="Investimentos"
              stroke="hsl(210, 100%, 60%)"
              strokeWidth={2}
              dot={{ r: 3, fill: "hsl(210, 100%, 60%)", strokeWidth: 0 }}
              activeDot={{ r: 5, fill: "hsl(210, 100%, 60%)", strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>

    {/* Table */}
    <div className="border border-border bg-card p-6">
      <h2 className="text-sm font-medium text-foreground">Tabela de Rentabilidade</h2>
      <p className="mt-1 text-xs text-muted-foreground font-data">
        Informações da rentabilidade por ano e meses
      </p>
      <div className="mt-4 overflow-x-auto">
        {/* Year header */}
        <div className="bg-muted px-4 py-2 text-xs font-medium text-foreground">
          Ano: 2025
        </div>
        <table className="w-full text-xs font-data">
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
                <td className="px-3 py-2 text-foreground font-medium font-ui">{row.label}</td>
                {row.values.map((v, j) => (
                  <td key={j} className="px-3 py-2 text-center text-foreground">{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

export const CarteiraRendaFixa = () => <PageStub title="Renda Fixa" />;
export const CarteiraRendaVariavel = () => <PageStub title="Renda Variável" />;
export const CarteiraFundos = () => <PageStub title="Fundos de Investimentos" />;
export const CarteiraTesouroDireto = () => <PageStub title="Tesouro Direto" />;
export const CarteiraAnaliseIndividual = () => <PageStub title="Análise Individual por Produto" />;
export const Movimentacoes = () => <PageStub title="Movimentações" />;
export const ProventosRecebidos = () => <PageStub title="Proventos Recebidos" />;
export const CadastrarTransacao = () => <PageStub title="Cadastrar Transação" />;
export const Configuracoes = () => <PageStub title="Configurações" />;
export const Usuario = () => <PageStub title="Usuário" />;

const PageStub = ({ title }: { title: string }) => (
  <div>
    <h1 className="text-lg font-medium text-foreground">{title}</h1>
  </div>
);

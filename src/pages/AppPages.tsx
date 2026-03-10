const PageStub = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <div>
    <h1 className="text-lg font-medium text-foreground">{title}</h1>
    {subtitle && <p className="mt-1 text-xs text-muted-foreground font-data">{subtitle}</p>}
  </div>
);

export const CarteiraVisaoGeral = () => <PageStub title="Carteira de Investimentos" subtitle="Patrimônio analítico das suas aplicações" />;
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

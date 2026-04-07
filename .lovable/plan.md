

## Plano: Documento Completo de Regras de Negócio — Blueberg

### Objetivo
Gerar um documento .docx abrangente documentando toda a ferramenta Blueberg, incluindo screenshots das telas principais.

### Estrutura do Documento

O documento terá os seguintes capítulos:

---

**1. Visao Geral da Plataforma**
- Blueberg: gerenciador de investimentos com acompanhamento diário
- Stack: React 18 + Vite + Tailwind + Lovable Cloud (backend)
- Público-alvo: investidores pessoa física

**2. Autenticacao e Onboarding**
- Login por email/senha (sem signup publico -- acesso controlado por admin)
- Verificacao de email via `check_email_exists` RPC
- Onboarding: coleta nome completo + data nascimento, cria registro em `profiles`
- Rota protegida: sem perfil redireciona para onboarding

**3. Layout e Navegacao**
- Sidebar colapsavel (220px / 56px) com itens: Carteira, Posicao Consolidada, Movimentacoes, Custodia (admin), Controle de Carteiras (admin), Proventos, Configuracoes, Admin (admin), Calculadora (admin)
- Header: email do usuario, botao "Cadastrar Transacao", seletor de Data de Referencia com calendario, botao Aplicar, botao Reprocessar (admin)
- SubTabs: dentro de /carteira, exibe abas por categoria (atualmente so "Renda Fixa")
- Data de Referencia: data maxima = ontem; ao aplicar, recalcula todas as custodias e carteiras

**4. Cadastro de Transacoes**
- Categorias suportadas: "Renda Fixa" e "Poupanca"
- Tipos de movimentacao: "Aplicacao" e "Resgate"
- Fluxo Aplicacao Renda Fixa: Categoria > Produto (CDB, LCI, LCA, DPGE, LC, CRI, CRA) > Instituicao > Emissor > Modalidade (Prefixado, Pos Fixado) > Indexador (CDI, CDI+) > Taxa > Pagamento (Mensal a No Vencimento) > Vencimento > Data > Valor > Preco Unitario
- Fluxo Aplicacao Poupanca: Categoria > Produto (auto) > Banco (= Instituicao + Emissor) > Data > Valor
- Fluxo Resgate: seleciona ativo existente, exibe saldo disponivel, opcao "Fechar Posicao"
- Mapeamento: "Pos Fixado" + "CDI+" = "Mista" + "CDI"
- Nome do ativo: `{Produto} {Emissor} {Modalidade} {Taxa} - {Vencimento}`; Poupanca: `Poupanca {Banco}`
- Codigo de custodia: autoincremental, primeira aplicacao = "Aplicacao Inicial"
- Validacoes: data deve ser dia util (exceto Poupanca), data nao pode ser futura
- Apos salvar: `fullSyncAfterMovimentacao` atualiza custodia, lotes poupanca, carteiras

**5. Motor de Sincronizacao (syncEngine.ts)**
- `syncCustodiaFromMovimentacao`: upsert custodia a partir de movimentacoes
  - Garante "Aplicacao Inicial" sempre a mais antiga
  - Calcula `valor_investido` liquido (aplicacoes - resgates)
  - Deriva `estrategia`: Prefixado, Pos Fixado CDI, Pos Fixado CDI + Taxa
  - Calcula `resgate_total`, `data_calculo`, `data_limite`
- `syncResgateNoVencimento`: cria automaticamente movimentacao "Resgate no Vencimento" quando vencimento < hoje
- `syncManualResgatesTotais`: recalcula valor de "Resgate Total" manuais usando engine
- `syncPoupancaLotes`: reconstroi lotes de poupanca via FIFO
- `syncControleCarteiras`: atualiza carteira por categoria (status: Ativa, Nao Iniciada, Encerrada)
- `syncCarteiraGeral`: carteira "Investimentos" consolidando todas as categorias
- `recalculateAllForDataReferencia`: reprocessa TODAS as custodias para uma data

**6. Motor de Calculo — Renda Fixa (rendaFixaEngine.ts)**
- Sistema de "Cota Virtual" com dois niveis (antes/apos resgate)
- Colunas: Valor da Cota (1/2), Saldo de Cotas (1/2), Liquido (1/2), Aplicacoes, Resgates, Ganho Diario, Ganho Acumulado, Rentabilidade %, CDI Diario, Multiplicador, Juros Pago, Cupom Acumulado, PU, Base Economica
- Modalidades: Prefixado (taxa^(1/252)), Pos Fixado CDI (CDI * taxa/100), Mista ((1+CDI)*(1+taxa)^(1/252)-1)
- Pagamento de juros periodicos: Mensal, Bimestral, Trimestral, Quadrimestral, Semestral, No Vencimento
- Dias nao uteis: mantem valores do dia anterior
- Rentabilidade: TWR via composicao de cotas

**7. Motor de Calculo — Poupanca (poupancaEngine.ts)**
- Fonte de dados: BCB Serie 195 (historico_poupanca_rendimento), fallback Selic + TR
- Rendimento ocorre apenas no aniversario de cada lote
- Regra: Selic > 8.5% = 0.5% a.m.; Selic <= 8.5% = 70% da Selic
- FIFO obrigatorio para resgates
- Lotes reconstruidos a partir de movimentacoes originais (`buildPoupancaLotesFromMovs`)
- Precisao: 8 casas decimais

**8. Motor de Carteira (carteiraRendaFixaEngine.ts)**
- Consolida todos os produtos diariamente
- Rent. Diaria (%): Ganho Diario / (Liquido anterior + Aplicacoes do dia) — padrao TWR
- Rent. Acumulada (%): composicao (1+anterior)*(1+diaria)-1

**9. Pagina: Carteira de Renda Fixa**
- Cards resumo: Patrimonio, Ganho Financeiro, Rentabilidade, CDI Acumulado
- Grafico de linha: Carteira RF vs CDI (acumulado %)
- Grafico de barras: Patrimonio mensal
- Tabela de rentabilidade mensal (Patrimonio, Ganho, Rentabilidade, CDI, %CDI)
- Graficos de pizza: Alocacao por Produto, por Estrategia, por Instituicao, por Emissor
- Tabela detalhada por ativo com drill-down (analise individual)
- Toggle ativos liquidados

**10. Pagina: Posicao Consolidada**
- Tabela com todos os ativos: Status, Nome, Valor Atualizado, Ganho Financeiro, Rentabilidade, Custodiante, % Portfolio
- Acoes rapidas: Aplicacao, Resgate, Excluir
- Dialogo de detalhe ao clicar na linha
- Busca por nome
- Poupanca exibida como linha unica consolidada

**11. Pagina: Movimentacoes**
- Extrato completo de todas as movimentacoes
- Filtros: Nome do Ativo, Tipo de Movimentacao
- Colunas: Data, Nome, Tipo, Quantidade, PU, Valor
- Acoes: Editar (manual), Excluir (manual)
- Movimentacoes automaticas (badge "Auto") nao editaveis

**12. Pagina: Proventos Recebidos**
- Juros periodicos de renda fixa (pagamento != "No Vencimento")
- Rendimentos de poupanca (a cada aniversario de lote)
- Colunas: Data, Nome, Tipo, Valor Recebido

**13. Pagina: Custodia (Admin)**
- Visao raw da tabela de custodia
- Boleta rapida para aplicacao/resgate
- Exclusao de custodias

**14. Pagina: Controle de Carteiras (Admin)**
- Tabela com carteiras: Nome, Data Inicio, Data Limite, Resgate Total, Data Calculo, Status

**15. Pagina: Configuracoes**
- Redefinir Movimentacoes: apaga custodia, movimentacoes e carteiras

**16. Analise Individual de Ativos**
- Acessada via drill-down na Carteira RF
- Cards: Patrimonio, Ganho, Rentabilidade
- Grafico: Ativo vs CDI
- Tabela de rentabilidade diaria detalhada (via detailRowsBuilder)

**17. Calculadora (Admin)**
- Simulacao de calculo para ativos existentes
- Exibe DailyRows completas do engine

**18. Regras Especiais**
- Poupanca: sem IR, sem IOF, sem cotas, sem PU, sem marcacao a mercado
- Renda Fixa: sem tributacao implementada (apenas motor de calculo)
- Data de referencia maxima: D-1 (ontem)

---

### Sobre as Imagens

Capturarei screenshots de 6 telas principais e as incorporarei no documento:
1. Landing Page
2. Carteira de Renda Fixa
3. Posicao Consolidada
4. Cadastrar Transacao
5. Movimentacoes
6. Proventos Recebidos

### Entrega

Um arquivo `.docx` completo com todos os capitulos e imagens incorporadas, salvo em `/home/lovable/` (storage temporario esta indisponivel).


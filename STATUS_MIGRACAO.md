# Status da Migração — Blueberg

## Referência da versão
Tag de referência: `v0.1-pre-migracao-supabase`

## Objetivo deste checkpoint
Este documento registra o estado atual do projeto Blueberg no momento imediatamente anterior à migração oficial do backend ativo para Supabase externo.

## Situação atual da arquitetura
- O app publicado no Lovable continua utilizando o backend do Lovable Cloud como fonte ativa de dados.
- Um projeto Supabase externo foi estruturado e populado manualmente com sucesso.
- A estrutura do banco e os dados já foram migrados para o Supabase externo.
- A troca oficial da aplicação para consumir o Supabase externo ainda não foi concluída.
- Este checkpoint foi criado para permitir retorno seguro ao estado atual, se necessário.

## Status do banco de dados
O Supabase externo já possui estrutura e dados carregados com sucesso nas seguintes tabelas:

- calendario_dias_uteis
- categorias
- controle_de_carteiras
- custodia
- dias_semana
- emissores
- historico_cdi
- historico_ibovespa
- historico_poupanca_rendimento
- historico_selic
- historico_tr
- instituicoes
- movimentacoes
- poupanca_lotes
- produtos
- profiles
- user_settings

## Contagens validadas no Supabase externo
- calendario_dias_uteis: 1460
- categorias: 5
- controle_de_carteiras: 4
- custodia: 8
- dias_semana: 7
- emissores: 71
- historico_cdi: 817
- historico_ibovespa: 566
- historico_poupanca_rendimento: 762
- historico_selic: 826
- historico_tr: 827
- instituicoes: 108
- movimentacoes: 16
- poupanca_lotes: 2
- produtos: 15
- profiles: 7
- user_settings: 1

## Resumo dos produtos do sistema
O Blueberg está estruturado para lidar com produtos financeiros e regras específicas por produto.

Produtos atualmente considerados na base e nas regras do sistema:
- CDB
- CRI
- CRA
- Fundos de Investimentos
- LC
- LCA
- LCI
- LCD
- LF
- LFS
- LFSN
- LIG
- Tesouro Direto
- Poupança

### Observações relevantes sobre produtos
- Poupança é tratada como produto de Renda Fixa.
- Poupança participa da Carteira de Renda Fixa.
- Na custódia, o produto Poupança utiliza a estratégia "Poupança".
- Na posição consolidada, a Poupança deve aparecer em linha consolidada única.
- As movimentações e proventos da Poupança seguem regras específicas.
- Para Poupança, não deve haver exibição de Preço Unitário e Quantidade em contextos onde essas informações não fazem sentido operacional.

## Resumo das principais páginas do sistema
O Blueberg possui páginas e módulos voltados tanto para investimentos quanto para gestão financeira.

### Estrutura principal de navegação
- Dashboard
- Análise de Gastos
- Extrato
- Nova Transação
- Gerenciar Contas
- Gerenciar Categorias

### Páginas e módulos de investimentos
- Carteira / visão consolidada
- Renda Fixa
- Posição Consolidada
- Movimentações
- Custódia
- Proventos
- Calculadora
- Boleta / formulários de lançamento
- Configurações relacionadas ao comportamento do sistema

### Resumo funcional das páginas
#### Dashboard
Apresenta visão geral do patrimônio, entradas, saídas, saldos e gráficos consolidados.

#### Análise de Gastos
Exibe visão analítica por categoria e subcategoria, com comparações por período e consolidação mensal.

#### Extrato
Lista as transações por conta, com filtros e ações como editar, excluir e ignorar transação.

#### Nova Transação
Permite registrar manualmente entradas, saídas e movimentações financeiras.

#### Gerenciar Contas
Permite cadastrar, editar e organizar contas financeiras do usuário.

#### Gerenciar Categorias
Permite manter categorias e subcategorias de entrada e saída.

#### Carteira / Renda Fixa
Exibe a carteira de investimentos, especialmente ativos de renda fixa, com cálculos, evolução e participação.

#### Posição Consolidada
Apresenta a posição agregada dos ativos em custódia e o detalhamento dos produtos.

#### Movimentações
Centraliza aplicações, resgates, proventos e demais eventos financeiros registrados.

#### Custódia
Armazena a posição dos ativos e os dados necessários para cálculo e apresentação da carteira.

#### Proventos
Apresenta eventos de rendimento, juros, amortizações e outros recebimentos.

#### Calculadora
Módulo voltado ao cálculo financeiro, rentabilidade e acompanhamento de títulos.

#### Boleta
Tela/formulário de lançamento de operações e eventos de investimento.

## Próximos passos após este checkpoint
- Confirmar como realizar a troca do backend ativo do Lovable Cloud para o Supabase externo.
- Validar se a aplicação publicada pode consumir o Supabase externo.
- Revisar autenticação, permissões e possíveis políticas de acesso.
- Migrar automações, incluindo atualização diária de séries históricas como CDI.
- Testar leitura e escrita da aplicação após a troca oficial do backend.

## Observação final
Este documento representa um marco de segurança do projeto.  
Caso seja necessário reverter decisões futuras, a referência inicial é a tag:

`v0.1-pre-migracao-supabase`
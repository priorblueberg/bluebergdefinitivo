

# Engine de Cálculo da Carteira de Renda Fixa

## Visão Geral

Criar uma engine que agrega os resultados individuais de todos os produtos de Renda Fixa em uma visão consolidada de carteira, usando o sistema de Cota Virtual existente mas com inputs agregados. A página `/carteira/renda-fixa` será reescrita para exibir os mesmos componentes da Análise Individual (cards, gráficos, tabela de detalhe).

## Arquivos e Alterações

### 1. Novo arquivo: `src/lib/carteiraRendaFixaEngine.ts`

Engine de agregação da carteira:

- **Inputs**: `data_inicio`, `data_calculo` e `data_limite` vindos de `controle_de_carteiras` (linha "Renda Fixa"); lista de resultados `DailyRow[]` de cada produto individual.
- **Processo**:
  1. Receber o calendário e CDI do período da carteira.
  2. Para cada produto de custódia com categoria "Renda Fixa", rodar `calcularRendaFixaDiario()` individualmente.
  3. Iterar por cada data do calendário e agregar:
     - **Líquido (1)** = soma dos `liquido` de todos os produtos
     - **Aplicações** = soma dos `aplicacoes` de todos os produtos (da engine, NÃO da movimentação)
     - **Resgates** = soma dos `resgates` de todos os produtos (da engine, NÃO da movimentação)
     - **R$ Rent. Diária** = soma dos `ganhoDiario` de todos os produtos
     - **Juros Pago** = soma dos `jurosPago` de todos os produtos
  4. Calcular as colunas de Cota Virtual da carteira usando os totais agregados:
     - PU Inicial fixo = R$ 1.000,00
     - **Valor da Cota (1)**, **Saldo de Cotas (1)** — lógica idêntica à engine existente, usando aplicações/resgates agregados
     - **Valor da Cota (2)**, **Saldo de Cotas (2)** — idem
     - **Líquido (2)** = Líquido (1) + Resgates (do dia)
     - **QTD Cotas Compra** = Aplicações / Valor da Cota anterior
     - **QTD Cotas Resgate** = Resgates / Valor da Cota (2)
     - **R$ Rent. Acumulada** = soma corrida da rent. diária
     - **% Rent. Acumulada** = (Valor da Cota (1) / 1000) - 1

- Interface de saída: `CarteiraRendaFixaRow` com as colunas listadas pelo usuário.

### 2. Alteração: `src/pages/CalculadoraPage.tsx`

- Adicionar uma opção especial no seletor: **"Carteira Renda Fixa"** (com um ID sentinela, ex: `"__carteira_rf__"`).
- Quando selecionada, buscar todos os produtos de Renda Fixa, rodar a engine de carteira, e exibir o resultado numa tabela dedicada (subconjunto de colunas da `CalculadoraTable`).

### 3. Novo componente: `src/components/CalculadoraCarteiraTable.tsx`

- Tabela com as colunas específicas da carteira: Data, Dia Útil, Valor da Cota (1), Saldo de Cotas (1), Líquido (1), Valor da Cota (2), Saldo de Cotas (2), Líquido (2), Aplicações, QTD Cotas Compra, Resgates, QTD Cotas Resgate, R$ Rent. Diária, R$ Rent. Acumulada, % Rent. Acumulada, Juros Pago.

### 4. Reescrita: `src/pages/CarteiraRendaFixaPage.tsx`

Substituir o conteúdo atual (que só mostra CDI) pelo layout da Análise Individual:

- **Cards de resumo**: Patrimônio, Ganho Financeiro, Rentabilidade, CDI Acumulado
- **Gráfico de linha**: Rentabilidade da Carteira vs CDI (duas séries)
- **Gráfico de barras**: Patrimônio Mensal
- **Tabela de detalhe**: `RentabilidadeDetailTable` com dados da engine de carteira

Dados carregados:
1. Buscar `controle_de_carteiras` "Renda Fixa" → `data_inicio`, `data_calculo`, `status`
2. Buscar todos os produtos de custódia com categoria "Renda Fixa"
3. Para cada produto, buscar movimentações e rodar engine individual
4. Agregar via `carteiraRendaFixaEngine`
5. Reutilizar `buildDetailRowsFromEngine()` (extraída de `AnaliseIndividualPage`) para gerar as tabelas de detalhe

### 5. Refatoração menor: Extrair `buildDetailRowsFromEngine`

Mover a função `buildDetailRowsFromEngine` de `AnaliseIndividualPage.tsx` para `src/lib/cdiCalculations.ts` (ou um novo `src/lib/detailRowsBuilder.ts`), para que tanto a Análise Individual quanto a Carteira de Renda Fixa possam reutilizá-la.

## Fluxo de Dados

```text
controle_de_carteiras ("Renda Fixa")
  → data_inicio, data_calculo, data_limite

custodia (categoria = "Renda Fixa")
  → produto 1, produto 2, ... produto N

Para cada produto:
  movimentacoes + calendario + CDI → calcularRendaFixaDiario() → DailyRow[]

Todos os DailyRow[] → carteiraRendaFixaEngine → CarteiraRendaFixaRow[]

CarteiraRendaFixaRow[] → Cards + Gráficos + Tabelas
```




# Plano: Pagamento de Juros Periódico

## Resumo

Implementar o cálculo automático de pagamento de juros periódico para títulos de Renda Fixa cujo campo `pagamento` seja diferente de "No Vencimento". O valor do juros será tratado como resgate no motor de cálculo e exibido em coluna dedicada na Calculadora.

## Escopo

### 1. Função de geração de datas de pagamento de juros

**Arquivo: `src/lib/rendaFixaEngine.ts`**

Criar função `gerarDatasPagamentoJuros` que recebe:
- `dataInicio` (data da aplicação)
- `vencimento` (data de vencimento do título)
- `pagamento` (Mensal, Bimestral, Trimestral, Quadrimestral, Semestral)
- `calendario` (dias úteis)

Lógica:
- Extrair o **dia** do vencimento (ex: 28/12/2025 → dia 28)
- Gerar datas retroativamente a partir do vencimento, subtraindo N meses conforme periodicidade (1, 2, 3, 4 ou 6 meses), até cobrir todo o período desde `dataInicio`
- Para cada data gerada:
  - Se o dia não existe no mês (ex: dia 31 em fevereiro), usar o último dia útil do mês
  - Se a data cair em dia não útil, usar o primeiro dia útil imediatamente **anterior**
- Retornar um `Set<string>` com as datas ajustadas (formato `yyyy-MM-dd`)

### 2. Integrar pagamento de juros no motor de cálculo

**Arquivo: `src/lib/rendaFixaEngine.ts`**

- Adicionar campos ao `EngineInput`: `pagamento?: string`, `vencimento?: string`
- Adicionar campo ao `DailyRow`: `pagamentoJuros: number`
- No loop diário, para cada data que esteja no Set de datas de pagamento:
  - Calcular o **ganho financeiro** desde o último pagamento (ou desde o início): diferença do `liquido` acumulado menos aplicações/resgates no período, ou seja, o rendimento líquido entre as datas-base
  - Na prática: o valor do pagamento de juros = `prevLiquido * dailyMult` acumulado desde o último pagamento (soma dos rendimentos diários do período)
  - Somar este valor aos `resgates` do dia para fins de cálculo de cotas e rentabilidade (conforme item 1.3)
- Rastrear um acumulador de ganho financeiro entre pagamentos, resetado a cada data de pagamento

### 3. Atualizar a Calculadora

**Arquivo: `src/pages/CalculadoraPage.tsx`**

- Passar `pagamento` e `vencimento` do produto selecionado para o engine
- Buscar `vencimento` na query de custódia (adicionar ao select e ao tipo `CustodiaOption`)
- Adicionar coluna "Pgto Juros" na tabela, após "QTD Cotas (Resgate)"
- Exibir o valor formatado como moeda nos dias de pagamento, "—" nos demais

### 4. Atualizar syncEngine

**Arquivo: `src/lib/syncEngine.ts`**

- Nas chamadas a `calcularRendaFixaDiario` dentro de `syncManualResgatesTotais` e `syncResgateNoVencimento`, passar `pagamento` e `vencimento` da custódia para que o engine considere os pagamentos de juros no cálculo do líquido final

## Detalhes Técnicos

- Mapeamento de periodicidade: `{ Mensal: 1, Bimestral: 2, Trimestral: 3, Quadrimestral: 4, Semestral: 6 }`
- Datas geradas retroativamente do vencimento garante alinhamento com o último pagamento na data de vencimento
- Ajuste de dia não útil: buscar no calendário o maior dia útil ≤ data-alvo
- Nenhuma alteração de banco de dados necessária


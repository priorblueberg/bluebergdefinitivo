

# Fix: Usar Líquido (2) no dia do resgate_total em gráficos e tabela

## Problema

A correção anterior (linha 165) só substitui `liquido` por `liquido2` exatamente no dia do `resgate_total`. Porém, se houver dias posteriores ao resgate no mesmo mês (ou se o loop continuar processando), o valor `liquido = 0` desses dias sobrescreve o patrimônio correto. Além disso, os cálculos de "Ganho Financeiro" mensal e anual (linhas 170-172) também usam `row.liquido` diretamente.

## Solução

**Arquivo: `src/pages/AnaliseIndividualPage.tsx`** — função `buildDetailRowsFromEngine`

1. **Parar o processamento após o dia do resgate_total**: Quando `resgateTotal` é definido e `row.data > resgateTotal`, fazer `break` no loop. Dias após o encerramento não devem alimentar nenhuma métrica.

2. **Usar `patrimonioValue` (que já considera `liquido2`) nos cálculos de Ganho Financeiro** (linhas 170-172): substituir `row.liquido` por `patrimonioValue` para que o ganho mensal e anual reflitam o patrimônio correto no encerramento.

Isso garante que gráfico de barras (Patrimônio Mensal), tabela de rentabilidade e ganho financeiro usem todos o mesmo valor do card "Posição Fechada".


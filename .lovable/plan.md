

# Atualizar Análise Individual para Pagamento de Juros

## Problema
A página `/carteira/analise-individual` chama `calcularRendaFixaDiario` sem passar os campos `pagamento` e `vencimento`, então títulos com juros periódicos não consideram os pagamentos no cálculo de rentabilidade e patrimônio.

## Alterações

### Arquivo: `src/pages/AnaliseIndividualPage.tsx`

1. **Adicionar `pagamento` ao tipo `CustodiaProduct`** (linha ~28): novo campo `pagamento: string | null`

2. **Buscar `pagamento` na query de custódia** (linha 594): adicionar `pagamento` ao select

3. **Mapear `pagamento` no resultado** (linha ~597-614): incluir `pagamento: row.pagamento`

4. **Passar `pagamento` e `vencimento` ao engine** (linhas 295-308): adicionar os dois campos na chamada a `calcularRendaFixaDiario`

5. **Atualizar `buildDetailRowsFromEngine`**: considerar `pagamentoJuros` nos cálculos de ganho financeiro — o campo `resgates` do engine já inclui o pagamento de juros, então o cálculo de fluxos (aplicações - resgates) já deve capturar o efeito corretamente, mas validar que o ganho financeiro mensal não é distorcido pelos pagamentos de juros (que são resgates "técnicos" e não reduzem o ganho real).

### Lógica de Ganho Financeiro
O pagamento de juros é incluído nos `resgates` do engine, mas representa rendimento distribuído (não saída de capital). No cálculo do ganho financeiro:
- Fórmula atual: `liquido - patrimonioAnterior - aplicações + resgates`
- Os resgates de juros estão em `row.resgates`, que inclui `pagamentoJuros`
- Para isolar corretamente, subtrair `pagamentoJuros` dos resgates no cálculo de fluxos, ou somar separadamente — precisa ajustar para que juros pagos sejam tratados como ganho realizado.

Na prática: `ganhoMes = liquido - patrimonioAnterior - aplicações + (resgates - pagamentoJuros)` ficaria incorreto pois ignora o juros pago. O correto é manter como está: `liquido - patrimonioAnterior - aplicações + resgates`, pois o juros pago sai do patrimônio (reduz líquido) mas volta como resgate, zerando o efeito no ganho.

Portanto, nenhuma alteração na fórmula de ganho financeiro é necessária — apenas passar os campos faltantes ao engine.


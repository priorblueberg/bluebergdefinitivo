

# Recálculo completo de rentabilidade após qualquer alteração de movimentação

## Problema

Existem múltiplos pontos no código que calculam saldo/rentabilidade de formas inconsistentes, alguns sem considerar pagamento de juros periódico:

1. **`src/lib/saldoCalculations.ts`** — `calcSaldoPrefixado` usa fórmula simplificada (sem engine, sem pagamento de juros). Usada pela página de cadastro de resgate para calcular o saldo disponível.
2. **`src/components/BoletaCustodiaDialog.tsx`** — chama `calcularRendaFixaDiario` sem `pagamento` e `vencimento`, ignorando juros periódicos.
3. O sync engine (`syncManualResgatesTotais` e `syncResgateNoVencimento`) já recalcula do D0 usando o engine completo.

## Alterações

### 1. Substituir `calcSaldoPrefixado` pelo engine completo

**Arquivo: `src/lib/saldoCalculations.ts`**

Reescrever para usar `calcularRendaFixaDiario` em vez da fórmula manual simplificada. A nova versão buscará o calendário, movimentações, e dados de custódia (pagamento, vencimento, resgate_total) e retornará o `liquido` da última linha do engine.

### 2. Passar `pagamento` e `vencimento` no BoletaCustodiaDialog

**Arquivo: `src/components/BoletaCustodiaDialog.tsx`**

Adicionar `pagamento: row.pagamento` e `vencimento: row.vencimento` na chamada a `calcularRendaFixaDiario` (linha ~152-161).

### 3. Garantir que `CadastrarTransacaoPage` passe os campos necessários

**Arquivo: `src/pages/CadastrarTransacaoPage.tsx`**

Atualizar a chamada de `calcSaldoPrefixado` para passar `pagamento` e `vencimento` do item de custódia selecionado (a nova assinatura da função exigirá esses campos).

## Detalhes Técnicos

- A nova `calcSaldoPrefixado` receberá parâmetros adicionais: `pagamento`, `vencimento`, `precoUnitario` (PU inicial)
- Internamente, buscará calendário e movimentações do Supabase e chamará `calcularRendaFixaDiario` com todos os campos
- Retornará `lastRow.liquido` como saldo
- Nenhuma alteração de banco de dados necessária
- O sync engine já está correto — as alterações garantem que todas as visualizações prévias (saldo para resgate, boleta) também usem o engine completo


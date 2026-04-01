

# Fix: Juros Pago zerado quando há Resgate no mesmo dia de pagamento

## Problema

No dia 29/02/2024 (último dia útil antes do dia 30, data de corte mensal), a coluna "Pgto Juros" não mostra "Sim" apesar de ser um dia de pagamento periódico.

A causa raiz está na linha 350 de `src/lib/rendaFixaEngine.ts`:

```typescript
jurosPago = apoioCupom - tempBaseEconomica - resgateLimpo;
```

No dia 29/02 há um Resgate de R$ 30.000 e o juros acumulado no período é ~R$ 1.700. A subtração do `resgateLimpo` (30.000) torna o resultado negativo (-28.300), que é clampeado para zero. Por isso "Pgto Juros" não mostra "Sim".

Os outros dias funcionam porque:
- 30/01: sem resgate (resgateLimpo = 0)
- 28/03: sem movimentação (resgateLimpo = 0)
- 30/04: usa a branch `isFinalDay`, que não subtrai resgateLimpo

## Correção

**Arquivo:** `src/lib/rendaFixaEngine.ts`, linha 350

O `resgateLimpo` é uma saída de capital, não de juros. O juros periódico deve ser calculado independentemente do resgate de capital.

```typescript
// Antes:
jurosPago = apoioCupom - tempBaseEconomica - resgateLimpo;

// Depois:
jurosPago = apoioCupom - tempBaseEconomica;
```

Uma única alteração. Nenhuma outra coluna será modificada.


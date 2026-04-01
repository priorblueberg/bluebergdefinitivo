

# Fix: Valor da Cota (1) na Carteira RF não inclui Juros Pago

## Problema

No `carteiraRendaFixaEngine.ts` (linha 148), o cálculo do Valor da Cota (1) usa apenas `liquido1 / saldoCotas1`, sem somar `jurosPago`. A regra correta (já implementada no engine individual) é:

**Valor da Cota (1) = (Líquido (1) + Juros Pago) / Saldo de Cotas (1)**

No dia 29/02, o juros pago não está sendo somado ao numerador, resultando em 1.011,41 em vez de 1.013,35.

## Correção

**Arquivo:** `src/lib/carteiraRendaFixaEngine.ts`, linha 148

```typescript
// Antes:
valorCota1 = saldoCotas1 > 0 ? liquido1 / saldoCotas1 : prevValorCota;

// Depois:
valorCota1 = saldoCotas1 > 0 ? (liquido1 + jurosPago) / saldoCotas1 : prevValorCota;
```

Uma única linha alterada. Nenhuma outra coluna será modificada.


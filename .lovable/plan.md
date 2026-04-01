

# Fix: Líquido (2) incluindo jurosPago indevidamente

## Problema

Na linha 392 de `src/lib/rendaFixaEngine.ts`, o cálculo do `liquido2` soma `jurosPago`:

```typescript
liquido2 = liquido1 + resgatesTotal + jurosPago;  // linha 392
```

A regra correta é: **Líquido (2) = Líquido (1) + Resgates**. Juros pago não entra nesta soma. No dia 30/01 não houve resgate, apenas pagamento de juros, então `liquido2` deveria ser igual a `liquido1` (R$ 170.026,68), mas está somando o jurosPago e mostrando R$ 171.111,31.

## Correção

**Arquivo:** `src/lib/rendaFixaEngine.ts`, linha 392

Remover `+ jurosPago` da fórmula não-final:

```typescript
// Antes:
liquido2 = liquido1 + resgatesTotal + jurosPago;

// Depois:
liquido2 = liquido1 + resgatesTotal;
```

Nenhuma outra coluna será alterada.


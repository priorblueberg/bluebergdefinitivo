

# Fix: Valor da Cota no Resgate Total Antecipado

## Problema
No dia do resgate total antecipado, `resgatesTotal` usa `resgateLimpo + jurosPago` (valor investido + juros), mas o patrimônio real inclui rentabilidade acumulada. Resultado: líquido não zera e cota fica negativa.

## Correção — 1 linha

**Arquivo: `src/lib/rendaFixaEngine.ts`, linha 336**

Trocar `isVencimentoDay` por `isFinalDay`:

```typescript
// ANTES:
if (isVencimentoDay) {
  resgatesTotal = prevLiquido * (1 + dailyMult);
}

// DEPOIS:
if (isFinalDay) {
  resgatesTotal = prevLiquido * (1 + dailyMult);
}
```

## Análise de impacto — Zero regressão

| Cenário | Antes | Depois |
|---------|-------|--------|
| Vencimento normal | `isVencimentoDay=true` → entra no if ✅ | `isFinalDay=true` (inclui vencimento) → mesma lógica ✅ |
| Sem resgate antecipado | `isResgateTotalDay=false` → não entra ✅ | Idem ✅ |
| Resgate antecipado | Não entra no if → cota negativa ❌ | `isFinalDay=true` → patrimônio completo resgatado ✅ |


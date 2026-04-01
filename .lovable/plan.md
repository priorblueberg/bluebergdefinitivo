

# Correções: Card Rentabilidade + Tabela Rentabilidade

## Problema 1: Card Rentabilidade — formatação diferente por tipo de pagamento

O card usa `parseFloat((rawPct * 100).toFixed(2))` para ambos os tipos, mas:
- **"No Vencimento"** (título 101): deve **arredondar** → `toFixed(2)` → 3,73% ✓
- **Pagamento periódico** (título 100): deve **truncar** → 3,7391% → 3,73%

A regra deve ser aplicada ao valor numérico antes de chegar ao card, para que `fmtPctCard` apenas formate o que receber.

**Arquivo**: `src/pages/AnaliseIndividualPage.tsx` (~linha 307)

```typescript
// Atual (arredonda para ambos):
rentValue = parseFloat((rawPct * 100).toFixed(2));

// Corrigido:
if (useRentAcum2) {
  // Truncar: 3.7391 → 3.73
  rentValue = Math.floor(rawPct * 10000) / 100;
} else {
  // Arredondar: 3.729... → 3.73
  rentValue = parseFloat((rawPct * 100).toFixed(2));
}
```

## Problema 2: Tabela Rentabilidade — rentabilidade mensal inflada para títulos com juros

**Causa raiz**: Em dias não úteis, o engine repete o `rentDiariaPct` anterior (valor não-zero). O `detailRowsBuilder` compõe esse valor repetido, contando a rentabilidade diária múltiplas vezes (sábados, domingos, feriados).

Para `rentabilidadeDiaria` (cota-based, "No Vencimento") isso não acontece porque `valorCota1/prevValorCota - 1 = 0` em dias não úteis.

Resultado: título 100 mostra JAN=1,29% em vez de ~0,92%.

**Correção**: Quando `useRentAcum2 = true`, só compor `rentDiariaPct` em dias úteis.

**Arquivo**: `src/lib/detailRowsBuilder.ts` (~linha 119)

```typescript
// Atual:
const dailyRent = useRentAcum2
  ? (row.rentDiariaPct ?? 0)
  : (row.rentabilidadeDiaria ?? 0);
if (dailyRent !== 0) {
  rentFatorMensal *= 1 + dailyRent;
  rentFatorAnual *= 1 + dailyRent;
}

// Corrigido:
const dailyRent = useRentAcum2
  ? (row.diaUtil ? (row.rentDiariaPct ?? 0) : 0)
  : (row.rentabilidadeDiaria ?? 0);
if (dailyRent !== 0) {
  rentFatorMensal *= 1 + dailyRent;
  rentFatorAnual *= 1 + dailyRent;
}
```

## Resumo

| Arquivo | Alteração |
|---|---|
| `src/pages/AnaliseIndividualPage.tsx` | Card Rentabilidade: truncar para pagamento periódico, arredondar para "No Vencimento" |
| `src/lib/detailRowsBuilder.ts` | Tabela: só compor `rentDiariaPct` em dias úteis para evitar contagem dupla |


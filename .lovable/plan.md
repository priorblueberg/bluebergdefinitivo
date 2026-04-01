

# Correções na Análise Individual

## Problemas identificados

### 1. Card Rentabilidade — título "No Vencimento" mostra 3,72% em vez de 3,73%

**Causa raiz**: O card usa `Math.floor(rawPct * 10000) / 100` (truncamento), mas a calculadora usa `(value * 100).toFixed(2)` (arredondamento). Como `rentabilidadeAcumuladaPct` é um ratio (ex: 0.03729...), o truncamento produz 3,72% enquanto o arredondamento produz 3,73%.

**Correção**: Trocar `Math.floor` por `.toFixed(2)` no card, alinhando com a calculadora:
```typescript
// De:
rentValue = Math.floor(rawPct * 10000) / 100;
// Para:
rentValue = parseFloat((rawPct * 100).toFixed(2));
```

**Arquivo**: `src/pages/AnaliseIndividualPage.tsx`, linha 309.

### 2. Tabela de Rentabilidade — manter coerência com a lógica de Rent. Acum (2)

O código em `src/lib/detailRowsBuilder.ts` já compõe os retornos diários corretamente usando `rentDiariaPct` para títulos com pagamento diferente de "No Vencimento" e `rentabilidadeDiaria` para "No Vencimento". A composição mensal/anual via fatores multiplicativos (`rentFatorMensal *= 1 + dailyRent`) está alinhada com a lógica da coluna Rent. Acum (2).

Nenhuma alteração necessária neste arquivo — a lógica já está correta.

## Resumo de alterações

| Arquivo | Alteração |
|---|---|
| `src/pages/AnaliseIndividualPage.tsx` | Trocar truncamento por arredondamento no card de Rentabilidade (linha 309) |


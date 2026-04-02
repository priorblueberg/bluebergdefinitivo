

# Correção: Rent. Diária (%) e Rent. Acum (2) na Engine

## Problema

A engine calcula `rentDiariaPct` com a fórmula errada:

```
rentDiariaPct = ganhoDiario / prevLiq2   (engine atual, linha 509)
```

A planilha usa:

```
rentDiariaPct = ganhoDiario / (prevLiquido + aplicacoes)   (correto)
```

**Impacto**: Em dias de aplicação, a fórmula errada não dilui o retorno (ex: Jan 5, engine mostra 0.04% mas planilha mostra 0.03%). Isso causa divergência na Rent. Acum (2) — a engine acumula mais do que deveria.

**Exemplo concreto** (Jan 5, aplicação de R$ 50.000):
- Engine: `45.02 / 100,089.98 = 0.045%` (usa prevLiq2 do dia anterior, sem diluição)
- Planilha: `45.02 / (100,089.98 + 50,000) = 0.030%` (dilui pela aplicação do dia)

## Solução

Alterar a fórmula de `rentDiariaPct` na engine para usar `ganhoDiario / (prevLiquido + aplicacoes)`, alinhando com a planilha e com a correção já aplicada no `detailRowsBuilder`.

## Alteração

**Arquivo**: `src/lib/rendaFixaEngine.ts` (linhas 493-514)

```typescript
// Antes (linhas 506-509):
const prevLiq2 = i > 0 && rows.length > 0 ? rows[rows.length - 1].liquido2 : 0;
if (prevLiq2 > 0.01) {
  rentDiariaPct = ganhoDiario / prevLiq2;
}

// Depois:
const denominator = prevLiquido + aplicacoes;
if (denominator > 0.01) {
  rentDiariaPct = ganhoDiario / denominator;
}
```

A variável `prevLiquido` já existe no loop e é atualizada corretamente a cada iteração. Não é necessária nenhuma alteração no `detailRowsBuilder` (que já usa a mesma fórmula localmente) nem na interface `DailyRow`.

| Arquivo | Alteração |
|---|---|
| `src/lib/rendaFixaEngine.ts` | Corrigir fórmula de `rentDiariaPct`: usar `ganhoDiario / (prevLiquido + aplicacoes)` em vez de `ganhoDiario / prevLiq2` |


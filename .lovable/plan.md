

## Diagnóstico: Divergência de centavos no título Mista (104)

### Causa raiz

No engine (`rendaFixaEngine.ts`), o CDI Diário é **truncado para 8 casas decimais**:

```typescript
const cdiDiarioVal = diaUtil && cdiAnual > 0
  ? parseFloat(calcCdiDiario(cdiAnual).toFixed(8))
  : prevCdiDiarioVal;
```

Para produtos **Pós-Fixado CDI**, a fórmula do multiplicador é uma simples multiplicação (`cdiDiario × taxa/100`), então o erro de truncamento é insignificante.

Para produtos **Mista**, o CDI Diário entra numa multiplicação composta: `(1 + CDI Diário) × (1 + Taxa)^(1/252) - 1`. Como o multiplicador Mista **amplifica** o CDI (multiplica por ~1.000343 em vez de apenas escalar), cada centésimo de milionésimo perdido no truncamento se acumula dia a dia. Em ~200 dias úteis, isso vira 1-3 centavos de diferença.

Os demais títulos batem na vírgula porque usam fórmulas lineares ou o multiplicador fixo Prefixado (que não depende do CDI truncado).

### Correção proposta

**Arquivo: `src/lib/rendaFixaEngine.ts`**

Remover o `.toFixed(8)` do cálculo do CDI Diário, usando a precisão nativa do JavaScript (float64 ~15-16 dígitos):

```typescript
// ANTES:
const cdiDiarioVal = diaUtil && cdiAnual > 0
  ? parseFloat(calcCdiDiario(cdiAnual).toFixed(8))
  : prevCdiDiarioVal;

// DEPOIS:
const cdiDiarioVal = diaUtil && cdiAnual > 0
  ? calcCdiDiario(cdiAnual)
  : prevCdiDiarioVal;
```

Isso elimina a perda de precisão na fonte, mantendo ~15 dígitos significativos em vez de 8. Os títulos Prefixado e Pós-Fixado não são afetados (já batem na vírgula).

### Impacto
- Uma alteração de 1 linha no `rendaFixaEngine.ts`
- Nenhuma mudança de regra de cálculo — apenas maior precisão numérica
- Todos os títulos se beneficiam, mas o efeito visível será apenas no Mista




## Diagnóstico: Divergência de 1 centavo no título Pós Fixado (101)

### Causa raiz provável

No engine (`rendaFixaEngine.ts`, linha 308-309), o multiplicador Pós Fixado CDI usa o CDI do dia **anterior**:

```typescript
const prevCdiDiario = rows.length > 0 ? rows[rows.length - 1].cdiDiario : 0;
dailyMult = diaUtil ? prevCdiDiario * (taxa / 100) : 0;
```

Para **Mista**, usar o CDI anterior é correto (fórmula explícita do Excel: `(1 + CDI anterior) * spread`). Porém, para **Pós Fixado CDI**, a convenção de mercado é capitalizar com o CDI **do próprio dia** (a taxa publicada em D capitaliza de D para D+1):

```typescript
// Deveria ser:
dailyMult = diaUtil ? cdiDiarioVal * (taxa / 100) : 0;
```

Quando a SELIC/CDI muda (reuniões do COPOM), o lag de 1 dia faz com que a nova taxa seja aplicada um dia depois do correto. Ao longo de ~500 dias úteis com várias mudanças de taxa, essa defasagem acumula até chegar a 1 centavo de diferença.

Os títulos Prefixado não são afetados (não usam CDI). Os títulos Mista usam `prevCdiDiario` propositalmente conforme a planilha Excel e já batem.

### Correção proposta

**Arquivo: `src/lib/rendaFixaEngine.ts`** — linha 308-309

Usar `cdiDiarioVal` (CDI do dia atual) em vez de `prevCdiDiario` no cálculo do multiplicador Pós Fixado:

```typescript
// ANTES (linha 307-309):
} else if (isPosFixadoCDI) {
  const prevCdiDiario = rows.length > 0 ? rows[rows.length - 1].cdiDiario : 0;
  dailyMult = diaUtil ? prevCdiDiario * (taxa / 100) : 0;

// DEPOIS:
} else if (isPosFixadoCDI) {
  dailyMult = diaUtil ? cdiDiarioVal * (taxa / 100) : 0;
```

Também aplicar a mesma correção no cálculo do PU (linha ~353-355), que para Pós Fixado deve usar `dailyMult` (que já será baseado no CDI correto).

### Impacto
- Alteração de 2 linhas no `rendaFixaEngine.ts`
- Afeta apenas títulos Pós Fixado CDI
- Títulos Mista e Prefixado permanecem inalterados


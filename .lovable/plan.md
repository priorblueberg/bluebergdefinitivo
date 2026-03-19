

# Fix: Líquido (1) negativo próximo de zero na Análise Individual

## Problema
Arredondamentos no motor de cálculo fazem com que o Líquido (1) no dia do vencimento apareça como `-0,00` em vez de `0`.

## Correção

**Arquivo: `src/lib/rendaFixaEngine.ts`**

Após calcular `liquido1`, adicionar uma verificação: se o valor absoluto for menor que `0.01` (1 centavo), forçar para `0`. Isso já é feito para `liquido2` (variável `isZeroLiquido`), basta aplicar a mesma lógica ao próprio `liquido1` antes de usá-lo.

```typescript
// Após: const liquido1 = prevLiquido * (1 + dailyMult) + mov.aplicacoes - resgatesTotal;
const liquido1Raw = prevLiquido * (1 + dailyMult) + mov.aplicacoes - resgatesTotal;
const liquido1 = Math.abs(liquido1Raw) < 0.01 ? 0 : liquido1Raw;
```

Isso resolve o problema na raiz, afetando todas as páginas que consomem o engine (Calculadora, Análise Individual, Proventos).


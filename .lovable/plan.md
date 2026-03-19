

# Correção: Data de Pagamento de Juros Ajustada Incorretamente

## Problema Identificado

A função `ajustarParaDiaUtil` em `gerarDatasPagamentoJuros` usa uma busca binária que tenta encontrar o último dia útil ≤ data-alvo em uma única passagem. O problema é que a busca binária **não visita todos os elementos** — ela pula índices conforme a lógica de partição. Quando o caminho da busca passa de um dia útil (ex: 27/03) direto para um dia não útil (ex: 29/03), o dia útil intermediário (28/03) nunca é visitado e nunca é registrado como candidato.

**Exemplo concreto (Março 2024):**
- Alvo: `2024-03-30` (sábado, não útil)
- A busca binária visita 27/03 (útil → best = 27/03), depois pula para 29/03 (não útil), depois 30/03 (não útil). O dia 28/03 (útil, quinta-feira) **nunca é visitado**, e `best` fica em 27/03.

## Correção

**Arquivo: `src/lib/rendaFixaEngine.ts`** — função `ajustarParaDiaUtil` (linhas 91-111)

Separar as duas responsabilidades:
1. Busca binária para encontrar a **posição** do último elemento ≤ alvo
2. Varredura linear reversa a partir dessa posição para encontrar o primeiro dia útil

```typescript
function ajustarParaDiaUtil(targetDate: string): string | null {
  let lo = 0, hi = allDates.length - 1, pos = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (allDates[mid] <= targetDate) {
      pos = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (pos < 0) return null;
  for (let i = pos; i >= 0; i--) {
    if (diasUteisSet.has(allDates[i])) return allDates[i];
  }
  return null;
}
```

Essa correção é isolada e não afeta nenhuma outra parte do motor de cálculo. Os pagamentos de juros simplesmente passarão a cair nas datas corretas.


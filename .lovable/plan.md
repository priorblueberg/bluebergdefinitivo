

## Diagnóstico: Rentabilidade consolidada da carteira 33.73% vs 33.75%

### Causa raiz

No engine da carteira (`carteiraRendaFixaEngine.ts`, linha 84), a **Rent. Diária (%)** é calculada como:

```
rentDiariaPct = rentDiariaRS / liquido2   (do dia ATUAL)
```

O problema: `liquido2` do dia atual já inclui o ganho do dia (`liquido2 = liquido1 + resgates`, e `liquido1` já tem o rendimento embutido). Isso infla o denominador, subestimando sistematicamente a rentabilidade diária.

Para produtos individuais isso funciona porque a fórmula é auto-consistente (definida assim no Excel). Mas na **agregação da carteira**, quando produtos diferentes têm resgates/pagamentos em dias distintos, esse denominador inflado acumula um erro composto de ~0.02% ao longo de ~500 dias úteis.

### Correção

Usar o **Líquido (1) do dia anterior** como denominador da rentabilidade diária da carteira. O `ganhoDiário` já isola o ganho puro (exclui aplicações, resgates e juros), então dividir pelo patrimônio inicial do dia (= Líquido(1) do dia anterior) dá a rentabilidade correta:

```
rentDiariaPct = rentDiariaRS / prevLiquido
```

### Alterações

**Arquivo: `src/lib/carteiraRendaFixaEngine.ts`**

1. Rastrear o `prevLiquido` (Líquido(1) do dia anterior) no loop
2. Usar `prevLiquido` como denominador em vez de `liquido2` do dia atual
3. Manter tudo o mais igual (colunas Líquido(1), Líquido(2), R$ Acumulada etc.)

```typescript
// ANTES (linha 84):
const rentDiariaPct = liquido2 > 0.01 ? rentDiariaRS / liquido2 : 0;

// DEPOIS:
const rentDiariaPct = prevLiquido > 0.01 ? rentDiariaRS / prevLiquido : 0;
```

Onde `prevLiquido` é o `liquido` (soma dos Líquido(1)) do dia anterior, atualizado ao final de cada iteração.

### Impacto
- Alteração de ~5 linhas em `carteiraRendaFixaEngine.ts`
- Não afeta cálculos individuais de produtos
- Não altera colunas R$ (Líquido, Ganho, etc.) — apenas a % composta


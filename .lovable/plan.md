

# Correção: Rentabilidade mensal 0,94% → 0,92% para títulos com juros periódicos

## Diagnóstico

A diferença de 0,02% ocorre porque as duas metodologias tratam o dia de aplicação de forma diferente:

- **Título 101 (No Vencimento)** usa `rentabilidadeDiaria` (baseada em cotas). No dia de uma aplicação, o retorno é **diluído** porque o dinheiro novo entra ao preço da cota corrente mas não rendeu no dia. Exemplo: no dia 05/01 (aplicação de R$ 50.000), o retorno diário é `mult × prevLiquido / (prevLiquido + 50.000)` ≈ 67% do retorno normal. Resultado: JAN = 0,92%.

- **Título 100 (Mensal)** usa `rentDiariaPct = ganhoDiario / prevLiq2`. Nesta fórmula, o denominador (`prevLiq2` = Líquido(2) do dia anterior) **não inclui a aplicação do dia**, então o retorno não é diluído — é sempre ≈ `mult` (retorno cheio). Resultado: JAN = 0,94%.

Adicionalmente, no dia seguinte a um resgate, `prevLiq2` inclui o valor resgatado (é o patrimônio bruto antes do resgate), enquanto `prevLiquido` não. Isso causa `rentDiariaPct < mult` no dia seguinte ao resgate, diferente do sistema de cotas que retorna `mult`.

## Solução

Recalcular o retorno diário no `detailRowsBuilder` usando os componentes brutos em vez de `rentDiariaPct`:

```
dailyRent = ganhoDiario / (prevLiquido + aplicações_do_dia)
```

Esta fórmula:
- **Dias normais**: `prevLiq × mult / prevLiq = mult` ✓
- **Dias de aplicação**: `prevLiq × mult / (prevLiq + A)` = retorno diluído (igual ao sistema de cotas) ✓
- **Dias de resgate**: `prevLiq × mult / prevLiq = mult` ✓ (resgates não afetam o denominador)
- **Dia após resgate**: `postResgate × mult / postResgate = mult` ✓ (corrige o bug do prevLiq2)
- **Dia de pagamento de juros**: juros se cancela no `ganhoDiario` → `mult` ✓ (neutraliza cupom)
- **Dia após pagamento de juros**: patrimônio reduzido mas o retorno ainda é `mult` ✓
- **Dias não úteis**: `diaUtil` check mantém retorno = 0 ✓

## Alteração

**Arquivo**: `src/lib/detailRowsBuilder.ts`

Substituir o uso direto de `row.rentDiariaPct` por uma computação local:

```typescript
// Antes:
const dailyRent = useRentAcum2
  ? (row.diaUtil ? (row.rentDiariaPct ?? 0) : 0)
  : (row.rentabilidadeDiaria ?? 0);

// Depois:
let dailyRent: number;
if (useRentAcum2) {
  if (row.diaUtil && prevRowLiquido > 0.01) {
    dailyRent = row.ganhoDiario / (prevRowLiquido + row.aplicacoes);
  } else {
    dailyRent = 0;
  }
} else {
  dailyRent = row.rentabilidadeDiaria ?? 0;
}
```

Adicionar variável `prevRowLiquido` ao loop, inicializada em 0 e atualizada com `row.liquido` ao final de cada iteração (incluindo antes do `continue` no skip de linhas zeradas).

| Arquivo | Alteração |
|---|---|
| `src/lib/detailRowsBuilder.ts` | Recalcular retorno diário com `ganhoDiario / (prevLiquido + aplicações)` em vez de usar `rentDiariaPct` |


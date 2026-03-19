

## Diagnóstico

A diferença de 1 centavo vem do acúmulo de imprecisão de ponto flutuante (floating-point). No engine (`rendaFixaEngine.ts`), o cálculo diário do `liquido` é:

```
liquido1 = prevLiquido * (1 + dailyMult) + aplicacoes - resgates
```

Esse valor **nunca é arredondado** para 2 casas decimais antes de ser passado para o dia seguinte. Após centenas de dias úteis de multiplicação, o erro acumula e pode gerar 1 centavo de diferença em relação a uma planilha que arredonda a cada passo.

O mesmo ocorre com `valorCota` e `saldoCotas`, que também são propagados sem arredondamento.

## Plano de Correção

**Arquivo: `src/lib/rendaFixaEngine.ts`**

Adicionar arredondamento a 2 casas decimais nos valores monetários (`liquido1`, `liquido2`) e a 2 casas nos valores de cotas (`valorCota1`, `valorCota2`, `saldoCotas1`, `saldoCotas2`, `qtdCotasCompra`, `qtdCotasResgate`) após cada cálculo diário, antes de armazená-los no `row` e de propagá-los como `prev*`.

Usar uma função auxiliar `round2(v) = Math.round(v * 100) / 100`.

Valores que **não** devem ser arredondados: `rentabilidadeDiaria` e `multiplicador` (precisão máxima necessária para acumular fatores de rentabilidade).

Isso garantirá que o motor produza exatamente os mesmos valores que uma planilha com arredondamento a cada linha.


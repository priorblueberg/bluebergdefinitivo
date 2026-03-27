

# Correção: Quantidade de resgate incorreta na movimentação

## Problema identificado

Na função `reprocessMovimentacoesForCodigo` (syncEngine.ts, linha 754), o motor é chamado passando apenas as movimentações **anteriores** à movimentação atual:

```text
precedingMovs = manualMovs.filter((m, idx) => idx < i)
```

Isso significa que, ao processar um **Resgate**, o próprio resgate **não está incluído** nos dados enviados ao motor. Sem o resgate nos inputs, o motor calcula `qtdResgate2 = 0` (porque `resgatesTotal = 0`). O código então cai no fallback `mov.valor / puJurosPeriodicos`, que dá **1,7131831** — o valor errado.

Na **Calculadora**, todas as movimentações (incluindo o resgate) são passadas ao motor, por isso `qtdResgate2` retorna corretamente **29,9043062**.

## Solução

Para movimentações de **resgate**, incluir a própria movimentação na lista enviada ao motor, para que ele calcule `qtdResgate2` (e `qtdResgatePU`) corretamente.

## Arquivo alterado

**`src/lib/syncEngine.ts`** — função `reprocessMovimentacoesForCodigo`

- Ao montar a lista de movimentações para o motor (`precedingMovs`), quando a movimentação atual for um resgate, incluir também a movimentação atual na lista (idx <= i em vez de idx < i).
- Aplicações continuam usando apenas movimentações anteriores (idx < i), pois a lógica de `qtdAplicacaoPU` depende do PU do dia anterior.

A mudança é mínima: apenas a condição do filtro na linha 755, condicionada ao tipo de movimentação.


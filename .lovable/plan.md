

# Correção: Valor do Resgate no Vencimento automático

## Problema

Na função `syncResgateNoVencimento` (syncEngine.ts, linha 214/218), o valor da movimentação automática de "Resgate no Vencimento" usa `lastRow.resgateLimpo` — que representa apenas o capital investido, sem juros.

O correto é usar `lastRow.resgates` — a coluna **Resgate** da calculadora, que inclui capital + juros acumulados.

## Solução

**`src/lib/syncEngine.ts`** — função `syncResgateNoVencimento`, linhas 213-221:

Trocar `lastRow.resgateLimpo` por `lastRow.resgates` em ambos os branches (No Vencimento e periódico).

Antes:
```
valor = lastRow.resgateLimpo;
```

Depois:
```
valor = lastRow.resgates;
```

A mudança é em duas linhas (214 e 218). Tudo o mais (PU, quantidade, formatação) permanece igual.


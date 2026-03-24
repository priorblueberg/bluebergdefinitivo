

# Corrigir Multiplicador Pós-Fixado — Incompatibilidade de texto

## Problema

O formulário de cadastro salva a modalidade como **"Pós Fixado"** (com acento), mas o engine compara com **"Pos Fixado"** (sem acento). Por isso `isPosFixadoCDI` é sempre `false` e o multiplicador fica zerado.

## Solução

Alterar o engine (`src/lib/rendaFixaEngine.ts`) para aceitar ambas as formas:

### `src/lib/rendaFixaEngine.ts` — linha 203

Trocar:
```typescript
const isPosFixadoCDI = modalidade === "Pos Fixado" && indexador === "CDI";
```
Por:
```typescript
const isPosFixadoCDI = (modalidade === "Pos Fixado" || modalidade === "Pós Fixado") && indexador === "CDI";
```

Isso é suficiente para corrigir o cálculo do multiplicador para títulos Pós-Fixados CDI.




# Alterar "Valor Unitário" na página Proventos

## O que muda

O campo **Valor Unitário** na página de Proventos passa a ser calculado como:

**Preço Unitário (engine) − Preço Unitário (custódia)**

Ou seja: `row.precoUnitario - prod.preco_unitario`

## Alteração

### `src/pages/ProventosRecebidosPage.tsx` — linha 119

Substituir:
```typescript
valorUnitario: prod.preco_unitario || 0,
```

Por:
```typescript
valorUnitario: row.precoUnitario - (prod.preco_unitario || 0),
```

Isso calcula a diferença entre o PU evoluído pelo multiplicador no dia do pagamento e o PU original da custódia.


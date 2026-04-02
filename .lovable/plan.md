

## Plano: Alterar Rent. Diária (%) para usar Líquido (2) do dia atual

### O que muda

No arquivo `src/lib/rendaFixaEngine.ts`, na seção que calcula `rentDiariaPct` (linhas ~507-510), trocar o denominador de `prevLiq2` (Líquido 2 do dia anterior) para `liquido2` (Líquido 2 do dia atual).

### Alteração

**Arquivo**: `src/lib/rendaFixaEngine.ts` (linhas 506-513)

De:
```typescript
const prevLiq2 = i > 0 && rows.length > 0 ? rows[rows.length - 1].liquido2 : 0;
if (prevLiq2 > 0.01) {
  rentDiariaPct = ganhoDiario / prevLiq2;
} else {
  rentDiariaPct = prevRentDiariaPct;
}
```

Para:
```typescript
if (liquido2 > 0.01) {
  rentDiariaPct = ganhoDiario / liquido2;
} else {
  rentDiariaPct = prevRentDiariaPct;
}
```

Isso fará com que a coluna "Rent. Diária (%)" divida o ganho diário pelo Líquido (2) do mesmo dia, produzindo o valor 0,04496159% esperado.


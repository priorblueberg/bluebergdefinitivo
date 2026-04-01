

# Fix: Saldo de Cotas (1) não deve subtrair cotas de juros

## Problema

No dia 30/01/2024 (pagamento de juros), o `saldoCotas1` está 168,55 mas deveria ser 169,63.

A causa: `qtdCotasResgate` inclui as cotas correspondentes ao `jurosPago`, e depois `saldoCotas1 = saldoCotas2 - qtdCotasResgate` subtrai essas cotas indevidamente.

```text
saldoCotas2 = 120,04 + 49,58 = 169,63  ✓
qtdCotasResgate = (resgates + jurosPago) / valorCota2 = inclui ~1,08 cotas de juros
saldoCotas1 = 169,63 - 1,08 = 168,55  ✗ (deveria ser 169,63)
```

## Correção — `src/lib/rendaFixaEngine.ts`

**Linha 402-404**: `qtdCotasResgate` deve usar apenas o resgate de capital, não o juros:

```typescript
// ANTES:
const totalOutflow = resgatesTotal + jurosPago;
const qtdCotasResgate = totalOutflow > 0 && valorCota2 > 0 ? totalOutflow / valorCota2 : 0;

// DEPOIS:
const qtdCotasResgate = resgatesTotal > 0 && valorCota2 > 0 ? resgatesTotal / valorCota2 : 0;
```

Juros saem do patrimônio (afetam `liquido1`) mas **não** consomem cotas — são rendimento distribuído, não resgate de capital.

## Impacto

- Títulos "No Vencimento": zero impacto (`jurosPago = 0`, fórmula idêntica)
- Dia final (resgate total): zero impacto (`saldoCotas1 = 0` por definição)
- `liquido2` já é correto: `liquido1 + resgatesTotal + jurosPago` permanece inalterado


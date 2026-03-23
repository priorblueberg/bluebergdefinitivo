

# Corrigir Card de Patrimônio na Análise Individual

## Problema

O card busca o valor de `patrimonioMonths` da tabela de rentabilidade (último mês com dados), que reflete o patrimônio no final do mês — não na `data_calculo` exata. No vencimento, mostra zero quando deveria mostrar `resgateLimpo`.

## Solução

Substituir a lógica do card para buscar diretamente da engine row na `data_calculo`:

### `src/pages/AnaliseIndividualPage.tsx` — linhas ~448-453

Trocar a lógica de `patrimonioDisplayValue`:

```typescript
// Patrimônio: use engine row at data_calculo
let patrimonioDisplayValue: number | null = lastPatrimonio; // fallback

if (isPrefixado && engineRows.length > 0) {
  const targetRow = engineRows.find(r => r.data === dataReferenciaISO) || engineRows[engineRows.length - 1];
  if (targetRow) {
    // On or after vencimento: show resgateLimpo; otherwise: show liquido (1)
    const isOnOrAfterVencimento = product.vencimento && dataReferenciaISO >= product.vencimento;
    patrimonioDisplayValue = isOnOrAfterVencimento ? targetRow.resgateLimpo : targetRow.liquido;
  }
}
```

Isso garante:
- Dias normais → mostra `liquido` (coluna Líquido 1) na data exata do seletor
- Dia do vencimento ou posterior → mostra `resgateLimpo` em vez de zero


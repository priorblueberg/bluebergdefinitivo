

# Remover 4 colunas da tabela Calculadora

## Alteração

Remover as seguintes colunas do componente `src/components/CalculadoraTable.tsx`:

1. **PU Juros Periódicos** — header e célula
2. **QTD Aplicação (2)** — header e célula
3. **QTD Resgate (2)** — header e célula
4. **CDI Diário** — header e célula

Apenas remoção de `<TableHead>` e `<TableCell>` correspondentes. Nenhuma alteração no engine ou em outros componentes.


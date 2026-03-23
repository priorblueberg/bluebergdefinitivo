

# Alteração de regras: QTD Juros e Resgate no Vencimento

## Resumo das mudanças

Duas regras são alteradas:

1. **QTD Juros (engine)**: de `valorInvestido / PU_custodia` para `qtdAplicacao - qtdResgate - qtdJuros_anterior` (acumulativo)
2. **Resgate no Vencimento (movimentações)**: campo "Quantidade" muda de `qtdJurosPU` para `valorInvestido`

## Arquivos alterados

### 1. `src/lib/rendaFixaEngine.ts`

**Linha 63** - Atualizar comentário:
```
qtdJurosPU: number; // Z: QTD Juros = QTD Aplicação - QTD Resgate - QTD Juros anterior
```

**Linhas 407-408** - Substituir cálculo de `qtdJurosPU`:
```typescript
// Z: QTD Juros = QTD Aplicação - QTD Resgate - QTD Juros do dia anterior
const prevQtdJuros = rows.length > 0 ? rows[rows.length - 1].qtdJurosPU : 0;
const qtdJurosPU = qtdAplicacaoPU - qtdResgatePU - prevQtdJuros;
```

**Linha ~474** (makeZeroRow) - manter `qtdJurosPU: 0` (sem mudança necessaria).

### 2. `src/lib/syncEngine.ts`

**Linha ~199** - Alterar campo quantidade do Resgate no Vencimento:
```typescript
// De: const quantidade = lastRow.qtdJurosPU;
const quantidade = lastRow.valorInvestido;
```


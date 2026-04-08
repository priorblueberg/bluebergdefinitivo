

## Plan: Fix Boleta de Aplicação/Resgate para Moedas

### Problem

Two bugs prevent the Dólar application flow from working:

1. **Product reset on tipo change**: When the user selects "Moedas", the product "Dólar" is auto-selected (single product). But when they then select "Aplicação", line 1042 resets `produtoId` to `""` (only Poupança is excluded from the reset). Since the `useEffect` that auto-selects depends on `[categoriaId]`, it won't re-fire.

2. **Circular visibility**: `showDolarFields` requires `isDolar` (needs `produtoId` set), but the product selector is rendered inside the `showDolarFields` block — so it can never appear if `produtoId` is empty.

### Fix — `src/pages/CadastrarTransacaoPage.tsx`

**Change 1 — Don't reset produtoId for Moedas** (line ~1042):
Change `if (!isPoupanca) setProdutoId("")` to `if (!isPoupanca && !isMoedas) setProdutoId("")`. This preserves the auto-selected "Dólar" when switching tipo, same pattern as Poupança.

**Change 2 — Show product selector before `showDolarFields`**:
Add a product selector block for `isMoedas && isAplicacao && !isDolar` (when product isn't selected yet), so the user can manually pick "Dólar" if auto-select didn't fire. This mirrors the Renda Fixa pattern where the product selector is shown independently.

Alternatively (simpler): move the `showDolarFields` condition to not depend on `isDolar` for the product selector portion — show the selector when `isMoedas && isAplicacao`, then gate the remaining fields on `isDolar`.

**Change 3 — Resgate flow for Moedas**: Verify `showResgateFields` works. It's `showTipoMovimentacao && isResgate && !isEditing` — this should work since `showTipoMovimentacao = !!categoriaId && (isRendaFixa || isMoedas)`. The custodia items load via useEffect on `isResgate && categoriaId`. This path looks correct.

### Summary of edits

- **File**: `src/pages/CadastrarTransacaoPage.tsx`
  - Line ~1042: Add `!isMoedas` to the produtoId reset condition
  - Line ~613: Change `showDolarFields` to not require `isDolar` for initial visibility, or restructure the Dólar block to show the product selector unconditionally when `isMoedas && isAplicacao`


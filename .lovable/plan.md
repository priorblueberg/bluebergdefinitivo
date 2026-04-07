

## Plan: Settings Page with FIFO Toggle + Reset Movimentações

### Overview
1. Create a proper `ConfiguracoesPage` replacing the stub
2. Add a FIFO toggle switch persisted in a new `user_settings` table
3. Expose a `useUserSettings` hook for reading the preference
4. Branch the Poupança logic in `PosicaoConsolidadaPage` based on the FIFO setting
5. Move "Resetar Movimentações" (formerly "Limpar Base de Dados") into the settings page
6. Remove/simplify the Admin page accordingly

### Database

**New table: `user_settings`**
```sql
CREATE TABLE public.user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  poupanca_fifo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
-- RLS: users can CRUD their own row
```

Default `poupanca_fifo = true` (FIFO mode on by default — matches bank behavior).

### New Files

**`src/hooks/useUserSettings.ts`**
- Fetches/upserts user settings from `user_settings`
- Exposes `{ poupancaFifo, setPoupancaFifo, loading }`
- On toggle, upserts the row in the database

**`src/pages/ConfiguracoesPage.tsx`**
- Section "Poupança": label "Poupança com resgate no modelo FIFO (First In, First Out)" with a `Switch` component
- Tooltip (using the UI Tooltip component) with the exact text provided
- Section "Dados": "Redefinir Movimentações" — the destructive purge action moved from AdminPage, renamed
- Clean card-based layout matching existing admin page style

### Modified Files

**`src/pages/AppPages.tsx`**
- Replace `Configuracoes` stub with `export { default as Configuracoes } from "./ConfiguracoesPage"`

**`src/pages/PosicaoConsolidadaPage.tsx`**
- Import `useUserSettings`
- Read `poupancaFifo` flag
- When `poupancaFifo === true`: consolidate all lotes into a single engine call, display one row "Poupança" (current FIFO logic from the engine, all lotes together)
- When `poupancaFifo === false`: keep current certificate-per-lote logic (each lote = separate row "Poupança - DD/MM/AAAA")

**`src/pages/AdminPage.tsx`**
- Remove the "Limpar Base de Dados" section (moved to settings)
- Keep any remaining admin-only tools

**`src/components/AppSidebar.tsx`**
- Remove `adminOnly` from Configurações so all users can access it


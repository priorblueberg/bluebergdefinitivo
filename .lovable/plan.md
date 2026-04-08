

## Plan: Refactor IPCA Calculation to Anniversary-Cycle Methodology

### Problem

The current IPCA implementation distributes the monthly IPCA factor across calendar-month business days. The correct methodology (used by Gorila) distributes the IPCA factor across **anniversary cycles** derived from the asset's maturity date. Additionally, `data_publicacao` is NULL for all `historico_ipca` records, preventing look-ahead bias control.

**Divergence example**: Application on 02/01/2024, maturity 30/12/2025, IPCA + 7.25%
- Gorila on 03/01/2024: R$ 100,048.19
- Blueberg on 03/01/2024: R$ 100,056.36

### Root Causes

1. **Calendar-month diarization** (lines 240-273 of `rendaFixaEngine.ts`): groups IPCA by `YYYY-MM` of the calc date, not by anniversary cycle
2. **No look-ahead bias protection**: `data_publicacao` is NULL everywhere; the helper blindly prefers official data even in historical reprocessing
3. **Wrong cycle boundaries**: IPCA for a date should come from the cycle `lastAnniversary → nextAnniversary`, where anniversary day = maturity day-of-month

### Architecture of Changes

```text
┌─────────────────────────┐
│   ipcaHelper.ts         │  ← new anniversary helpers + enriched fetch
│  - getAnniversaryDay()  │
│  - getAnniversaryBounds()│
│  - buildIpcaCycleMap()  │  ← pre-computes daily factors per cycle
└──────────┬──────────────┘
           │
┌──────────▼──────────────┐
│  rendaFixaEngine.ts     │  ← replace calendar-month block (lines 240-273)
│  - use cycle-based map  │     with cycle-based ipcaDailyFactorMap
└──────────┬──────────────┘
           │
┌──────────▼──────────────┐
│  syncEngine.ts          │  ← pass vencimento to IPCA fetch; pass
│  - fetchIpcaIfNeeded()  │     data_publicacao for bias control
└─────────────────────────┘
```

---

### Step 1 — Populate `data_publicacao` in `historico_ipca`

**Migration**: Update existing rows and the Edge Function.

The IBGE publishes IPCA around the 10th of the following month. Rule: `data_publicacao = competencia + 1 month + 10 days` (approximation). For example, IPCA of January 2024 (competencia 2024-01-01) → published ~2024-02-10.

- **SQL migration**: `UPDATE historico_ipca SET data_publicacao = (competencia + INTERVAL '1 month' + INTERVAL '10 days')::date WHERE data_publicacao IS NULL;`
- **Edge Function** (`daily-market-sync`): set `data_publicacao` on insert using the same formula.

### Step 2 — Refactor `src/lib/ipcaHelper.ts`

Expand the `IpcaRecord` interface to include `data_publicacao`. Add new pure functions:

**`getAnniversaryDay(vencimento: string): number`**
- Returns the day-of-month from the maturity date (e.g., 30 for 2025-12-30).

**`getAnniversaryBounds(calcDate: string, anniversaryDay: number): { lastAnniversary: string; nextAnniversary: string; competencia: string }`**
- Computes the last and next anniversary dates around `calcDate`.
- `competencia` = the month whose IPCA applies to this cycle (typically the month of `lastAnniversary`).
- Handles months where the day doesn't exist (e.g., Feb 30 → Feb 28/29).

**`selectIpcaFactor(competencia: string, calcDate: string, records: IpcaRecordFull[]): number`**
- If official record exists AND `data_publicacao <= calcDate` → use `fator_mensal`.
- Otherwise, look for projection → use `fator_projetado`.
- Fallback: 1.0 (no correction).

**`buildIpcaCycleDailyFactorMap(dataInicio: string, dataCalculo: string, vencimento: string, calendario: CalEntry[], ipcaRecords: IpcaRecordFull[]): Map<string, number>`**
- For each business day in range, compute anniversary bounds → select IPCA factor → count business days in cycle → `POWER(factor, 1/bizDaysInCycle)`.
- Returns `Map<date_string, daily_ipca_factor>`.

Update `fetchIpcaRecords` to also fetch `data_publicacao` from `historico_ipca`.

### Step 3 — Refactor `src/lib/rendaFixaEngine.ts`

**Replace lines 240-273** (the calendar-month IPCA block) with a call to `buildIpcaCycleDailyFactorMap(dataInicio, dataCalculo, vencimento, calendario, ipcaRecords)`.

The `EngineInput` interface gets a small addition:
- `ipcaRecords` type changes to include `data_publicacao?: string | null`.

The rest of the engine (lines 344-351 using `ipcaDailyFactorMap`) stays the same — it already reads from the map. Only the map-building logic changes.

No changes to Prefixado, CDI, or CDI+ paths.

### Step 4 — Adjust `src/lib/syncEngine.ts`

- `fetchIpcaIfNeeded()`: include `data_publicacao` in the select query.
- Pass `vencimento` through to the engine (already done — `vencimento` is passed in `EngineInput`).
- No other sync logic changes needed.

### Step 5 — Update all callers of `fetchIpcaRecords`

Pages that call `fetchIpcaRecords` or `fetchIpcaRecordsBatch` need to receive the enriched records (with `data_publicacao`). These are:
- `CalculadoraPage.tsx`
- `CarteiraRendaFixaPage.tsx`
- `PosicaoConsolidadaPage.tsx`
- `AnaliseIndividualPage.tsx`
- `ProventosRecebidosPage.tsx`

The change is minimal: the fetch functions return the richer type; the engine consumes it transparently.

### Step 6 — Update Edge Function

In `daily-market-sync/index.ts`, add `data_publicacao` to the IPCA upsert record using the formula `competencia + 1 month + 10 days`.

### Step 7 — Code documentation

Add JSDoc comments in `ipcaHelper.ts` and `rendaFixaEngine.ts` explaining:
- "IPCA by anniversary cycle, NOT by calendar month"
- The look-ahead bias rule
- The cycle boundary logic

### Files Modified

| File | Change |
|------|--------|
| `supabase/migrations/new.sql` | Populate `data_publicacao` for existing rows |
| `src/lib/ipcaHelper.ts` | New anniversary helpers + enriched fetch |
| `src/lib/rendaFixaEngine.ts` | Replace calendar-month IPCA block with cycle-based map |
| `src/lib/syncEngine.ts` | Enrich `fetchIpcaIfNeeded` with `data_publicacao` |
| `supabase/functions/daily-market-sync/index.ts` | Add `data_publicacao` on IPCA insert |
| Pages (5 files) | Transparent — type flows through |

### What Does NOT Change

- Prefixado, CDI, CDI+, Mista logic
- `DailyRow` interface (no new fields)
- UI components
- Poupança, Câmbio engines
- `modalidade` modeling


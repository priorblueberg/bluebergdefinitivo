
## Fix: Date input resets day/month when typing year in BoletaCustodiaDialog

### Problem
When the user types the date in the native `<input type="date">`, the `onChange` fires on every keystroke. While the year is being typed (e.g., "202" — incomplete), the regex `^\d{4}-\d{2}-\d{2}$` fails, causing the `else` branch to execute: `setDate(undefined)`, which resets the controlled `value` to `""`, wiping out the day and month already entered.

### Solution
Stop resetting state on intermediate/incomplete values. Only act when the value is a complete valid date OR when the field is fully cleared.

### Changes — `src/components/BoletaCustodiaDialog.tsx`

Update the `onChange` handler (lines 364-377):

```typescript
onChange={(e) => {
  const val = e.target.value;
  // Field fully cleared — reset state
  if (!val) {
    setDate(undefined);
    setDateError(null);
    setSaldoDisponivel(null);
    setValorCotaDia(null);
    setFecharPosicao(false);
    setValor("");
    return;
  }
  // Only process when we have a complete, valid date
  if (/^\d{4}-\d{2}-\d{2}$/.test(val) && parseInt(val.slice(0, 4), 10) >= 1900) {
    const d = new Date(val + "T00:00:00");
    handleDateSelect(d);
  }
  // Otherwise: do nothing — let the browser handle partial input natively
}}
```

The key difference: remove the `else` branch that was clearing all state on every incomplete keystroke. Now partial input (e.g., typing "202" for the year) is simply ignored, preserving the day and month the user already entered.

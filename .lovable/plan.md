

# Plano: Recalculation reativa via Supabase Realtime + correção do card Patrimônio

## Problemas Identificados

### 1. Card Patrimônio mostra valor errado
O card "Patrimônio" na Análise Individual usa `patrimonioMonthly` que pega o ÚLTIMO mês processado pelo engine (Dezembro 2025), ignorando a data de referência do seletor. Quando o usuário seleciona 06/10/2025, deveria mostrar o patrimônio de outubro, mas mostra o de dezembro.

A causa raiz é que o engine roda até `product.data_calculo` (2025-12-30), e o card pega o último valor não-nulo de `detailRows[0].patrimonioMonths` — que é dezembro.

### 2. Recalculation não é reativa a mudanças externas
O sistema atual depende de chamadas manuais a `applyDataReferencia()` espalhadas em cada ponto de mutação. Qualquer alteração feita fora dessas telas (ou uma nova tela futura) não dispara recálculo.

## Solução

### Parte 1 — Supabase Realtime no `movimentacoes`

Habilitar Realtime na tabela `movimentacoes` e criar um listener global em `AppLayout` que dispara `recalculateAllForDataReferencia` + `applyDataReferencia` automaticamente a cada INSERT/UPDATE/DELETE.

**Etapas:**

1. **Migration SQL**: `ALTER PUBLICATION supabase_realtime ADD TABLE public.movimentacoes;`

2. **`src/components/AppLayout.tsx`**: Adicionar `useEffect` com `supabase.channel('movimentacoes-sync')` que escuta `postgres_changes` (event: `*`, table: `movimentacoes`). Ao receber qualquer evento, executa `recalculateAllForDataReferencia(user.id, dataReferenciaISO)` seguido de `applyDataReferencia()`, com debounce de ~500ms para evitar cascata.

### Parte 2 — Correção do card Patrimônio

**`src/pages/AnaliseIndividualPage.tsx`**:

O card de Patrimônio deve usar o valor do engine na data exata do seletor, não a última do período.

- Buscar na lista `engineRows` a linha cuja `data === dataReferenciaISO` (ou a mais recente <= `dataReferenciaISO`)
- Usar `row.liquido` dessa linha como patrimônio
- Usar `row.ganhoAcumulado` dessa linha como ganho financeiro (já corrigido anteriormente)

Trecho do card (linhas ~430-448):
```typescript
// Buscar patrimônio e ganho na data de referência exata
const refRow = engineRows.length > 0
  ? engineRows.filter(r => r.data <= dataReferenciaISO).pop()
  : null;
const lastPatrimonio = refRow ? refRow.liquido : null;
const ganho = refRow ? parseFloat(refRow.ganhoAcumulado.toFixed(2)) : null;
```

### Parte 3 — Manter chamadas existentes (compatibilidade)

As chamadas manuais `fullSyncAfterMovimentacao` + `applyDataReferencia` nos componentes existentes permanecem para garantir feedback imediato. O Realtime serve como rede de segurança para capturar qualquer alteração não coberta.

## Detalhes Técnicos

### Migration
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.movimentacoes;
```

### Listener Realtime (AppLayout)
```typescript
useEffect(() => {
  if (!user) return;
  let timeout: ReturnType<typeof setTimeout>;
  const channel = supabase
    .channel('movimentacoes-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'movimentacoes' }, () => {
      clearTimeout(timeout);
      timeout = setTimeout(async () => {
        setIsRecalculating(true);
        try {
          await recalculateAllForDataReferencia(user.id, format(dataReferencia, "yyyy-MM-dd"));
          applyDataReferencia();
        } finally {
          setIsRecalculating(false);
        }
      }, 500);
    })
    .subscribe();
  return () => { clearTimeout(timeout); supabase.removeChannel(channel); };
}, [user, dataReferencia]);
```

### Arquivos modificados
- `src/components/AppLayout.tsx` — listener Realtime
- `src/pages/AnaliseIndividualPage.tsx` — card Patrimônio/Ganho usa `engineRows` filtrado por `dataReferenciaISO`
- Migration SQL para habilitar Realtime




## Correção: Aniversário da Poupança independe de dia útil

### Problema
O motor atual diferencia dias úteis e não úteis para creditar o rendimento no aniversário. Na prática, a poupança credita rendimento no dia do aniversário independentemente de ser dia útil ou não.

### Alteração (1 arquivo)

**`src/lib/poupancaEngine.ts`** (linhas 180-203)
- Remover toda a lógica de "pending" (aniversário diferido para próximo dia útil)
- Simplificar: se `isAniversario(date, lote.diaAniversario)` for true, creditar o rendimento imediatamente, sem verificar `diaUtil`
- Remover o bloco `else if (diaUtil && pending.size > 0)` e a estrutura `pendingAniversario` (linhas 145-149), pois não serão mais necessários
- Remover o `diaUtilSet` (linhas 139-143), também não mais utilizado


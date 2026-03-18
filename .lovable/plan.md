

## Plano: Registro Automatico de "Resgate no Vencimento"

A condição `hoje()` usará a **data real atual** (`new Date()`), não a data do seletor de referência.

### 1. Migração: coluna `origem` em `movimentacoes`
```sql
ALTER TABLE public.movimentacoes ADD COLUMN origem text DEFAULT 'manual';
```

### 2. `src/lib/syncEngine.ts` — nova função `syncResgateNoVencimento`

Chamada ao final de `syncCustodiaFromMovimentacao` e `recalculateAllForDataReferencia`, após o upsert da custodia.

Lógica:
1. Recebe dados da custodia (vencimento, resgate_total, codigo_custodia, userId, campos do titulo)
2. `const hoje = new Date().toISOString().slice(0, 10)` — data real
3. **Se** `resgate_total === vencimento` **E** `vencimento < hoje`:
   - Busca movimentacao existente com `tipo_movimentacao = 'Resgate no Vencimento'` e `origem = 'automatico'` para esse `codigo_custodia`
   - Se não existe: executa `calcularRendaFixaDiario` até a data do vencimento para obter Cota 2 e Liquido 1 do ultimo dia. Insere movimentacao com tipo "Resgate no Vencimento", `origem: 'automatico'`, valor = Liquido 1, preco_unitario = Cota 2, quantidade = valor / cota2
4. **Se** condição falsa: deleta movimentacoes com `tipo_movimentacao = 'Resgate no Vencimento'` e `origem = 'automatico'` para esse `codigo_custodia`

### 3. `src/lib/rendaFixaEngine.ts` — reconhecer novo tipo
Adicionar "Resgate no Vencimento" ao mapeamento de resgates em `buildMovMap`.

### 4. `syncCustodiaFromMovimentacao` — incluir no calculo de `valorInvestidoLiquido`
Subtrair "Resgate no Vencimento" como resgate.

### 5. Inputs manuais — salvar `origem: 'manual'`
- `src/components/BoletaCustodiaDialog.tsx`
- `src/pages/CadastrarTransacaoPage.tsx`

### 6. `src/pages/MovimentacoesPage.tsx` — indicativo visual
Badge "(Auto)" ao lado do tipo quando `origem === 'automatico'`. Impedir edição/exclusão de registros automáticos.

### Arquivos afetados
- Migração SQL (coluna `origem`)
- `src/lib/syncEngine.ts`
- `src/lib/rendaFixaEngine.ts`
- `src/components/BoletaCustodiaDialog.tsx`
- `src/pages/CadastrarTransacaoPage.tsx`
- `src/pages/MovimentacoesPage.tsx`


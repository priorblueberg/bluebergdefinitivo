

# Reprocessar: Excluir e recadastrar todos os ativos em ordem cronológica

## O que muda

O botão "Reprocessar" no header passará a executar um processo destrutivo-reconstrutivo:

1. **Excluir toda a custódia** do usuário
2. **Excluir todas as movimentações automáticas** (origem = 'automatico')
3. **Buscar todas as movimentações manuais** ordenadas por data (mais antiga primeiro)
4. **Para cada movimentação**, executar `syncCustodiaFromMovimentacao` — que recria o registro de custódia, sincroniza "Resgate no Vencimento" automático, e recalcula "Resgate Total" manual
5. **Recalcular controle de carteiras** ao final

## Arquivo alterado

**`src/lib/syncEngine.ts`** — reescrever `recalculateAllForDataReferencia`:

```
async function recalculateAllForDataReferencia(userId, dataReferencia):
  1. DELETE FROM custodia WHERE user_id = userId
  2. DELETE FROM controle_de_carteiras WHERE user_id = userId
  3. DELETE FROM movimentacoes WHERE user_id = userId AND origem = 'automatico'
  4. SELECT * FROM movimentacoes WHERE user_id = userId ORDER BY data ASC, created_at ASC
  5. Para cada movimentação:
     - await syncCustodiaFromMovimentacao(mov.id, dataReferencia)
  6. Buscar categorias distintas das movimentações
  7. Para cada categoria: syncControleCarteiras(categoriaId, userId, dataReferencia)
  8. syncCarteiraGeral(userId, dataReferencia)
```

Nenhum outro arquivo precisa ser alterado — o botão no header já chama esta função.


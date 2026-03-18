

## Plano: Botoes de Aplicacao e Resgate na Custodia

### O que sera feito

Adicionar uma coluna "Acoes" na tabela de custodia com dois botoes por registro: **Aplicacao** e **Resgate**. Cada botao abre um Dialog (modal) com os dados do titulo preenchidos automaticamente (somente leitura). O usuario preenche apenas **data** e **valor**, e o sistema registra a movimentacao com o tipo correspondente.

### Alteracoes em `src/pages/CustodiaPage.tsx`

1. **Coluna "Acoes"** -- adicionar como primeira ou ultima coluna da tabela, com dois botoes pequenos (variant outline/ghost) por linha.

2. **Dialog de Boleta de Custodia** -- um unico componente Dialog reutilizado para ambos os tipos:
   - Titulo: "Aplicacao Adicional - [nome do titulo]" ou "Resgate - [nome do titulo]"
   - Campos somente leitura: Nome, Categoria, Produto, Instituicao, Emissor, Modalidade, Indexador, Taxa, Pagamento, Vencimento
   - Campos editaveis: **Data** (datepicker, inicia vazio) e **Valor** (input monetario)
   - Para Resgate: calcular saldo disponivel (reutilizar logica `calcSaldoPrefixado` de `CadastrarTransacaoPage`) e validar que valor <= saldo

3. **Submissao** -- ao confirmar:
   - Validar que data eh dia util (consulta `calendario_dias_uteis`)
   - Inserir em `movimentacoes` com `tipo_movimentacao` = "Aplicacao" ou "Resgate", `codigo_custodia` do registro, e todos os campos do titulo
   - Para Aplicacao: calcular `quantidade = valor / preco_unitario`, gerar `valor_extrato` no formato `R$ valor (PU x Qtd)`
   - Para Resgate: `quantidade = null`, `preco_unitario = null`, `valor_extrato = R$ valor`
   - Chamar `fullSyncAfterMovimentacao` apos inserir
   - Recarregar dados da custodia

4. **Imports adicionais**: Dialog, Button, Popover, Calendar, Input, formatadores, `fullSyncAfterMovimentacao`, `calcSaldoPrefixado` (extrair de CadastrarTransacaoPage ou importar), `useAuth`

### Detalhe tecnico sobre `calcSaldoPrefixado`

A funcao `calcSaldoPrefixado` esta definida localmente em `CadastrarTransacaoPage.tsx`. Sera necessario extraí-la para um arquivo compartilhado (ex: `src/lib/saldoCalculations.ts`) para reutiliza-la na CustodiaPage.

### Arquivos afetados
- `src/pages/CustodiaPage.tsx` -- adicionar dialog, botoes, logica de submissao
- `src/lib/saldoCalculations.ts` -- novo arquivo com `calcSaldoPrefixado` extraida
- `src/pages/CadastrarTransacaoPage.tsx` -- importar `calcSaldoPrefixado` do novo arquivo em vez de definir localmente


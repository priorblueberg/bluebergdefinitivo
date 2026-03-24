

# Plano de Alterações — 6 Itens

## 1. Movimentações: Incluir "Pagamento de Juros" + Filtros

### 1.1 Incluir movimentações de Pagamento de Juros
A query já traz todas as movimentações. O problema é que movimentações automáticas de juros podem ter tipo diferente. Verificar se o engine gera registros na tabela `movimentacoes` com tipo "Pagamento de Juros". Se sim, já aparecem. Caso o tipo esteja diferente, ajustar.

Para as linhas de "Pagamento de Juros": mostrar `—` nos campos Quantidade e Preço Unitário.

**`src/pages/MovimentacoesPage.tsx`**:
- Na renderização das colunas Quantidade e Preço Unitário, adicionar condição: se `tipo_movimentacao === "Pagamento de Juros"`, exibir `"—"`.

### 1.2 Filtros por Nome do Ativo e Tipo de Movimentação
- Adicionar dois estados: `filterNome` e `filterTipo`.
- Extrair valores únicos de `rows` para popular os selects.
- Aplicar filtros antes da ordenação.
- Renderizar dois `<select>` nativos ou componentes Select acima da tabela.

## 2. Proventos: Alterar tipo "Rendimentos" → "Pagamento de Juros"

**`src/pages/ProventosRecebidosPage.tsx`** — linha 116:
- Trocar `tipo: "Rendimentos"` por `tipo: "Pagamento de Juros"`.

## 3. Seletor/Calendário: Limitar data máxima a D-1

**`src/components/AppHeader.tsx`**:
- Na função `applyDate`, validar que a data não é maior que `subDays(new Date(), 1)`. Se for, ignorar ou clampar.
- Na função `commitInput`, mesma validação.
- No componente `<Calendar>`, adicionar prop `disabled` para datas >= hoje: `disabled={{ after: subDays(new Date(), 1) }}`.
- Nos botões de navegação (próximo dia), impedir avanço além de D-1.

## 4. Análise Individual: Período de Análise com data_calculo

**`src/pages/AnaliseIndividualPage.tsx`** — linha 414:
- Trocar `fmtDate(dataReferenciaISO)` por `fmtDate(effectiveEndDate)`.
- Definir `effectiveEndDate`: se `dataReferenciaISO >= product.vencimento`, usar `product.vencimento`; senão usar `dataReferenciaISO`. Considerar também `resgate_total`.
- Mesma lógica: `effectiveEndDate = min(dataReferenciaISO, product.resgate_total || product.vencimento || dataReferenciaISO)`.

## 5. Análise Individual: Corrigir leitura do Líquido (1)

O problema raiz: a engine é executada com `endDate = dataReferenciaISO` (linha 256). Se o seletor está em 04/11/2025 e o vencimento é 30/12/2025, a engine calcula até 04/11 corretamente. Mas o card busca `engineRows.find(r => r.data === dataReferenciaISO)` — se não encontrar (ex: dia não útil), pega a última row.

A lógica atual parece correta. Possível causa: a engine não gera row para o dia exato se não é dia útil. O fallback `engineRows[engineRows.length - 1]` pega o último dia calculado, que deveria ser próximo.

Investigação adicional necessária: verificar se o `endDate = dataReferenciaISO` na engine realmente produz a row para essa data. Se a engine só produz rows até `data_calculo` da custódia e `data_calculo` é diferente de `dataReferenciaISO`, isso explicaria o bug.

**Correção**: Na engine call (linha 256), usar `dataReferenciaISO` como endDate (já é). Para o card, garantir que busca a row correta:
- Buscar `engineRows.find(r => r.data <= dataReferenciaISO)` do final para trás (última row com data <= seletor).

**Tabela e gráfico de barras**: O `buildDetailRowsFromEngine` já usa `row.liquido` para `patrimonioMonthly`. Para meses anteriores ao mês corrente, pega o último dia do mês (correto). Para o mês corrente (mês do seletor), pega o último registro do mês que é a data do seletor (correto).

**Correção do card**: Substituir `engineRows.find(r => r.data === dataReferenciaISO) || engineRows[engineRows.length - 1]` por busca reversa da última row com `data <= dataReferenciaISO`.

## 6. Header: Botão "Cadastrar Transação" + Remover do sidebar

**`src/components/AppHeader.tsx`**:
- Adicionar botão/link "Cadastrar Transação" antes do "Posição em:" com ícone `Plus`, navegando para `/cadastrar-transacao`.

**`src/components/AppSidebar.tsx`**:
- Remover o item `{ title: "Cadastrar Transação", url: "/cadastrar-transacao", icon: Plus }` do array `menuItems`.

---

### Resumo dos arquivos alterados
1. `src/pages/MovimentacoesPage.tsx` — filtros + "—" para Pagamento de Juros
2. `src/pages/ProventosRecebidosPage.tsx` — tipo "Pagamento de Juros"
3. `src/components/AppHeader.tsx` — limite D-1 + botão Cadastrar Transação
4. `src/pages/AnaliseIndividualPage.tsx` — período de análise + card patrimônio
5. `src/components/AppSidebar.tsx` — remover Cadastrar Transação


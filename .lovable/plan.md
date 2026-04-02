

## Diagnóstico de Performance

### Problema identificado

Os cálculos são feitos inteiramente no **client-side** (browser). Para cada produto de Renda Fixa, o sistema:

1. **Faz uma query individual ao banco** para buscar movimentações (N+1 queries — se há 10 produtos, são 10 chamadas separadas)
2. **Copia e ordena o calendário inteiro** (`[...calendario].sort()`) dentro de cada chamada a `calcularRendaFixaDiario` — mesmo que o array já venha ordenado do banco
3. **Reconstrói estruturas auxiliares** (Sets de dias úteis, Maps de CDI) em cada execução do engine, repetindo trabalho idêntico para cada produto
4. **Passa o calendário completo** (até maxEndDate) para cada produto, mesmo que muitos produtos tenham datas de início/fim muito mais restritas

### Plano de Otimização (sem alterar regras de cálculo)

#### 1. Buscar todas as movimentações em uma única query
**Arquivo**: `src/pages/CarteiraRendaFixaPage.tsx`, `src/pages/CalculadoraPage.tsx`

Em vez de fazer N queries (uma por `codigo_custodia`), buscar todas as movimentações de uma vez com um filtro `in` nos códigos de custódia, e depois agrupar no client por `codigo_custodia`.

```typescript
// ANTES: N queries
const productRowsPromises = rfProducts.map(async (product) => {
  const { data: movData } = await supabase
    .from("movimentacoes")
    .select("data, tipo_movimentacao, valor")
    .eq("codigo_custodia", product.codigo_custodia)
    ...
});

// DEPOIS: 1 query
const allCodigos = rfProducts.map(p => p.codigo_custodia);
const { data: allMovData } = await supabase
  .from("movimentacoes")
  .select("data, tipo_movimentacao, valor, codigo_custodia")
  .in("codigo_custodia", allCodigos)
  .eq("user_id", user.id)
  .order("data");
const movByCodigo = new Map<number, any[]>();
// agrupar por codigo_custodia
```

#### 2. Evitar re-sort do calendário no engine
**Arquivo**: `src/lib/rendaFixaEngine.ts`

O calendário já vem ordenado da query (`order("data")`). Remover a cópia+sort redundante:

```typescript
// ANTES
const sorted = [...calendario].sort((a, b) => a.data.localeCompare(b.data));

// DEPOIS
const sorted = calendario; // já ordenado
```

#### 3. Pré-computar estruturas compartilhadas (calendário, CDI)
**Arquivo**: `src/pages/CarteiraRendaFixaPage.tsx`, `src/pages/CalculadoraPage.tsx`

Criar os Maps de CDI e Sets de dias úteis **uma vez** antes do loop de produtos, e passá-los como parâmetros opcionais ao engine (sem alterar a interface obrigatória — apenas adicionar campos opcionais ao `EngineInput`).

**Arquivo**: `src/lib/rendaFixaEngine.ts`

Aceitar `cdiMap?: Map<string, number>` e `calendarSorted?: boolean` como campos opcionais no `EngineInput`. Se já fornecidos, pular a construção interna.

#### 4. Aplicar as mesmas otimizações nas outras páginas
**Arquivos**: `src/pages/AnaliseIndividualPage.tsx`, `src/pages/ProventosRecebidosPage.tsx`

Mesma lógica — buscar movimentações em batch e evitar re-sort do calendário.

### Impacto esperado
- **Redução de queries**: de N+3 para 4 (carteira + custódia + calendário + CDI + 1 movimentações)
- **Redução de CPU no browser**: eliminar N cópias+sorts de arrays grandes de calendário
- **Sem alteração nas regras de cálculo**: apenas otimização de I/O e estruturas de dados




# Reorganizar colunas da página /movimentações

## Alterações

**Arquivo: `src/pages/MovimentacoesPage.tsx`**

### 1. Interface `Movimentacao`
- Remover campos `vencimento` e `categoria`
- Adicionar `quantidade: number | null`, `preco_unitario: number | null`
- Substituir `valor_extrato: string | null` por `valor: number | null`

### 2. Query Supabase
- Remover `vencimento` do select e remover join `categorias(nome)`
- Adicionar `quantidade, preco_unitario, valor` ao select
- Remover `valor_extrato` do select

### 3. Mapeamento no `.map()`
- Remover `categoria` e `vencimento`
- Adicionar `quantidade`, `preco_unitario`, `valor`

### 4. COLUMNS — nova ordem
```
Data, Nome do Ativo, Tipo Mov., Instituição, Pagamento, Quantidade, Preço Unitário, Valor
```

### 5. Células do `<tbody>`
- Remover `<td>` de Categoria e Vencimento
- Adicionar `<td>` para Quantidade (2 casas decimais), Preço Unitário (moeda BRL), Valor (moeda BRL)
- Reordenar conforme a ordem final

### 6. Formatação
- Quantidade: `toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })`
- Preço Unitário e Valor: `toLocaleString("pt-BR", { style: "currency", currency: "BRL" })`




## Melhorias na Carteira de Renda Fixa

### Resumo
Sete alterações na página `/carteira/renda-fixa` e componentes relacionados: ícone verde de status, subtítulo na Posição Consolidada, colunas fixas nas tabelas de rentabilidade, header com status da carteira vindo de `controle_de_carteiras`, menu horizontal só com "Renda Fixa", série Ibovespa + toggles no gráfico de rentabilidade, e 3 gráficos de alocação (Estratégia, Custodiante, Emissor).

---

### 1. Ícone de status verde + subtítulo na Posição Consolidada

**Arquivo:** `src/pages/CarteiraRendaFixaPage.tsx`

- Trocar `text-muted-foreground` do `CircleCheck` por `text-green-500` (ativo fica verde, encerrado mantém cor neutra).
- Adicionar abaixo do `<h2>Posição Consolidada</h2>` um `<p>` com texto "Clique no título para visualizar o Dashboard".

### 2. Colunas com largura padronizada nas tabelas de rentabilidade

**Arquivo:** `src/components/RentabilidadeDetailTable.tsx`

- Aplicar `className="w-[90px]"` (ou similar) nos `<TableHead>` dos meses e `w-[100px]` em "No Ano", garantindo largura fixa independente do conteúdo.
- Aplicar o mesmo `min-w` nos `<TableCell>` correspondentes.
- Adicionar `table-fixed` no `<Table>` para forçar layout fixo.

### 3. Header com período de análise e tag de status da carteira

**Arquivo:** `src/pages/CarteiraRendaFixaPage.tsx`

- Os dados de `controle_de_carteiras` já são consultados (linha 86-91). Usar `carteiraInfo.status` para exibir uma tag/badge colorida ("Ativa" em verde, "Encerrada" em vermelho, "Não Iniciada" em cinza) ao lado do título "Renda Fixa".
- Exibir "Período de Análise: De [data_inicio] a [data_calculo]" como já feito, mas agora com a tag de status visível ao lado.

### 4. Menu horizontal apenas "Renda Fixa"

**Arquivo:** `src/components/SubTabs.tsx`

- Reduzir o array `tabs` para conter somente `{ label: "Renda Fixa", url: "/carteira/renda-fixa" }`.
- Manter a estrutura do componente para futuro MVP2.

**Arquivo:** `src/App.tsx`

- Redirecionar `/carteira` para `/carteira/renda-fixa` (usar `<Navigate to="/carteira/renda-fixa" replace />` no lugar de `CarteiraVisaoGeral`).
- Manter as rotas de renda-variavel/fundos/tesouro-direto no código mas inacessíveis pelo menu.

### 5. Série Ibovespa + toggles no gráfico de rentabilidade

**Arquivo:** `src/pages/CarteiraRendaFixaPage.tsx`

- Buscar dados de `historico_ibovespa` no `useEffect` principal (já existe a tabela), no mesmo intervalo `[data_inicio, data_calculo]`.
- Calcular série acumulada do Ibovespa: `(pontos[i] / pontos[0] - 1) * 100`.
- Adicionar ao `chartData` o campo `ibovespa_acumulado`.
- Adicionar estado `seriesVisibility` com `{ cdi: true, ibovespa: false }` (CDI ativo por padrão, Ibovespa desligado).
- Renderizar toggles (botões/switches) acima do gráfico para CDI e Ibovespa.
- A série "Carteira RF" (titulo_acumulado) fica sempre visível, sem toggle.
- Renderizar condicionalmente as `<Line>` de CDI e Ibovespa com base no estado.

### 6. Três gráficos de alocação (PieChart/AreaChart)

**Arquivo:** `src/pages/CarteiraRendaFixaPage.tsx`

- Posicionar entre a tabela de rentabilidade (`RentabilidadeDetailTable`) e a seção "Posição Consolidada".
- Usar dados de `productList` (que já tem `valorAtualizado` por produto) e enriquecer a query de `custodia` para incluir os campos `estrategia` e `emissor_id` + `emissores(nome)`.
- Calcular alocação percentual por:
  1. **Estratégia**: agrupar `valorAtualizado` pelo campo `custodia.estrategia`.
  2. **Custodiante**: agrupar pelo `instituicao_nome` (já disponível).
  3. **Emissor**: agrupar pelo `emissor_nome` (incluir na query via join `emissores(nome)`).
- Renderizar 3 gráficos de área/pizza lado a lado (`grid grid-cols-1 md:grid-cols-3 gap-4`) usando `PieChart` do Recharts com `Cell` coloridos.
- Cada gráfico terá título: "Alocação por Estratégia", "Alocação por Custodiante", "Alocação por Emissor".

### 7. Dados extras na query de custódia

**Arquivo:** `src/pages/CarteiraRendaFixaPage.tsx`

- Expandir o `.select()` da query de `custodia` para incluir `estrategia, emissor_id, emissores(nome)`.
- Mapear `emissor_nome` e `estrategia` no `CustodiaProduct`.

---

### Detalhes Técnicos

- O `historico_ibovespa` tem colunas `data` e `pontos`; RLS permite leitura pública.
- A tabela `custodia` já tem coluna `estrategia` (text, nullable).
- Recharts `PieChart` + `Pie` + `Cell` para os gráficos de alocação, com cores distintas por fatia.
- Paleta de cores para os gráficos: array de 8-10 cores HSL harmônicas.
- `table-fixed` + `min-w-[Xpx]` resolve o problema de colunas variáveis nas tabelas de rentabilidade.


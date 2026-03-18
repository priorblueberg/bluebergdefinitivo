

## Plano: Migrar Análise Individual para usar rendaFixaEngine

### Contexto
A página `AnaliseIndividualPage.tsx` usa funções antigas de `cdiCalculations.ts` (`buildPrefixadoSeries`, `buildPrefixadoRentabilidadeRows`, `calcFatorDiarioPre`) que calculam rentabilidade de forma simplificada (sem cotas virtuais, sem movimentações). O novo motor `rendaFixaEngine.ts` calcula com base em cotas virtuais, considerando aplicações, resgates e PU inicial.

### Alterações

**1. `CustodiaProduct` — adicionar `preco_unitario`**
- Incluir `preco_unitario: number | null` na interface
- Buscar `preco_unitario` na query Supabase (linha 560)
- Mapear no objeto (linha 563-579)

**2. `ProductDetail` — buscar movimentações e usar rendaFixaEngine**
- Importar `calcularRendaFixaDiario` e `DailyRow` de `rendaFixaEngine`
- Buscar `movimentacoes` (filtrado por `codigo_custodia`) junto com CDI e calendário
- Para produtos Prefixados, chamar `calcularRendaFixaDiario` com os dados do produto
- Derivar os dados de gráfico e tabela a partir dos `DailyRow[]` retornados pela engine

**3. Derivar dados de gráfico (chartData) da engine**
- Calcular `titulo_acumulado` acumulando a rentabilidade diária da engine (produto dos `(1 + rentDiaria)`)
- Manter a série CDI como está (via `buildCdiSeries`)

**4. Derivar detailRows da engine**
- Agrupar os `DailyRow[]` por mês/ano para gerar:
  - **Patrimônio** mensal: último `liquido` do mês
  - **Ganho Financeiro** mensal: diferença de patrimônio
  - **Rentabilidade** mensal: produto dos fatores diários `(1 + rentDiaria)` no mês
  - **CDI** mensal: mantém cálculo existente via `cdiRecords`
- Montar os `DetailRow[]` com `rentNoAno`, `rentAcumulado`, etc.

**5. Remover dependências antigas**
- Remover imports de `buildPrefixadoSeries`, `buildPrefixadoRentabilidadeRows` e `calcFatorDiarioPre`
- Manter `buildCdiSeries` e `buildRentabilidadeRows` (usados para a série CDI)
- Remover a função local `buildDetailRows` (substituída pela lógica baseada na engine)

### Escopo limitado
- Apenas produtos **Renda Fixa Prefixada** usarão a nova engine
- Produtos não-prefixados continuam com o cálculo CDI existente (sem alteração)


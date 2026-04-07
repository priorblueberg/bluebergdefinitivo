

## Diagnóstico: Poupança (código 106) sem rentabilidade

### Dados verificados no banco
- **Custódia**: codigo_custodia=106, data_inicio=2024-03-04, valor_investido=100000, modalidade="Poupança"
- **Lote**: dia_aniversario=4, valor_principal=100000, valor_atual=100000, status="ativo"
- **Movimentação**: Aplicação Inicial de R$ 100.000,00 em 2024-03-04
- **Selic**: dados disponíveis (ex: 2024-04-04 = 10.75% a.a.)
- **Calendário**: dia 4 é dia útil em ~18 dos 25 meses do período

### Bugs identificados no motor `poupancaEngine.ts`

**Bug 1 — Aniversário em dia não útil é perdido**
O motor só credita rendimento quando `diaUtil === true` E a data é exatamente o aniversário. Quando o dia 4 cai em fim de semana/feriado (7 de 25 meses), o rendimento do mês inteiro é ignorado. A regra correta: quando o aniversário cai em dia não útil, o rendimento deve ser creditado no próximo dia útil.

**Bug 2 — Falta conversão numérica nos valores dos lotes**
Os campos `valor_principal` e `valor_atual` dos lotes vindos do banco (tipo `numeric`) são passados direto ao engine sem `Number()`. Se o PostgREST retornar como string, o operador `+=` faz concatenação de strings em vez de soma, quebrando completamente o cálculo. Tanto `CalculadoraPage` quanto `PosicaoConsolidadaPage` têm esse problema.

### Plano de correção (3 alterações)

**1. `src/lib/poupancaEngine.ts` — Corrigir lógica de aniversário**
- Remover a guarda `if (diaUtil)` do bloco de rendimento
- Implementar lógica de "aniversário diferido": se o dia do aniversário no mês corrente não é dia útil, creditar o rendimento no próximo dia útil
- Manter um set de "aniversários pendentes" por lote para garantir que cada mês é creditado exatamente uma vez
- Adicionar `Number()` defensivo na inicialização dos lotes (`valorPrincipal` e `valorAtual`)

**2. `src/pages/CalculadoraPage.tsx` — Conversão numérica nos lotes**
- Ao passar lotes para o engine, converter explicitamente `valor_principal`, `valor_atual`, `rendimento_acumulado` e `dia_aniversario` com `Number()`

**3. `src/pages/PosicaoConsolidadaPage.tsx` — Mesma conversão numérica**
- Aplicar o mesmo `Number()` na construção do map `lotesByCodigo`


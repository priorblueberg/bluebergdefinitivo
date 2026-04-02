

## Problema

O título 104 (CRI Banco Master **Pós Fixado CDI+ 9%**) aparece com dados zerados porque o motor de sincronização (`syncEngine.ts`) chama `calcularRendaFixaDiario` **sem passar o `indexador` nem os registros de CDI (`cdiRecords`)**. Sem esses dados, o multiplicador diário é sempre 0, e o produto não acumula nenhum rendimento. O "Resgate no Vencimento" automático é registrado com valor igual à aplicação inicial (R$ 60.000), sem juros.

Isso afeta 3 chamadas ao engine dentro do `syncEngine.ts`:
1. `syncResgateNoVencimento` (linha ~190)
2. `syncManualResgatesTotais` (linha ~88)
3. `reprocessMovimentacoesForCodigo` (linha ~741)

## Plano de Correção

### Arquivo: `src/lib/syncEngine.ts`

Em cada uma das 3 funções que chamam `calcularRendaFixaDiario`:

1. **Verificar se o produto é Pós Fixado ou Mista com indexador CDI/CDI+**
2. Se sim, **buscar os registros de `historico_cdi`** no intervalo de datas relevante
3. **Passar `indexador` e `cdiRecords`** como parâmetros ao engine

Detalhes por função:

**`syncResgateNoVencimento`** (linha ~170):
- Adicionar query ao `historico_cdi` quando `indexador` contém "CDI"
- Passar `indexador: custodiaRecord.indexador` e `cdiRecords` ao engine

**`syncManualResgatesTotais`** (linha ~58):
- Mesmo ajuste: buscar CDI se necessário e passar ao engine

**`reprocessMovimentacoesForCodigo`** (linha ~710):
- Buscar `indexador` da movimentação (já disponível via `aplicacaoInicial.indexador`)
- Passar CDI records e indexador ao engine

### Nenhuma alteração de regra de cálculo
Apenas corrigir dados de entrada que estavam faltando nas chamadas do sync engine.




## Plano: Definir data_limite fixa para Poupança na custódia

### Problema
A Poupança fica com `data_limite = null` na custódia. Quando outros ativos de Renda Fixa vencem, a carteira é marcada como "Encerrada" mesmo com Poupança ativa.

### Solução
Definir `data_limite = "2040-12-31"` para ativos de Poupança na custódia, garantindo que a carteira "Renda Fixa" permaneça ativa enquanto a Poupança existir.

### Alterações

1. **`src/lib/syncEngine.ts`** (linha 537):
   - Mudar de `isPoupanca ? null` para `isPoupanca ? "2040-12-31"`
   - Isso afeta tanto a criação quanto a atualização de registros de custódia

2. **Migração SQL** (opcional mas recomendada):
   - Atualizar registros de custódia existentes de Poupança que tenham `data_limite IS NULL` para `"2040-12-31"`

### Impacto
- A carteira "Renda Fixa" não será mais encerrada prematuramente quando apenas ativos com vencimento definido forem resgatados
- A Poupança ativa manterá a carteira com status "Ativa"
- Nenhum impacto em cálculos — `data_limite` é usado apenas para controle de carteiras e `computeDataCalculo`


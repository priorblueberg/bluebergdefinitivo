

# Nova coluna "Rent. Acum. (2)" na Calculadora

## Contexto

A coluna atual "% Rent. Acumulada" é baseada no Valor da Cota (1), que por sua vez depende do PU do papel. Em dias de pagamento de juros o PU reseta para o valor de emissão, o que pode distorcer a leitura da rentabilidade acumulada.

A nova coluna "Rent. Acum. (2)" calcula a rentabilidade acumulada compondo os retornos diários da cota, independente do PU. Fórmula: encadear `(1 + rentDiária%)` dia a dia, onde `rentDiária% = valorCota1[hoje] / valorCota1[ontem] - 1`.

## Alterações

### 1. `src/lib/rendaFixaEngine.ts`

- Adicionar `rentabilidadeAcumulada2: number` à interface `DailyRow`
- No loop de cálculo, manter um fator acumulado: `fatorAcum *= (1 + rentDiaria)` em dias úteis com retorno válido
- `rentabilidadeAcumulada2 = fatorAcum - 1`
- Incluir no `rows.push(...)` e no `makeZeroRow()`
- **Zero impacto** nas colunas existentes — apenas leitura de `rentDiaria` que já é calculado

### 2. `src/components/CalculadoraTable.tsx`

- Adicionar coluna "Rent. Acum. (2)" após a última coluna (Resgate Ex Cupom)
- Formato: percentual com 2 casas decimais, mesmo estilo das demais colunas de rentabilidade


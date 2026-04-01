

# Modificações na Engine de Renda Fixa — Colunas Verdes e Ajustes de Fórmulas

## Resumo

Alterações no motor de cálculo diário de Renda Fixa (`rendaFixaEngine.ts`) para separar juros do resgate, adicionar 3 novas colunas (Base Econômica, Aplicação Ex Cupom, Resgate Ex Cupom), e ajustar fórmulas de Valor da Cota, Preço Unitário e Quantidade de Resgate. Títulos "No Vencimento" permanecem inalterados (jurosPago = 0).

## Alterações por Coluna

### Novas Colunas (verdes no Excel)

| Coluna | Fórmula |
|--------|---------|
| **Aplicação Ex Cupom** | `(Aplicações / Preço Unitário) × PU Inicial` = `qtdAplicacaoPU × puInicialCustodia` |
| **Resgate Ex Cupom** | `(Resgate / Preço Unitário) × PU Inicial` = `qtdResgatePU × puInicialCustodia` |
| **Base Econômica** | `Base Econômica (dia anterior) + Aplicação Ex Cupom − Resgate Ex Cupom` |

### Colunas Modificadas

| Coluna | Antes | Depois |
|--------|-------|--------|
| **Valor da Cota (1)** | `Líquido(1) / Saldo Cotas(1)` | Normal: `(Líquido(1) + Juros Pago) / Saldo Cotas(1)`. Final day: `Resgate / Saldo Cotas(2)` |
| **Líquido (1)** | `prev*(1+m) + apps − resgate` | `prev*(1+m) + apps − resgate − jurosPago` (resultado numérico idêntico, pois juros foi removido do resgate) |
| **Resgate** | `ResgateLimpo + JurosPago` | `ResgateLimpo` (exclui juros). Final day: `patrimônio − jurosPago` |
| **Juros Pago** | `apoioCupom − valorInvestido` | `apoioCupom − baseEconômica` (e `− resgateLimpo` em pagamentos periódicos) |
| **Preço Unitário** | Capitaliza diariamente | Se `isPagamento = Sim`, usa `puInicialCustodia` (reseta) |
| **QTD Resgate** | Final: `(ResgateLimpo + RentAcum) / PU` | Final: `Resgate / PU`. Normal: `ResgateLimpo / PU` |

## Impacto em Títulos "No Vencimento"

Zero impacto: `jurosPago` permanece 0, então todas as fórmulas degeneram para o comportamento atual.

## Arquivos Modificados

### 1. `src/lib/rendaFixaEngine.ts`
- Adicionar `baseEconomica`, `aplicacaoExCupom`, `resgateExCupom` ao `DailyRow`
- Mover cálculo de `precoUnitario` para ANTES de `jurosPago`; adicionar condição `isPagamento`
- Reordenar: PU → qtdAplicacaoPU → aplicacaoExCupom → tempBaseEconomica → jurosPago → resgatesTotal → líquido1 → valorCota1 → qtdResgatePU → resgateExCupom → baseEconomica
- Ajustar `ganhoDiario = liquido1 − prevLiquido − apps + resgatesTotal + jurosPago`
- Ajustar `liquido2` para `liquido1 + resgatesTotal` (já correto com novo resgate excl juros)
- Adicionar `prevBaseEconomica` ao estado do loop

### 2. `src/components/CalculadoraTable.tsx`
- Adicionar 3 colunas: Base Econômica, Aplicação Ex Cupom, Resgate Ex Cupom

### 3. `src/lib/detailRowsBuilder.ts` (compensação)
- Adicionar `jurosPago` ao `EngineRowLike`
- Ganho mensal/anual: `resgatesMes += row.resgates + (row.jurosPago ?? 0)` para manter resultado correto
- Detecção de vencimento: `row.resgates + (row.jurosPago ?? 0) > 0`

### 4. `src/lib/carteiraRendaFixaEngine.ts` (compensação)
- Líquido(2): `liquido1 + resgates` permanece (correto com novo dado)
- `qtdCotasResgate`: usa `resgates + jurosPago` para manter cotas resgatadas corretas

### 5. `src/lib/syncEngine.ts` (compensação)
- Auto "Resgate no Vencimento": `valor = lastRow.resgates + lastRow.jurosPago` para manter valor total do patrimônio na movimentação

### 6. `makeZeroRow` em `rendaFixaEngine.ts`
- Adicionar campos: `baseEconomica: 0, aplicacaoExCupom: 0, resgateExCupom: 0`


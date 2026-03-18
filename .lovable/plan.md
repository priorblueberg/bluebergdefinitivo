

## Plano: Complemento da Engine com Resgates (Cota 2)

### Alteracoes em `src/lib/rendaFixaEngine.ts`

**Interface DailyRow** -- adicionar 4 novos campos:
- `valorCota2: number` -- Valor da Cota (2) = Liquido(2) / SaldoCotas(2)
- `saldoCotas2: number` -- Saldo de Cotas (2) = SaldoCotas(1) do dia anterior + QTD Cotas Compra do dia (sem descontar resgate)
- `liquido2: number` -- Liquido (2) = Liquido(1) + Resgate do dia
- `qtdCotasResgate: number` -- QTD Cotas (Resgate) = Resgate / ValorCota(2)

**Logica do loop diario** -- apos calcular Liquido(1), SaldoCotas(1) e ValorCota(1) como ja existe, adicionar:

1. `liquido2 = liquido + mov.resgates` (devolver o resgate ao liquido para calcular a cota pre-resgate)
2. `saldoCotas2 = prevSaldoCotas + qtdCotasCompra` (saldo sem descontar resgate)
3. `valorCota2 = saldoCotas2 > 0 ? liquido2 / saldoCotas2 : prevValorCota`
4. `qtdCotasResgate = mov.resgates > 0 && valorCota2 > 0 ? mov.resgates / valorCota2 : 0`

Nota: O calculo existente de Liquido(1) ja subtrai resgates (`prevLiquido * (1+mult) + aplicacoes - resgates`). Liquido(2) adiciona o resgate de volta para obter o valor pre-resgate. SaldoCotas(1) final do dia deve descontar as cotas resgatadas: `saldoCotas = saldoCotas2 - qtdCotasResgate`. Isso requer ajuste na ordem do calculo existente.

**Ordem revisada do calculo**:
1. dailyMult (como hoje)
2. liquido1 = prevLiquido * (1+mult) + aplicacoes - resgates
3. qtdCotasCompra = aplicacoes / prevValorCota
4. saldoCotas2 = prevSaldoCotas + qtdCotasCompra
5. liquido2 = liquido1 + resgates (= prevLiquido * (1+mult) + aplicacoes)
6. valorCota2 = liquido2 / saldoCotas2
7. qtdCotasResgate = resgates / valorCota2
8. saldoCotas1 = saldoCotas2 - qtdCotasResgate
9. valorCota1 = liquido1 / saldoCotas1
10. rentDiaria = valorCota1 / prevValorCota - 1

### Alteracoes em `src/pages/CalculadoraPage.tsx`

Atualizar colunas da tabela na ordem especificada:
Data, Dia Util, Valor da Cota (1), Saldo de Cotas (1), Liquido (1), Valor da Cota (2), Saldo de Cotas (2), Liquido (2), Aplicacoes, QTD Cotas (Compra), Resgate, QTD Cotas (Resgate), Rent. Diaria, Multiplicador.

### Arquivos afetados
- `src/lib/rendaFixaEngine.ts` -- nova logica e campos
- `src/pages/CalculadoraPage.tsx` -- novas colunas na tabela


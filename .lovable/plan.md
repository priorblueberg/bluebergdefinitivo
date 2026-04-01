

# Correção: Linha "Rentabilidade" na Tabela de Rentabilidade

## Análise

O código em `src/lib/detailRowsBuilder.ts` já implementa a lógica condicional correta (linhas 36, 119-125):

```typescript
const useRentAcum2 = pagamento != null && pagamento !== "No Vencimento";
// ...
const dailyRent = useRentAcum2
  ? (row.rentDiariaPct ?? 0)       // Rent. Acum (2) logic
  : (row.rentabilidadeDiaria ?? 0); // % Rent. Acumulada logic
rentFatorMensal *= 1 + dailyRent;
rentFatorAnual *= 1 + dailyRent;
```

A composição mensal e anual já é feita corretamente via fatores multiplicativos.

## Problema real

O erro de build anterior (HTTP 429 — rate limiting do npm registry) impediu a compilação. Não é um erro de código. A lógica já está correta conforme solicitado:

- **"No Vencimento"**: usa `rentabilidadeDiaria` (coluna "% Rent. Acumulada") para compor mensal/anual
- **Pagamento diferente**: usa `rentDiariaPct` (coluna "Rent. Acum (2)") para compor mensal/anual

## Plano

Nenhuma alteração de código é necessária. Apenas re-executar o build para resolver o erro transitório de rate limiting do npm.

Se houver algum valor específico na tabela que está incorreto, por favor indique o título, mês e o valor esperado vs. exibido para que eu possa investigar a causa raiz.


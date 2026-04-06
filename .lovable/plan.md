

## Plano: Visual de "finalizado" para carteiras encerradas e títulos liquidados

### Problema atual
- Na Carteira Renda Fixa, a badge "Encerrada" usa `variant="destructive"` (vermelho) em vez de cinza.
- Quando a carteira está encerrada ou o título está liquidado, nada muda visualmente na página — os cards, gráficos e tabelas continuam com aspecto normal.

### Alterações

#### 1. `src/pages/CarteiraRendaFixaPage.tsx`
- **Badge "Encerrada"**: trocar de `variant="destructive"` para `variant="secondary"` com `className="bg-muted text-muted-foreground"` (cinza, igual ao "Liquidado").
- **Aspecto de finalizado**: calcular `isEncerrada = carteiraInfo.status === "Encerrada"`. Quando encerrada:
  - Envolver todo o conteúdo (cards, gráficos, tabelas, alocação) em uma `div` com `opacity-60` para dar aspecto desbotado/passado.
  - Nenhuma funcionalidade muda.

#### 2. `src/pages/AnaliseIndividualPage.tsx` (ProductDetail)
- **Aspecto de finalizado**: quando `!isEmCustodia && !isBeforeStart` (Liquidado):
  - Envolver o conteúdo principal (cards, gráficos, tabela de rentabilidade) em uma `div` com `opacity-60`.
  - Nenhuma funcionalidade muda.

### Resultado visual
Quando encerrada/liquidado, toda a seção de dados fica com opacidade reduzida, transmitindo que são dados históricos/passados, enquanto o título, período de análise e badge permanecem com opacidade normal para contexto.


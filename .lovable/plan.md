

# Bug Fix: Pagamento de juros indevido na data do seletor

## Causa raiz

O calendário passado ao engine é filtrado até `dataCalculo` (data do seletor). A função `gerarDatasPagamentoJuros` gera datas de pagamento retroativamente a partir do **vencimento** — quando uma data de pagamento (ex: 30/10/2025) é posterior a `dataCalculo` (06/10/2025), a função `ajustarParaDiaUtil` procura o último dia útil ≤ 30/10 **dentro do calendário truncado**, e encontra 06/10/2025 (o último dia do calendário). Isso gera um pagamento de juros falso na data do seletor.

## Correção

**Arquivo: `src/lib/rendaFixaEngine.ts`**

1. Adicionar `dataCalculo` como parâmetro de `gerarDatasPagamentoJuros`
2. Dentro do loop de geração de datas, ignorar qualquer `targetStr` que seja > `dataCalculo` (não tentar ajustá-lo)
3. Atualizar a chamada em `calcularRendaFixaDiario` para passar `dataCalculo`

Isso garante que apenas datas de pagamento que realmente ocorrem dentro do período calculado sejam geradas, sem afetar nenhum outro comportamento.


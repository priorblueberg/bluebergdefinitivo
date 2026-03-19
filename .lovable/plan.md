

# Alteração: Card "Posição Fechada" quando título liquidado

## O que muda

Na página `/carteira/analise-individual`, quando a data do seletor for ≥ `resgate_total` do título:
- O label do card muda de **"Patrimônio"** para **"Posição Fechada"**
- O valor exibido passa a ser o **Líquido (2)** da data do resgate total (valor pré-resgate, que representa o patrimônio no momento do encerramento)
- O valor aparece em uma cor diferenciada (tom de cinza/muted) para indicar visualmente que não é uma posição ativa

## Implementação

**Arquivo: `src/pages/AnaliseIndividualPage.tsx`** (linhas ~430-462)

1. Detectar se a posição está fechada: `const isPosicaoFechada = product.resgate_total && dataReferenciaISO >= product.resgate_total`
2. Quando `isPosicaoFechada` e houver `engineRows`, buscar a row do dia do `resgate_total` e usar `row.liquido2` como valor do patrimônio
3. Alterar o objeto do card de Patrimônio:
   - `label`: `"Posição Fechada"` em vez de `"Patrimônio"`
   - `value`: formatado a partir do Líquido (2) da data de resgate
   - `color`: `"text-muted-foreground"` em vez de `"text-foreground"` para diferenciar visualmente




## Correção: Campo "Valor da Aplicação" na Poupança

### Problema
O campo "Valor da Aplicação" no formulário de Poupança usa a função `formatValorInicial` (digitação livre com vírgula manual), enquanto o campo "Valor Inicial" de Renda Fixa usa `formatCurrency` (formato centavos: digita "10000" e exibe "100,00"). O comportamento correto é o de Renda Fixa (`formatCurrency`), que mostra o valor formatado automaticamente conforme o usuário digita.

### Alteração (1 arquivo)

**`src/pages/CadastrarTransacaoPage.tsx`** (linha 1153)
- Trocar `formatValorInicial` por `formatCurrency` no `onChange` do campo "Valor da Aplicação" da Poupança, igualando ao comportamento do "Valor Inicial" de Renda Fixa.

### Padrão a ser memorizado
O formato `formatCurrency` (divisão por 100, auto-formatação em centavos com separador de milhar) será o padrão para todos os campos de valor monetário na aplicação.


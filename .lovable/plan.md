

# Adicionar suporte a Poupança na página de Welcome e Cadastrar Transação

## Problema identificado

O usuário está preso na página `/welcome` (WelcomeOnboardingPage), que **só permite cadastrar Renda Fixa** — a categoria é auto-selecionada como "Renda Fixa" sem oferecer opção de escolha (linha 94 do WelcomeOnboardingPage.tsx). Não há seletor de categoria visível.

Além disso, como o usuário não possui títulos cadastrados, ele não consegue acessar `/cadastrar-transacao` (a rota regular), onde o suporte a Poupança já foi implementado.

## Plano de correção

### 1. Adicionar seletor de categoria na WelcomeOnboardingPage

**Arquivo:** `src/pages/WelcomeOnboardingPage.tsx`

- Substituir o auto-select fixo de "Renda Fixa" por um dropdown de categorias (filtrado para "Renda Fixa" e "Poupança")
- Quando o usuário selecionar "Poupança", exibir o formulário simplificado (apenas Data, Valor, Corretora) — mesma lógica que já existe em `CadastrarTransacaoPage`
- Quando selecionar "Renda Fixa", manter o formulário atual

### 2. Adaptar o formulário da WelcomeOnboardingPage para Poupança

Quando categoria = "Poupança":
- Ocultar campos: Modalidade, Indexador, Taxa, Pagamento de Juros, Preço de Emissão, Emissor, Vencimento
- Manter visíveis: Data de Transação, Valor Inicial, Corretora (banco)
- Permitir cadastro em qualquer dia (não validar dia útil)
- Auto-selecionar o produto "Poupança"
- No submit, criar o lote em `poupanca_lotes` via syncEngine (que já tem suporte)

### 3. Ajustar o handleSubmit para Poupança

- Remover validação de dia útil quando categoria for Poupança
- Omitir campos não aplicáveis (modalidade, indexador, taxa, etc.) no insert de movimentação
- Garantir que o `fullSyncAfterMovimentacao` funcione corretamente para Poupança (já implementado no syncEngine)

### Detalhes técnicos

**Arquivos a modificar:**
- `src/pages/WelcomeOnboardingPage.tsx` — adicionar seletor de categoria, formulário condicional para Poupança, ajustar submit

**Nenhum arquivo novo necessário** — toda a lógica de engine e sync para Poupança já existe.


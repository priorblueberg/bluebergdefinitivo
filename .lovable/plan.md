

# Plano: Inserir 6 CDBs via script replicando fluxo da boleta

## Resumo

Criar um script que insere 6 movimentações de CDB no banco, replicando exatamente a lógica da boleta: gerar `nome_ativo` com `buildNomeAtivo`, criar `codigo_custodia` sequencial, marcar como "Aplicação Inicial", e disparar `fullSyncAfterMovimentacao` para cada registro.

## Dados de referência (IDs já identificados)

- Categoria "Renda Fixa": `47b2c6b5-8b20-48e8-9d05-4b9f52747dda`
- Produto "CDB (Certificado de Depósito Bancário)": `a56a5936-bf65-416f-b5f1-554a3ebb8406`
- Instituição "XP Investimentos": `1d43339d-9901-4ec4-84b4-90b5d91cdcb7`
- Emissor "Banco B3": `df84d3b5-227c-4a19-a236-b137d58bbf1f`
- Max codigo_custodia atual: 100 (novos: 101-106)

## Lógica do script

Para cada uma das 6 linhas:

1. Gerar `nome_ativo` usando a mesma fórmula `buildNomeAtivo` (Prefixado: "CDB Banco B3 Prefixado 12% a.a. - DD/MM/YYYY")
2. Atribuir `codigo_custodia` sequencial (101, 102, ..., 106)
3. Calcular `quantidade = valor / PU`
4. Gerar `valor_extrato` no formato "R$ X (R$ PU x QTD)"
5. Inserir na tabela `movimentacoes` com `tipo_movimentacao = "Aplicação Inicial"`, `origem = "manual"`
6. Após cada insert, chamar `fullSyncAfterMovimentacao` para criar custodia + controle de carteiras

## Implementação

Criar um componente/página temporário React que executa os inserts no client-side (com o contexto de autenticação do usuário logado) e dispara o sync engine para cada um. Isso garante que o fluxo passa pelas mesmas funções do sistema.

Alternativamente, como o script precisa do `user_id` autenticado e do sync engine, a abordagem mais segura é criar uma função utilitária temporária acessível via botão na página Admin.

## Arquivos alterados

1. **`src/pages/AdminPage.tsx`** — Adicionar botão "Inserir CDBs de Teste" que executa a lógica de inserção sequencial com sync

## Dados das 6 linhas

| # | Data | Taxa | Valor | Vencimento | Pagamento | PU |
|---|------|------|-------|------------|-----------|-----|
| 1 | 2024-01-02 | 12 | 10000 | 2025-12-30 | No Vencimento | 1000 |
| 2 | 2024-01-09 | 12 | 20000 | 2025-12-29 | No Vencimento | 1023.20 |
| 3 | 2024-02-06 | 13 | 30000 | 2025-11-25 | Mensal | 1000 |
| 4 | 2024-02-22 | 13 | 40000 | 2025-12-08 | Mensal | 1023.20 |
| 5 | 2024-03-05 | 14 | 50000 | 2024-12-30 | Bimestral | 1000 |
| 6 | 2024-03-18 | 14 | 60000 | 2025-05-05 | Bimestral | 1023.20 |

## Validação pós-inserção

- Verificar que 6 registros aparecem em `movimentacoes` com tipo "Aplicação Inicial"
- Verificar que 6 registros foram criados em `custodia`
- Confirmar que aparecem na Posição Consolidada
- Confirmar cálculo de `quantidade` correto para cada linha


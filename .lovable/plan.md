

# Diagnóstico: Gráfico de Alocação por Emissor não identifica Poupança

## Causa raiz

Os ativos de Poupança **já existentes** no banco foram cadastrados **antes** da implementação da regra de emissor automático. Portanto:

1. As `movimentacoes` dessas Poupanças têm `emissor_id = NULL`
2. O sync engine copia `emissor_id` da primeira movimentação para a `custodia`
3. A custodia da Poupança ficou com `emissor_id = NULL`
4. O gráfico faz `r.emissores?.nome || "—"` → exibe "—: 100%"

A correção de código (auto-preencher emissor no cadastro) só vale para **novos** cadastros. Os dados históricos não foram corrigidos.

## Solução

Dois passos:

### 1. Corrigir dados existentes (migração SQL)
Atualizar `emissor_id` nas tabelas `movimentacoes` e `custodia` para os ativos de Poupança que têm `emissor_id = NULL` mas têm `instituicao_id` preenchido. A lógica: buscar na tabela `emissores` o registro com o mesmo `nome` da `instituicao` vinculada.

```sql
-- Corrigir movimentacoes de Poupança sem emissor
UPDATE movimentacoes m
SET emissor_id = e.id
FROM instituicoes i, emissores e
WHERE m.instituicao_id = i.id
  AND e.nome = i.nome
  AND m.emissor_id IS NULL
  AND m.modalidade = 'Poupança';

-- Corrigir custodia de Poupança sem emissor
UPDATE custodia c
SET emissor_id = e.id
FROM instituicoes i, emissores e
WHERE c.instituicao_id = i.id
  AND e.nome = i.nome
  AND c.emissor_id IS NULL
  AND c.modalidade = 'Poupança';
```

### 2. Proteção no sync engine (opcional, recomendado)
Adicionar fallback no `syncEngine.ts`: se o produto é Poupança e `emissor_id` é null, buscar o emissor pelo nome da instituição antes de gravar na custodia. Isso previne regressão caso um resync reprocesse movimentações antigas.

## Resultado esperado
- O gráfico "Alocação por Emissor" passará a exibir o nome do banco (ex: "Banco X: 100%") em vez de "—: 100%"
- Nenhuma alteração em saldo, ganho ou rentabilidade

## Detalhes técnicos
- **Arquivos alterados**: migração SQL + `src/lib/syncEngine.ts` (fallback)
- **Risco**: zero — apenas preenche um campo informacional que estava vazio


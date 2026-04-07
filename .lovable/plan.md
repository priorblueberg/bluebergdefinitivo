

## Plan: Poupança — FIFO Obrigatório, Exibição Consolidada e Proventos

### Resumo das Mudanças
Remover o toggle FIFO (agora obrigatório), simplificar a exibição para sempre consolidada, integrar rendimentos de poupança na página de Proventos, e ajustar a boleta para salvar Banco como Instituição **e** Emissor.

---

### 1. Remover toggle FIFO e useUserSettings

**`src/pages/ConfiguracoesPage.tsx`**
- Remover todo o card "Poupança" com o toggle FIFO
- Manter apenas o card "Redefinir Movimentações"
- Remover imports de `useUserSettings`, `Switch`, `Tooltip`, `HelpCircle`, `recalculateAllForDataReferencia`, `format`

**`src/hooks/useUserSettings.ts`**
- Deletar o arquivo (não é mais necessário)

**`src/pages/PosicaoConsolidadaPage.tsx`**
- Remover import de `useUserSettings`
- Remover variável `_cachedFifo` e referências
- Remover o bloco `else` (certificate mode, linhas 280-363)
- Manter apenas o bloco FIFO (linhas 245-279) como lógica padrão, sem condicional
- Remover `poupancaFifo` e `settingsLoading` do useEffect e da lógica de cache

### 2. Boleta: Banco = Instituição + Emissor

**`src/pages/CadastrarTransacaoPage.tsx`**
- Na linha 810, alterar `emissor_id: isPoupanca ? null : emissorId || null` para `emissor_id: isPoupanca ? instituicaoId : emissorId || null` (usar o mesmo ID da instituição como emissor quando é Poupança, visto que os emissores são os bancos)
- Nota: isso requer que o banco selecionado exista na tabela `emissores`. Alternativa mais segura: salvar `emissor_id` com o valor da `instituicao_id`, porém as tabelas `instituicoes` e `emissores` são independentes. O correto é:
  - Ao salvar Poupança, buscar na tabela `emissores` um registro com o mesmo nome do banco selecionado
  - Se existir, usar esse `emissor_id`; se não, deixar null (comportamento atual)

**Abordagem simplificada**: Na boleta Poupança, ao selecionar o Banco (instituição), buscar automaticamente na tabela `emissores` o registro com mesmo nome e preencher `emissor_id`.

### 3. Proventos: Incluir rendimentos de Poupança

**`src/pages/ProventosRecebidosPage.tsx`**
- Atualmente filtra apenas `pagamento !== "No Vencimento" && modalidade === "Prefixado"` — exclui Poupança
- Adicionar bloco para processar custódias de Poupança:
  - Buscar `poupanca_lotes`, `historico_selic`, `historico_tr`, `historico_poupanca_rendimento`
  - Rodar `calcularPoupancaDiario` consolidando todos os lotes
  - Iterar nos `DailyRow[]` e, para cada dia com `ganhoDiario > 0.01`, gerar um `ProventoRow` com tipo "Rendimento"
- Resultado: cada aniversário aparece como linha na tabela de proventos

### 4. Limpeza de dependências

**Migração de banco**: Nenhuma. A tabela `user_settings` pode permanecer (não causa dano), mas a coluna `poupanca_fifo` deixa de ser utilizada.

**`src/integrations/supabase/types.ts`**: Não editar (auto-gerado).

---

### Arquivos Modificados

| Arquivo | Ação |
|---------|------|
| `src/hooks/useUserSettings.ts` | Deletar |
| `src/pages/ConfiguracoesPage.tsx` | Remover card FIFO, simplificar |
| `src/pages/PosicaoConsolidadaPage.tsx` | Remover lógica certificate, FIFO fixo |
| `src/pages/ProventosRecebidosPage.tsx` | Adicionar rendimentos Poupança |
| `src/pages/CadastrarTransacaoPage.tsx` | Emissor = banco para Poupança |

### Detalhes Técnicos

**Proventos — lógica de detecção de aniversário**: O engine já calcula `ganhoDiario` corretamente (só > 0 em dias de aniversário). Basta filtrar `row.ganhoDiario > 0.01` para gerar os registros de provento.

**Posição Consolidada — simplificação**: O bloco FIFO existente (linhas 245-279) já funciona corretamente. Apenas remover o `if (poupancaFifo)` e o `else` correspondente.


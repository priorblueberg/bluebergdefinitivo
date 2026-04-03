## Complemento da Página "Posição Consolidada"

### Resumo

Adicionar ao page existente: (1) botões de Aplicação/Resgate e ícone de exclusão por linha, (2) modal "Detalhes da Posição" com duas abas (Histórico e Dados), acionado ao clicar no nome do ativo.  
  
*Deve ser acionada ao clicar em qualquer parte da linha do ativo.*  
*Nesta página também deve-se incluir a rentabilidade total da carteira na linha totalizadora.*  
*Desta página deve ser retirada os campos "Quantidade" e "Preço Unitário".*

### Alterações

**Arquivo: `src/pages/PosicaoConsolidadaPage.tsx**`

1. **Expandir `CustodiaProduct` e `PosicaoRow**` para incluir campos extras necessários para as boletas e o modal de detalhes:
  - `PosicaoRow` passa a carregar o objeto `CustodiaProduct` completo (referência ao produto original), incluindo `categoria_id`, `produto_id`, `instituicao_id`, `emissor_id`, `emissor_nome`, `pagamento`, `indexador`, `taxa`, `modalidade`, `vencimento`, `codigo_custodia`, `data_inicio`, `valor_investido`, `preco_unitario`.
  - A query de `custodia` passa a incluir `emissores(nome)`, `categoria_id`, `produto_id`, `instituicao_id`, `emissor_id`.

*Nem todos estes objetos serão exibidos nos detalhes, certo? Precisamos chamar tudo isso para compor as informações, correto?* 

1. **Botões de ação na tabela** (coluna "Ações" no final de cada linha):
  - Botão "Aplicação" e "Resgate" (mesmo padrão da `CustodiaPage`): abre `BoletaCustodiaDialog`.
  - Ícone `Trash2` para exclusão: abre `AlertDialog` de confirmação. A exclusão remove todas as movimentações do `codigo_custodia` e o registro de custódia, depois chama `fullSyncAfterDelete` e `applyDataReferencia()` (mesmo código da `CustodiaPage`).
2. **Modal "Detalhes da Posição"** (Dialog/Sheet):
  - Abre ao clicar na linha do ativo (no nome ou na row inteira).
  - Header: Nome do ativo (bold, grande), Custodiante abaixo, Valor Atualizado no canto direito.
  - Subtítulo: "Período de análise: [data_inicio] - [dataReferencia]".
  - Duas abas via componente de Tabs existente:
   **Aba "Histórico":**
  - Tabela de movimentações do `codigo_custodia` (fetch de `movimentacoes` filtrando por `codigo_custodia` e `user_id`).
  - Colunas: Data, Tipo, Valor Investido (valor), Custos Op. (fixo R$ 0,00), Valor Total (valor), Origem.  

  *Retirar a informação de custos operacionais e incluir a informação de quantidade e preço unitário.*  

  - Cada linha manual tem botões Editar (navega para `/cadastrar-transacao?edit={id}`) e Excluir (com AlertDialog e lógica de cascata para Aplicação Inicial, igual à `MovimentacoesPage`).
  - Linhas automáticas exibem badge "Auto" sem ações.
   **Aba "Dados":**
  - Lista key-value simples com os dados de cadastro: Nome do Ativo, Indexador, Taxa (formatada com %), Modalidade, Tipo de Pagamento, Emissor, Custodiante, Vencimento (formatado dd/mm/yyyy).

### Detalhes Técnicos

- Reutiliza `BoletaCustodiaDialog` (já existente) para aplicação/resgate.
- Reutiliza `AlertDialog` para confirmação de exclusão.
- Reutiliza `fullSyncAfterDelete` de `syncEngine.ts`.
- O modal de detalhes usa `Dialog` (de `@/components/ui/dialog`) com `Tabs` (`@/components/ui/tabs`).
- A coluna "Ações" na tabela principal + header "Ações" na TableHeader.
- A linha Total na tabela ganha uma célula vazia extra para a coluna de ações.
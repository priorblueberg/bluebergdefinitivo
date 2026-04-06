

## Correção: CDB Pós Fixado CDI+ não calcula saldo de resgate corretamente

### Problema
Quando um ativo é cadastrado como "Pós Fixado" + "CDI+", ele é salvo no banco com modalidade `"Mista"` e indexador `"CDI"`. Porém, tanto em `BoletaCustodiaDialog.tsx` quanto em `CadastrarTransacaoPage.tsx`, a variável `isRendaFixaEngine` só verifica `"Prefixado"`, `"Pos Fixado"` e `"Pós Fixado"` — **não inclui `"Mista"`**. Como resultado, o engine de renda fixa nunca roda para esse ativo, e o saldo disponível não é calculado (ou mostra o valor investido sem juros).

### Solução
Incluir `"Mista"` na condição `isRendaFixaEngine` e garantir que o fetch de CDI também seja disparado para ativos com modalidade `"Mista"` e indexador `"CDI"`.

### Alterações

**1. `src/components/BoletaCustodiaDialog.tsx` (~linha 201)**
- Alterar a condição de:
  ```
  (row.modalidade === "Prefixado" || row.modalidade === "Pos Fixado" || row.modalidade === "Pós Fixado")
  ```
  para:
  ```
  (row.modalidade === "Prefixado" || row.modalidade === "Pos Fixado" || row.modalidade === "Pós Fixado" || row.modalidade === "Mista")
  ```
- Alterar a condição `isPosFixadoCDI` (~linha 216) para incluir `"Mista"`:
  ```
  const isPosFixadoCDI = ((row.modalidade === "Pos Fixado" || row.modalidade === "Pós Fixado") && row.indexador === "CDI") || (row.modalidade === "Mista" && row.indexador === "CDI");
  ```

**2. `src/pages/CadastrarTransacaoPage.tsx` (~linha 418)**
- Mesma alteração em `isRendaFixaEngine`: adicionar `|| selectedCustodia.modalidade === "Mista"`.
- Mesma alteração em `isPosFixadoCDI` (~linha 423): incluir condição para `"Mista"`.

Nenhuma alteração de banco necessária.


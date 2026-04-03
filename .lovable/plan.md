

## Mapeamento "Pós Fixado + CDI+" → "Mista + CDI"

### O que será feito
Quando o usuário cadastrar um título com **Modalidade = "Pós Fixado"** e **Indexador = "CDI+"**, o sistema deve gravar automaticamente **Modalidade = "Mista"** e **Indexador = "CDI"** tanto na movimentação quanto na custódia. Isso garante que o engine use o multiplicador correto `(1 + CDI anterior) * (1 + Taxa)^(1/252) - 1`.

### Pontos de alteração

#### 1. `src/pages/CadastrarTransacaoPage.tsx` — Inserção de Aplicação (linha ~519)
Antes de gravar na tabela `movimentacoes`, aplicar a transformação:
- Se `modalidade === "Pós Fixado"` e `indexador === "CDI+"` → gravar `modalidade: "Mista"` e `indexador: "CDI"`
- Isso afeta: insert de nova aplicação (linha ~519), update de edição (linha ~466)

#### 2. `src/pages/CadastrarTransacaoPage.tsx` — Nome do ativo (`buildNomeAtivo`)
O nome do ativo (linha ~451) é gerado **antes** da transformação. Manter o nome original com "CDI+" para exibição ao usuário, mas gravar modalidade/indexador transformados.

#### 3. `src/components/BoletaCustodiaDialog.tsx` — Inserção de Resgate/Aplicação via boleta
As boletas copiam `modalidade` e `indexador` do registro de custódia existente, que já estará como "Mista"/"CDI". Nenhuma alteração necessária aqui.

#### 4. `src/lib/syncEngine.ts` — Sincronização de custódia (linha ~441)
A custódia já copia `modalidade` e `indexador` da `aplicacaoInicial`. Como a movimentação já terá os valores transformados, a custódia será gravada corretamente. Nenhuma alteração necessária.

### Resumo técnico
Uma única transformação no ponto de entrada (cadastro de transação) propaga corretamente para todo o sistema. A alteração é um bloco de ~4 linhas adicionado antes dos inserts/updates em `CadastrarTransacaoPage.tsx`.


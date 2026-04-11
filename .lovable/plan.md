

# Correção do Edge Function ai-chat

## Problemas identificados

Analisando os logs, existem **dois problemas distintos**:

### 1. Erro no codigo da Edge Function
O metodo `supabase.auth.getClaims(token)` **nao existe** no Supabase JS client. Isso causa o crash `SyntaxError: Unexpected end of JSON input`. Precisa ser substituido por `supabase.auth.getUser(token)`.

### 2. Webhook n8n retornando 404
Os logs mostram duas situacoes:
- **URL de teste** (`webhook-test/Blueberg`): so funciona quando voce clica "Execute workflow" no editor do n8n e ele fica escutando. Apos receber uma chamada, para de escutar.
- **URL de producao** (`webhook/Blueberg` sem `-test`): so funciona quando o workflow esta **ativo** (toggle ligado no canto superior direito do editor n8n).

## O que voce precisa me enviar

Depende do cenario:

- **Para testes**: continue com `https://blueberg.app.n8n.cloud/webhook-test/Blueberg` (a URL ja esta configurada), mas precisa clicar "Execute workflow" no n8n antes de cada teste
- **Para producao**: me envie a URL de producao: `https://blueberg.app.n8n.cloud/webhook/Blueberg` (sem o `-test`) e ative o workflow no n8n

## Correcao tecnica necessaria

Independente da URL, o codigo da Edge Function precisa ser corrigido:

1. **Substituir `getClaims`** por `getUser` na validacao JWT
2. **Atualizar CORS headers** para incluir todos os headers necessarios
3. **Adicionar tratamento** para quando o n8n retorna resposta nao-JSON (ex: HTML de erro)

Apos aprovacao, farei a correcao no codigo e redeployarei a funcao.


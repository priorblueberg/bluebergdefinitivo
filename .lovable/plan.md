

# Integração do Chat com o webhook n8n

## Contexto

O chat já funciona como um painel lateral (Sheet) que sobrepõe qualquer página — ele não depende de rota. Basta usar o `useAuth()` dentro do componente para obter o token de sessão do usuário logado e enviá-lo no header `Authorization`.

## Como funciona a linkagem

O `AiChatDialog` é renderizado dentro do `AppHeader`, que está presente em **todas as rotas protegidas**. Ao clicar "Converse com a IA", o Sheet abre por cima da página atual. Não há necessidade de navegar para outra URL — o componente já tem acesso ao contexto de autenticação via `useAuth()` e ao token da sessão ativa via `supabase.auth.getSession()`.

## Plano de implementação

### 1. Criar Edge Function proxy (`supabase/functions/ai-chat/index.ts`)

A chamada ao webhook n8n não pode ser feita diretamente do navegador porque:
- Exporia a URL do webhook no client-side
- Problemas de CORS com o n8n

A Edge Function vai:
- Receber `{ input: string }` do frontend
- Validar o JWT do usuário (extraindo do header Authorization)
- Fazer o POST para `https://blueberg.app.n8n.cloud/webhook-test/Blueberg` passando o token do usuário
- Retornar a resposta da IA ao frontend

### 2. Adicionar secret da URL do webhook

Usar `add_secret` para armazenar a URL do webhook n8n como `N8N_WEBHOOK_URL` para que não fique hardcoded.

### 3. Atualizar `AiChatDialog.tsx`

- Importar `useAuth` e `supabase`
- No `handleSend`, após adicionar a mensagem do usuário:
  - Adicionar mensagem placeholder "digitando..." do assistente
  - Obter o access token via `supabase.auth.getSession()`
  - Chamar a Edge Function via `supabase.functions.invoke('ai-chat', { body: { input } })`
  - Substituir o placeholder pela resposta real
  - Tratar erros com toast
- Adicionar estado `loading` para desabilitar o botão enquanto aguarda resposta
- Renderizar respostas da IA com `react-markdown` para suportar formatação

### 4. Instalar `react-markdown`

Necessário para renderizar as respostas formatadas da IA.

## Detalhes técnicos

**Edge Function (`ai-chat/index.ts`)**:
```text
POST { input: string }
→ Valida JWT
→ Extrai access_token da sessão
→ POST n8n webhook com Authorization: Bearer <token>
→ Retorna { output: string }
```

**Frontend flow**:
```text
User digita → handleSend()
→ Adiciona msg user no state
→ setState loading=true
→ supabase.functions.invoke('ai-chat', { body: { input } })
→ Adiciona msg assistant no state
→ setState loading=false
```

O chat não precisa de rota própria — funciona como overlay global em qualquer página da aplicação.




## Atualização Diária Automática das Tabelas CDI, Ibovespa e Dias Úteis

### Resumo
Criar uma edge function unificada `daily-market-sync` que atualiza as três tabelas diariamente via cron job (`pg_cron`). A função existente `fetch-ibovespa` será substituída por esta nova função mais completa.

---

### 1. Edge Function `daily-market-sync`

**Arquivo:** `supabase/functions/daily-market-sync/index.ts`

Três tarefas em sequência:

#### 1a. Histórico CDI
- Fonte: API Banco Central do Brasil, série 4389 (`https://api.bcb.gov.br/dados/serie/bcdata.sgs.4389/dados?formato=json&dataInicial=DD/MM/YYYY&dataFinal=DD/MM/YYYY`)
- Buscar a data máxima existente na tabela `historico_cdi`, pedir dados de `max+1` até ontem (D-1)
- Inserir somente registros novos (upsert por `data`)
- A API retorna `{ data: "DD/MM/YYYY", valor: "X.XX" }` — converter `valor` para `taxa_anual` (numeric)

#### 1b. Histórico Ibovespa
- Reutilizar lógica do `fetch-ibovespa` existente (Yahoo Finance `^BVSP`)
- Em vez de deletar tudo e reinserir, buscar somente dados incrementais: `period1` = max(data) existente, `period2` = agora
- Upsert por `data` para evitar duplicatas

#### 1c. Calendário Dias Úteis
- A tabela já tem dados até 2026-12-31, mas precisamos garantir cobertura futura
- Fonte: API do Banco Central ou lógica baseada nos feriados nacionais brasileiros
- Abordagem pragmática: usar os dados do CDI como proxy — se há registro CDI num dia, é dia útil. Complementar com uma lista de feriados nacionais para datas futuras
- Alternativa mais simples: a API ANBIMA ou BCB calendário. Usaremos a lógica de que dias com cotação CDI = dia útil, e para datas futuras sem CDI ainda, marcar seg-sex como útil excluindo feriados fixos

**Abordagem escolhida para dias úteis:** Gerar dias de hoje até fim do ano seguinte, marcar seg-sex como `true`, excluindo feriados nacionais fixos e móveis (carnaval, corpus christi, sexta-feira santa). Upsert para não sobrescrever dados existentes confirmados.

---

### 2. Remover `fetch-ibovespa`

Deletar `supabase/functions/fetch-ibovespa/` pois será substituída pela função unificada.

---

### 3. Cron Job Diário

Usar `pg_cron` + `pg_net` para agendar execução diária às 07:00 UTC (04:00 BRT):

```sql
SELECT cron.schedule(
  'daily-market-sync',
  '0 7 * * *',
  $$ SELECT net.http_post(...) $$
);
```

---

### Detalhes Técnicos

- A API do BCB série 4389 retorna dados no formato `{ data: "DD/MM/YYYY", valor: "11.15" }` onde `valor` é a taxa anual do CDI
- Yahoo Finance para Ibovespa: mesmo endpoint `v8/finance/chart/^BVSP` já usado
- Feriados nacionais brasileiros fixos: 01/01, 21/04, 01/05, 07/09, 12/10, 02/11, 15/11, 20/11, 25/12
- Feriados móveis (Páscoa-dependentes): Carnaval (seg+ter), Sexta-feira Santa, Corpus Christi — calculados via algoritmo de Páscoa
- Upsert via `ON CONFLICT (data) DO UPDATE` para idempotência


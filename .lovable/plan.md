# Plano Técnico: Inclusão do Produto Poupança na Blueberg

---

## 1. Modelagem de Dados

### Abordagem: Reutilizar o modelo existente

A Poupança será integrada **sem criar novas tabelas**. Usaremos as tabelas `custodia`, `movimentacoes` e `controle_de_carteiras` existentes, com uma nova **categoria** "Poupança" e um novo **produto** "Poupança".

**Inserções necessárias (dados de referência):**

- `categorias`: inserir `{ nome: "Poupança", ativa: true }`
- `produtos`: inserir `{ nome: "Poupança", categoria_id: <id_poupanca>, ativo: true }`

**Nova tabela: `poupanca_lotes**`

Necessária para o controle FIFO por lote — cada aplicação gera um lote independente com data de aniversário própria.

```
poupanca_lotes
├── id (uuid, PK)
├── user_id (uuid, NOT NULL)
├── custodia_id (uuid, FK → custodia.id)
├── codigo_custodia (integer, NOT NULL)
├── data_aplicacao (date, NOT NULL)
├── dia_aniversario (integer, NOT NULL) -- dia do mês (1-31)
├── valor_principal (numeric, NOT NULL) -- principal original
├── valor_atual (numeric, NOT NULL) -- principal + rendimento acumulado
├── rendimento_acumulado (numeric, DEFAULT 0)
├── ultimo_aniversario (date) -- data do último rendimento creditado
├── status (text, DEFAULT 'ativo') -- ativo | resgatado
├── data_resgate (date) -- preenchida quando status = resgatado
├── created_at (timestamptz, DEFAULT now())
```

RLS: Mesmas políticas das demais tabelas (CRUD por `auth.uid() = user_id`).

**Nova tabela: `historico_selic**`

Para calcular o rendimento correto (regra Selic > 8,5%).

```
historico_selic
├── data (date, PK)
├── taxa_anual (numeric, NOT NULL)
```

RLS: SELECT público (como `historico_cdi`).

**Uso de `custodia` existente:**

Uma poupança cria um registro em `custodia` com:

- `categoria_id` → id da categoria "Poupança"
- `produto_id` → id do produto "Poupança"
- `modalidade` → "Poupança"
- `indexador` → null
- `taxa` → null (taxa é dinâmica, baseada na Selic)
- `pagamento` → "Mensal" (rendimento no aniversário)
- `vencimento` → null (não tem vencimento)
- `valor_investido` → soma dos lotes ativos

**Uso de `movimentacoes` existente:**

Movimentações de poupança seguem o fluxo normal:

- `tipo_movimentacao`: "Aplicação Inicial", "Aplicação", "Resgate"
- `categoria_id` → id "Poupança"

---

## 2. Lógica de Cálculo

### 2.1 Aplicação

1. Inserir movimentação na tabela `movimentacoes`
2. Criar um registro em `poupanca_lotes`:
  - `dia_aniversario` = dia da `data_aplicacao`
  - Se dia = 29, 30 ou 31 → ajustar para o último dia do mês nos meses curtos
  - `valor_principal` = valor aplicado
  - `valor_atual` = valor aplicado
3. Atualizar `custodia.valor_investido` com a soma de todos os lotes ativos

### 2.2 Evolução do Saldo (Cálculo Mensal)

A cada aniversário do lote:

```text
1. Verificar Selic meta vigente na data do aniversário
2. Se Selic > 8.5:
     rendimento_mensal = valor_atual * ((1 + 0.005)^1 - 1) + TR
   Se Selic ≤ 8.5:
     fator_mensal = (1 + Selic)^(1/12) * 0.70
     rendimento_mensal = valor_atual * (fator_mensal - 1) + TR
3. valor_atual += rendimento_mensal
4. rendimento_acumulado += rendimento_mensal
5. ultimo_aniversario = data do aniversário
```

**Nota sobre TR:** A TR tem sido zero ou próxima de zero desde 2018. Para o MVP, assumir TR = 0 e adicionar suporte futuramente via tabela `historico_tr` se necessário.

**Engine dedicada:** Criar `src/lib/poupancaEngine.ts` com função `calcularPoupancaDiario()` que retorna `DailyRow[]`-compatível para integração com a carteira.

A função percorre o calendário dia a dia e, nos dias de aniversário de cada lote, credita o rendimento. Nos demais dias, o saldo permanece constante (sem rendimento diário).

### 2.3 Resgate (FIFO)

```text
function resgatarPoupanca(valor_resgate, lotes_ativos_ordenados_por_data):
  restante = valor_resgate
  para cada lote (mais antigo primeiro):
    proximo_aniversario = calcular próximo aniversário do lote
    
    se hoje < proximo_aniversario:
      // Resgate antes do aniversário — sem rendimento do período atual
      disponivel = lote.valor_atual  // valor até último aniversário
    senão:
      disponivel = lote.valor_atual  // já inclui rendimento creditado
    
    se restante >= disponivel:
      consumir lote inteiro → status = 'resgatado'
      restante -= disponivel
    senão:
      lote.valor_atual -= restante
      lote.valor_principal -= (restante * lote.valor_principal / lote.valor_atual)
      restante = 0
      break
  
  atualizar custodia.valor_investido
```

### 2.4 Consolidação para Carteira

A poupança produzirá `DailyRow[]` com a seguinte lógica:

- `liquido` / `liquido2`: soma dos `valor_atual` de todos os lotes na data
- `ganhoDiario`: rendimento creditado naquele dia (= soma dos rendimentos dos lotes que aniversariam naquele dia; zero nos demais dias)
- `aplicacoes` / `resgates`: das movimentações
- `rentabilidadeAcumuladaPct`: composição dos fatores diários (mesmo padrão TWR)

Isso permite que `calcularCarteiraRendaFixa()` receba o array de rows da poupança junto com os demais produtos sem alterações.

---

## 3. Impacto na Carteira

### Ausência de rendimento diário

O engine da carteira já lida com dias sem ganho (carry-forward de líquido). A poupança terá `ganhoDiario = 0` em todos os dias exceto aniversários, o que é compatível com o modelo TWR existente.

### Integração com `PosicaoConsolidadaPage`

- Poupança será tratada como mais um produto no array `posicaoRows`
- Atualmente, `otherProducts` (não Renda Fixa) já aparecem com `ganhoFinanceiro: 0` e `rentabilidade: 0` — a poupança terá cálculo real via engine próprio

### Comparação com CDI

A comparação CDI continua válida. O `detailRowsBuilder.ts` funciona com qualquer `EngineRowLike`, então a poupança se encaixa naturalmente.

---

## 4. Interface (UX)

### 4.1 Cadastro

Na boleta (`CadastrarTransacaoPage`):

- Ao selecionar categoria "Poupança", ocultar campos irrelevantes: Modalidade, Indexador, Taxa, Pagamento de Juros, Preço de Emissão, Emissor
- Manter visíveis: Data de Transação, Corretora (banco), Valor Inicial
- Vencimento: ocultar (poupança não tem vencimento)
- O formulário fica significativamente mais simples

### 4.2 Posição Consolidada

- Aparece como linha normal na tabela
- Valor Atualizado: soma de `valor_atual` de todos os lotes
- Ganho Financeiro: soma de `rendimento_acumulado`
- Rentabilidade: calculada via engine

### 4.3 Dashboard Individual (Análise)

- Gráfico de evolução: degraus mensais (não curva contínua)
- Tabela de detalhes: mostrar meses com rendimento creditado
- Informações do ativo: banco, data primeira aplicação, quantidade de lotes ativos

### 4.4 Boleta de Aplicação/Resgate (BoletaCustodiaDialog)

- Para poupança, o resgate mostra o saldo disponível (soma dos lotes)
- Adicionar indicação de quantos lotes serão consumidos no resgate

---

## 5. Plano de Implementação

### Etapa 1 — Infraestrutura (banco + engine básico)

- Criar tabela `poupanca_lotes` e `historico_selic` via migration
- Inserir categoria "Poupança" e produto "Poupança"
- Criar `src/lib/poupancaEngine.ts` com cálculo de rendimento mensal
- Integrar busca de Selic na edge function `daily-market-sync`

### Etapa 2 — Cadastro e Movimentações

- Adaptar `CadastrarTransacaoPage` para categoria Poupança (formulário simplificado)
- Adaptar `syncEngine.ts` para criar lotes em `poupanca_lotes` ao inserir movimentação de Poupança
- Implementar lógica FIFO no resgate

### Etapa 3 — Visualização

- Integrar poupança em `PosicaoConsolidadaPage` (cálculo via engine)
- Integrar em `CarteiraRendaFixaPage` (ou criar `CarteiraGeralPage`)
- Adaptar `AnaliseIndividualPage` para exibir dados de poupança
- Adaptar `BoletaCustodiaDialog` para resgate FIFO

### Etapa 4 — Carteira Consolidada

- Incluir rows da poupança no cálculo TWR da carteira
- Ajustar `CalculadoraPage` para suportar poupança

---

## 6. Riscos e Pontos de Atenção

### Cálculo

- **Dia 29/30/31**: Lotes criados nesses dias precisam de ajuste para meses curtos (fevereiro → dia 28). Usar regra: `Math.min(dia_aniversario, ultimo_dia_do_mes)`
- **TR diferente de zero**: MVP assume TR = 0. Se a TR voltar a ser relevante, será necessário criar `historico_tr` e incorporar no cálculo
- **Selic retroativa**: A taxa Selic pode mudar no meio do mês. O rendimento deve usar a Selic vigente na data do aniversário

### Divergências com apps de mercado

- Gorila e outros usam rendimento diário pró-rata para exibição — a Blueberg pode optar por mostrar o valor real (sem rendimento entre aniversários) com uma nota explicativa
- Alguns bancos creditam rendimento em D+1 do aniversário. Manter D+0 e documentar

### Performance

- A tabela `poupanca_lotes` pode crescer com muitas aplicações pequenas. Indexar por `(user_id, custodia_id, status)` para consultas eficientes
- O engine da poupança é mais leve que o de renda fixa (sem cálculos de PU diário), então não deve impactar performance

### Integridade

- O `syncEngine` precisa de um branch separado para Poupança: não deve tentar calcular PU, cotas ou multiplicador
- A `BoletaCustodiaDialog` precisa saber que poupança usa FIFO e não tem saldo único simples

---

## Detalhes Técnicos

### Arquivos a criar

- `src/lib/poupancaEngine.ts` — engine de cálculo
- Migration SQL para `poupanca_lotes`, `historico_selic`, insert de categoria/produto

### Arquivos a modificar

- `src/pages/CadastrarTransacaoPage.tsx` — formulário condicional
- `src/lib/syncEngine.ts` — branch para criar/consumir lotes
- `src/pages/PosicaoConsolidadaPage.tsx` — integrar engine poupança
- `src/pages/CarteiraRendaFixaPage.tsx` — incluir poupança no TWR
- `src/pages/AnaliseIndividualPage.tsx` — suporte a visualização
- `src/components/BoletaCustodiaDialog.tsx` — resgate FIFO
- `src/pages/CalculadoraPage.tsx` — suporte a poupança
- `supabase/functions/daily-market-sync/index.ts` — fetch Selic

### API Selic

- Fonte: BCB série 432 (`https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados?formato=json`)
- Retorna `{ data: "DD/MM/YYYY", valor: "X.XX" }` com a meta Selic vigente

A poupança também deve ser exibida na calculadora
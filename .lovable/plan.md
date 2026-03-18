

## Plano: Checkbox "Fechar Posição" na Boleta + Regra resgate_total

### 1. Boleta de Resgate (`src/components/BoletaCustodiaDialog.tsx`)

**Novo checkbox "Fechar Posição"** (visivel apenas quando `tipo === "Resgate"` e `saldoDisponivel` calculado):

- Estado `fecharPosicao: boolean`
- Ao marcar: preencher automaticamente o campo valor com `saldoDisponivel` formatado, desabilitar edição do campo valor
- Ao desmarcar: limpar valor, reabilitar edição
- Ao digitar valor manualmente: se `parseCurrencyToNumber(valor) === saldoDisponivel` (com tolerância de centavos), marcar o checkbox automaticamente
- No submit: se `fecharPosicao === true`, usar `tipo_movimentacao: "Resgate Total"` em vez de `"Resgate"`
- Incluir "Resgate Total" na validação de saldo (valor deve ser igual ao saldo disponivel)
- Reset do checkbox no `handleClose` e ao trocar data

### 2. Regra `computeResgateTotal` (`src/lib/syncEngine.ts`)

Alterar a função `computeResgateTotal` (linha 136):

**Lógica atual** (incorreta): busca `tipo_movimentacao = "Fechar Posição"`

**Nova lógica**:
1. Buscar movimentações com `tipo_movimentacao = "Resgate Total"` para o `codigo_custodia`
2. Se encontrar: retornar a `data` da mais recente (`order desc, limit 1`)
3. Se não encontrar: retornar `vencimento` (data de vencimento do titulo)

### 3. Inclusão de "Resgate Total" como resgate no sync

Em `syncCustodiaFromMovimentacao` (linha 214), adicionar "Resgate Total" ao array de tipos de resgate para calculo de `valorInvestidoLiquido`.

### 4. Engine de Renda Fixa (`src/lib/rendaFixaEngine.ts`)

Adicionar "Resgate Total" ao `buildMovMap` como fluxo de saída (resgate), junto com "Resgate" e "Resgate no Vencimento".

### Arquivos afetados
- `src/components/BoletaCustodiaDialog.tsx` — checkbox + logica de auto-fill e tipo_movimentacao
- `src/lib/syncEngine.ts` — `computeResgateTotal` e `valorInvestidoLiquido`
- `src/lib/rendaFixaEngine.ts` — `buildMovMap`


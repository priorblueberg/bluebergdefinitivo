

# Correção do Lookup da Série 195 no Engine de Poupança

## Diagnóstico Confirmado

A Série 195 do BCB é indexada pela **data de início do ciclo** (data do depósito), não pela data do aniversário. Cada registro significa: "um depósito feito nesta data rende X% no próximo mês".

Exemplo concreto:
- Aplicação em 02/01/2024 → taxa correta está em `2024-01-02` = **0,617%**
- O código atual busca em `2024-02-02` (data do aniversário) = **0,5083%**
- Isso explica a divergência: 100.000 × 0,617% = 617,00 (Gorila) vs 100.000 × 0,5083% = 508,30 (Blueberg)

## Mudança Necessária

**Arquivo:** `src/lib/poupancaEngine.ts`

### Lógica atual (errada)
No dia do aniversário, busca Série 195 pela própria data do aniversário:
```
const serie195 = poupRendMap.get(dataTeoricaAniversario)
```

### Lógica correta
Buscar pela **data de início do ciclo**, que é:
- Para o primeiro ciclo: a data de aplicação do lote
- Para ciclos subsequentes: o aniversário anterior (= início do ciclo atual)

```
// Início do ciclo = último aniversário (ou data aplicação se primeiro ciclo)
const dataInicioCiclo = lote.ultimoAniversario ?? lote.dataAplicacao;
const serie195 = poupRendMap.get(dataInicioCiclo);
```

### Fallback (Selic + TR)
Mesma correção: buscar Selic e TR pela data de início do ciclo, não pela data do aniversário.

### Atualização do teste
Atualizar `src/test/poupancaEngine.test.ts` para refletir que o lookup usa a data de início do ciclo.

## O que NÃO muda
- FIFO, resgate, estrutura de lotes — intactos
- Regra de aniversário (dias 29-31 → dia 1) — intacta
- `getDiaAniversarioPoupanca`, `getDataTeóricaAniversario` — intactas
- `buildPoupancaLotesFromMovs` — intacta

## Validação
- Aplicação 02/01/2024 com 100.000
- No aniversário 02/02/2024: lookup em `2024-01-02` → 0,617% → rendimento = 617,00
- Saldo esperado: **100.617,00** (alinhado com Gorila)

## Arquivos alterados
1. `src/lib/poupancaEngine.ts` — lookup por `dataInicioCiclo` em vez de `dataTeoricaAniversario`
2. `src/test/poupancaEngine.test.ts` — ajuste dos dados de teste


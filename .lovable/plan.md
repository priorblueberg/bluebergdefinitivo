

# Ajustes na Calculadora: ordem de colunas, casas decimais e congelamento de painéis

## 1. Inverter ordem das colunas

Ordem atual (linhas 35-37 header, 85-97 body):
- R$ Rent. Acumulada
- **Rent. Acum (2)** (azul)
- **% Rent. Acumulada**

Nova ordem:
- R$ Rent. Acumulada
- **% Rent. Acumulada**
- **Rent. Acum (2)** (azul)

Mesma inversão no body.

## 2. Duas casas decimais (sem arredondar) nas colunas novas

- **Rent. Diária (%)**: trocar `.toFixed(4)` → `.toFixed(2)` (linha 82)
- **Rent. Acum (2)**: trocar `.toFixed(4)` → `.toFixed(2)` (linha 90)

Nota: `toFixed(2)` trunca a exibição em 2 casas. A precisão interna permanece intacta.

## 3. Congelar painéis (sticky header + coluna Data)

**Arquivo:** `src/components/CalculadoraTable.tsx`

- A coluna "Data" ficará fixa à esquerda (`sticky left-0 z-20`) tanto no header quanto no body
- O header já é `sticky top-0 z-10` — a célula "Data" no header terá `z-30` (interseção)
- O container externo já tem `overflow-auto` e `max-h-[75vh]`, o que permite scroll horizontal e vertical

Técnica CSS:
- Header cells: `sticky top-0`
- Data column (header): `sticky left-0 top-0 z-30`
- Data column (body): `sticky left-0 z-20 bg-background`

## Resumo de alterações

Apenas o arquivo `src/components/CalculadoraTable.tsx` será modificado. Zero impacto no engine ou em outras colunas.


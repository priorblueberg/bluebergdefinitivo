

## Plano: Tabela de Rentabilidade com expansivel

### Como funciona hoje
O componente `RentabilidadeDetailTable` renderiza todas as tabelas anuais empilhadas (uma por ano), todas visíveis de uma vez. Os dados já vêm ordenados do ano mais recente para o mais antigo.

### Como ficará

```text
┌─────────────────────────────────────────────────────┐
│ Tabela de Rentabilidade — 2024                      │
│ Rentabilidade mensal e acumulada                    │
│ ┌─────┬─────┬─────┬───┬─────┬────────┐             │
│ │ 2024│ JAN │ FEV │...│ DEZ │ No Ano │             │
│ ├─────┼─────┼─────┼───┼─────┼────────┤             │
│ │Patr.│ R$  │ R$  │...│ R$  │   —    │             │
│ │Ganho│ R$  │ R$  │...│ R$  │  R$    │             │
│ │Rent.│ 1.2%│ 0.8%│...│  —  │  8.5%  │             │
│ │CDI  │ 0.9%│ 0.7%│...│  —  │  7.2%  │             │
│ └─────┴─────┴─────┴───┴─────┴────────┘             │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ ▶ Anos anteriores                                   │
│   (clique para expandir)                            │
│                                                     │
│   Quando expandido:                                 │
│   ▼ Anos anteriores                                 │
│   ┌─────────────────────────────────────────┐       │
│   │ Tabela de Rentabilidade — 2023          │       │
│   │ ...                                     │       │
│   └─────────────────────────────────────────┘       │
│   ┌─────────────────────────────────────────┐       │
│   │ Tabela de Rentabilidade — 2022          │       │
│   │ ...                                     │       │
│   └─────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────┘
```

### Alteração (1 arquivo)

**`src/components/RentabilidadeDetailTable.tsx`**
- Separar `rows[0]` (ano mais recente) dos demais (`rows.slice(1)`).
- Renderizar o primeiro ano normalmente (sempre visível).
- Se houver mais anos, envolver os restantes em um `Collapsible` (já existente em `@/components/ui/collapsible`) com um trigger "Anos anteriores" com ícone chevron.
- O collapsible inicia fechado por padrão.
- Nenhuma alteração nas páginas consumidoras (`CarteiraRendaFixaPage` e `AnaliseIndividualPage`), pois a mudança é interna ao componente.


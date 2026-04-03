

## Diagnóstico: Arredondamento do CDI Diário no Pós Fixado

### Causa raiz

A correção anterior removeu o `.toFixed(8)` do `cdiDiarioVal` globalmente para corrigir o título Mista. Porém, para **Pós Fixado CDI**, a convenção de mercado (B3/CETIP) é trabalhar com o CDI Diário **truncado/arredondado para 8 casas decimais**. Ao remover o truncamento para todos os produtos, o Pós Fixado passou a usar precisão excessiva, gerando 1 centavo de diferença acumulada.

### Correção proposta

**Arquivo: `src/lib/rendaFixaEngine.ts`** — linha ~307-309

Aplicar o arredondamento de 8 casas **apenas** no cálculo do multiplicador Pós Fixado, mantendo precisão total para Mista:

```typescript
// ANTES (linha 307-309):
} else if (isPosFixadoCDI) {
  const prevCdiDiario = rows.length > 0 ? rows[rows.length - 1].cdiDiario : 0;
  dailyMult = diaUtil ? prevCdiDiario * (taxa / 100) : 0;
}

// DEPOIS:
} else if (isPosFixadoCDI) {
  const prevCdiDiario = rows.length > 0 ? rows[rows.length - 1].cdiDiario : 0;
  const cdiArredondado = parseFloat(prevCdiDiario.toFixed(8));
  dailyMult = diaUtil ? cdiArredondado * (taxa / 100) : 0;
}
```

### Impacto
- O `cdiDiarioVal` continua com precisão total (float64) — necessário para Mista
- Apenas o multiplicador Pós Fixado aplica truncamento de 8 casas no CDI, seguindo a convenção de mercado
- Mista não é afetada (usa `prevCdiDiario` sem truncamento)
- Alteração de 1 linha em `rendaFixaEngine.ts`


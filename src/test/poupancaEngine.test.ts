import { describe, expect, it } from "vitest";

import { buildPoupancaLotesFromMovs, calcularPoupancaDiario } from "@/lib/poupancaEngine";

describe("poupancaEngine", () => {
  it("busca a Série 195 pela data de início do ciclo, não pela data do aniversário", () => {
    const rows = calcularPoupancaDiario({
      dataInicio: "2024-01-02",
      dataCalculo: "2024-02-02",
      calendario: [
        { data: "2024-01-02", dia_util: true },
        { data: "2024-02-01", dia_util: true },
        { data: "2024-02-02", dia_util: true },
      ],
      movimentacoes: [{ data: "2024-01-02", tipo_movimentacao: "Aplicação Inicial", valor: 100000 }],
      lotes: buildPoupancaLotesFromMovs([
        { data: "2024-01-02", tipo_movimentacao: "Aplicação Inicial", valor: 100000 },
      ]),
      selicRecords: [],
      trRecords: [],
      poupancaRendimentoRecords: [
        { data: "2024-01-02", rendimento_mensal: 0.617 }, // taxa do ciclo (início)
        { data: "2024-02-02", rendimento_mensal: 0.5083 }, // taxa errada se usada
      ],
    });

    const row = rows.find((r) => r.data === "2024-02-02");
    expect(row?.ganhoDiario).toBeCloseTo(617, 2);
    expect(row?.liquido).toBeCloseTo(100617, 0);
  });

  it("não carrega TR/Selic anteriores quando faltam dados exatos no fallback", () => {
    const rows = calcularPoupancaDiario({
      dataInicio: "2025-11-09",
      dataCalculo: "2025-12-09",
      calendario: [
        { data: "2025-11-09", dia_util: true },
        { data: "2025-12-08", dia_util: true },
        { data: "2025-12-09", dia_util: true },
      ],
      movimentacoes: [{ data: "2025-11-09", tipo_movimentacao: "Aplicação Inicial", valor: 10000 }],
      lotes: buildPoupancaLotesFromMovs([
        { data: "2025-11-09", tipo_movimentacao: "Aplicação Inicial", valor: 10000 },
      ]),
      selicRecords: [{ data: "2025-12-08", taxa_anual: 15 }],
      trRecords: [{ data: "2025-12-08", taxa_mensal: 0.17 }],
      poupancaRendimentoRecords: [],
    });

    // Fallback busca na data de início do ciclo (2025-11-09), não existe → rendimento = 0
    expect(rows.find((row) => row.data === "2025-12-09")?.ganhoDiario).toBe(0);
    expect(rows.find((row) => row.data === "2025-12-09")?.liquido).toBe(10000);
  });

  it("normaliza o aniversário para dia 1 em aplicações nos dias 29, 30 e 31", () => {
    const lotes = buildPoupancaLotesFromMovs([
      { data: "2025-01-28", tipo_movimentacao: "Aplicação", valor: 1000 },
      { data: "2025-01-29", tipo_movimentacao: "Aplicação", valor: 1000 },
      { data: "2025-01-30", tipo_movimentacao: "Aplicação", valor: 1000 },
      { data: "2025-01-31", tipo_movimentacao: "Aplicação", valor: 1000 },
    ]);

    expect(lotes.map((lote) => lote.dia_aniversario)).toEqual([28, 1, 1, 1]);
  });

  it("usa fallback Selic+TR pela data de início do ciclo", () => {
    const rows = calcularPoupancaDiario({
      dataInicio: "2024-01-02",
      dataCalculo: "2024-02-02",
      calendario: [
        { data: "2024-01-02", dia_util: true },
        { data: "2024-02-02", dia_util: true },
      ],
      movimentacoes: [{ data: "2024-01-02", tipo_movimentacao: "Aplicação Inicial", valor: 100000 }],
      lotes: buildPoupancaLotesFromMovs([
        { data: "2024-01-02", tipo_movimentacao: "Aplicação Inicial", valor: 100000 },
      ]),
      selicRecords: [{ data: "2024-01-02", taxa_anual: 11.75 }],
      trRecords: [{ data: "2024-01-02", taxa_mensal: 0.17 }],
      poupancaRendimentoRecords: [],
    });

    const row = rows.find((r) => r.data === "2024-02-02");
    // Selic > 8.5 → 0.5% + TR(0.17%) → ~0.6709%
    expect(row?.ganhoDiario).toBeGreaterThan(0);
    expect(row?.liquido).toBeGreaterThan(100000);
  });
});

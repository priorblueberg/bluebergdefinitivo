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

  it("aplicação em dia 29 não rende no primeiro dia 1, só no segundo", () => {
    const rows = calcularPoupancaDiario({
      dataInicio: "2024-01-29",
      dataCalculo: "2024-03-01",
      calendario: [
        { data: "2024-01-29", dia_util: true },
        { data: "2024-02-01", dia_util: true },
        { data: "2024-03-01", dia_util: true },
      ],
      movimentacoes: [{ data: "2024-01-29", tipo_movimentacao: "Aplicação Inicial", valor: 100000 }],
      lotes: buildPoupancaLotesFromMovs([
        { data: "2024-01-29", tipo_movimentacao: "Aplicação Inicial", valor: 100000 },
      ]),
      selicRecords: [],
      trRecords: [],
      poupancaRendimentoRecords: [
        { data: "2024-02-01", rendimento_mensal: 0.5079 },
      ],
    });

    // 01/02 NÃO deve ter rendimento (ciclo incompleto)
    expect(rows.find((r) => r.data === "2024-02-01")?.ganhoDiario).toBe(0);
    // 01/03 DEVE ter rendimento — taxa buscada pela data efetiva do ciclo (01/02)
    expect(rows.find((r) => r.data === "2024-03-01")?.ganhoDiario).toBeGreaterThan(0);
    expect(rows.find((r) => r.data === "2024-03-01")?.liquido).toBeCloseTo(100507.9, 0);
  });

  it("aplicação em dia 30 não rende no primeiro dia 1, só no segundo", () => {
    const rows = calcularPoupancaDiario({
      dataInicio: "2024-01-30",
      dataCalculo: "2024-03-01",
      calendario: [
        { data: "2024-01-30", dia_util: true },
        { data: "2024-02-01", dia_util: true },
        { data: "2024-03-01", dia_util: true },
      ],
      movimentacoes: [{ data: "2024-01-30", tipo_movimentacao: "Aplicação Inicial", valor: 100000 }],
      lotes: buildPoupancaLotesFromMovs([
        { data: "2024-01-30", tipo_movimentacao: "Aplicação Inicial", valor: 100000 },
      ]),
      selicRecords: [],
      trRecords: [],
      poupancaRendimentoRecords: [
        { data: "2024-02-01", rendimento_mensal: 0.5079 },
      ],
    });

    expect(rows.find((r) => r.data === "2024-02-01")?.ganhoDiario).toBe(0);
    expect(rows.find((r) => r.data === "2024-03-01")?.ganhoDiario).toBeGreaterThan(0);
  });

  it("aplicação em dia 31 não rende no primeiro dia 1, só no segundo", () => {
    const rows = calcularPoupancaDiario({
      dataInicio: "2024-01-31",
      dataCalculo: "2024-03-01",
      calendario: [
        { data: "2024-01-31", dia_util: true },
        { data: "2024-02-01", dia_util: true },
        { data: "2024-03-01", dia_util: true },
      ],
      movimentacoes: [{ data: "2024-01-31", tipo_movimentacao: "Aplicação Inicial", valor: 100000 }],
      lotes: buildPoupancaLotesFromMovs([
        { data: "2024-01-31", tipo_movimentacao: "Aplicação Inicial", valor: 100000 },
      ]),
      selicRecords: [],
      trRecords: [],
      poupancaRendimentoRecords: [
        { data: "2024-02-01", rendimento_mensal: 0.5079 },
      ],
    });

    expect(rows.find((r) => r.data === "2024-02-01")?.ganhoDiario).toBe(0);
    expect(rows.find((r) => r.data === "2024-03-01")?.ganhoDiario).toBeGreaterThan(0);
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

  it("consolida lotes após resgate parcial em um único lote com dia do mais antigo", () => {
    const movs = [
      { data: "2024-01-02", tipo_movimentacao: "Aplicação Inicial", valor: 100000 },
      { data: "2024-01-10", tipo_movimentacao: "Aplicação", valor: 50000 },
      { data: "2024-02-20", tipo_movimentacao: "Resgate", valor: 80000 },
    ];
    const lotes = buildPoupancaLotesFromMovs(movs);

    // Taxas: uma por ciclo
    const poupancaRendimentoRecords = [
      { data: "2024-01-02", rendimento_mensal: 0.617 },
      { data: "2024-01-10", rendimento_mensal: 0.617 },
      { data: "2024-02-02", rendimento_mensal: 0.5 },
      { data: "2024-03-02", rendimento_mensal: 0.5 },
    ];

    const calendario: { data: string; dia_util: boolean }[] = [];
    const start = new Date("2024-01-02T00:00:00");
    const end = new Date("2024-04-02T00:00:00");
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      calendario.push({ data: d.toISOString().slice(0, 10), dia_util: true });
    }

    const rows = calcularPoupancaDiario({
      dataInicio: "2024-01-02",
      dataCalculo: "2024-04-02",
      calendario,
      movimentacoes: movs,
      lotes,
      selicRecords: [],
      trRecords: [],
      poupancaRendimentoRecords,
    });

    // Após resgate em 20/02, ambos os lotes devem ter sido consolidados.
    // Lote A (dia 2): rendeu em 02/02 → 100.617. Resgate 80.000 → sobra 20.617.
    // Lote B (dia 10): rendeu em 10/02 → 50.308,50.
    // Consolidação: 20.617 + 50.308,50 = 70.925,50 no dia de aniversário 2.
    // 02/03: rendimento sobre 70.925,50 com taxa 0.5% → +354,6275
    // Verificar que dia 10/03 NÃO tem rendimento (lote B foi consolidado)
    const mar10 = rows.find(r => r.data === "2024-03-10");
    expect(mar10?.ganhoDiario).toBe(0); // Lote B não existe mais

    // 02/03 deve ter rendimento (lote consolidado)
    const mar02 = rows.find(r => r.data === "2024-03-02");
    expect(mar02?.ganhoDiario).toBeGreaterThan(0);
    // 70925.50 * 0.5/100 = 354.6275
    expect(mar02?.ganhoDiario).toBeCloseTo(354.6275, 1);

    // 02/04: rendimento sobre (70925.50 + 354.6275) = 71280.1275 com taxa 0.5%
    const apr02 = rows.find(r => r.data === "2024-04-02");
    expect(apr02?.ganhoDiario).toBeGreaterThan(0);
    expect(apr02?.ganhoDiario).toBeCloseTo(71280.1275 * 0.005, 1);
  });
});

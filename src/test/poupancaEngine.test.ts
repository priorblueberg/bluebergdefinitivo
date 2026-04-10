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

  it("consolida lotes após resgate parcial (Teste 12 — paridade Gorila)", () => {
    // Cenário: 2 aplicações + 1 resgate parcial
    // Após resgate, lotes devem ser consolidados em um único com dia_aniversario = 2
    const movs = [
      { data: "2024-01-02", tipo_movimentacao: "Aplicação Inicial", valor: 100000 },
      { data: "2024-01-10", tipo_movimentacao: "Aplicação", valor: 50000 },
      { data: "2024-02-20", tipo_movimentacao: "Resgate", valor: 80000 },
    ];
    const lotes = buildPoupancaLotesFromMovs(movs);

    // Taxas série 195 para todos os ciclos necessários (dia 2 de cada mês)
    const poupancaRendimentoRecords = [
      { data: "2024-01-02", rendimento_mensal: 0.617 },
      { data: "2024-01-10", rendimento_mensal: 0.617 },
      { data: "2024-02-02", rendimento_mensal: 0.5083 },
      { data: "2024-03-02", rendimento_mensal: 0.5975 },
      { data: "2024-04-02", rendimento_mensal: 0.5928 },
      { data: "2024-05-02", rendimento_mensal: 0.5374 },
      { data: "2024-06-02", rendimento_mensal: 0.5399 },
      { data: "2024-07-02", rendimento_mensal: 0.5577 },
      { data: "2024-08-02", rendimento_mensal: 0.5696 },
      { data: "2024-09-02", rendimento_mensal: 0.5656 },
      { data: "2024-10-02", rendimento_mensal: 0.5765 },
      { data: "2024-11-02", rendimento_mensal: 0.5203 },
      { data: "2024-12-02", rendimento_mensal: 0.5327 },
      { data: "2025-01-02", rendimento_mensal: 0.5458 },
      { data: "2025-02-02", rendimento_mensal: 0.6054 },
      { data: "2025-03-02", rendimento_mensal: 0.5246 },
      { data: "2025-04-02", rendimento_mensal: 0.5612 },
      { data: "2025-05-02", rendimento_mensal: 0.6219 },
      { data: "2025-06-02", rendimento_mensal: 0.627 },
      { data: "2025-07-02", rendimento_mensal: 0.5995 },
      { data: "2025-08-02", rendimento_mensal: 0.6253 },
      { data: "2025-09-02", rendimento_mensal: 0.5848 },
      { data: "2025-10-02", rendimento_mensal: 0.5887 },
      { data: "2025-11-02", rendimento_mensal: 0.5421 },
      { data: "2025-12-02", rendimento_mensal: 0.5649 },
    ];

    // Gerar calendário completo de 02/01/2024 a 30/12/2025
    const calendario: { data: string; dia_util: boolean }[] = [];
    const start = new Date("2024-01-02T00:00:00");
    const end = new Date("2025-12-30T00:00:00");
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      calendario.push({
        data: d.toISOString().slice(0, 10),
        dia_util: true,
      });
    }

    const rows = calcularPoupancaDiario({
      dataInicio: "2024-01-02",
      dataCalculo: "2025-12-30",
      calendario,
      movimentacoes: movs,
      lotes,
      selicRecords: [],
      trRecords: [],
      poupancaRendimentoRecords,
    });

    const last = rows[rows.length - 1];
    // Gorila: 81.166,42
    expect(last.liquido).toBeCloseTo(81166.42, 0);
    expect(last.ganhoAcumulado).toBeCloseTo(11166.42, 0);
  });
});

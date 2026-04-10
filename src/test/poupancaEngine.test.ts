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

  it("consolida lotes após resgate parcial usando aniversário dominante (dia da 1ª aplicação)", () => {
    const movs = [
      { data: "2024-01-02", tipo_movimentacao: "Aplicação Inicial", valor: 100000 },
      { data: "2024-01-10", tipo_movimentacao: "Aplicação", valor: 50000 },
      { data: "2024-02-20", tipo_movimentacao: "Resgate", valor: 80000 },
    ];
    const lotes = buildPoupancaLotesFromMovs(movs);

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

    // Antes do resgate, cada lote mantém seu aniversário original (efeito prospectivo).
    // 02/02: apenas lote A (100.000 * 0.617%) = 617
    const feb02 = rows.find(r => r.data === "2024-02-02");
    expect(feb02?.ganhoDiario).toBeCloseTo(617, 1);

    // 10/02: apenas lote B (50.000 * 0.617%) = 308.5
    const feb10 = rows.find(r => r.data === "2024-02-10");
    expect(feb10?.ganhoDiario).toBeCloseTo(308.5, 1);

    // Após resgate em 20/02, consolidação aplica aniversário dominante dia 2
    // 02/03 deve ter rendimento (lote consolidado no dia 2)
    const mar02 = rows.find(r => r.data === "2024-03-02");
    expect(mar02?.ganhoDiario).toBeGreaterThan(0);

    // 10/03: NÃO deve ter rendimento (pós-consolidação, só dia 2)
    const mar10 = rows.find(r => r.data === "2024-03-10");
    expect(mar10?.ganhoDiario).toBe(0);
  });

  it("Teste 13: resgate que zera lote mais antigo mantém aniversário dominante", () => {
    // 02/01 → Aplicação Inicial 100.000 (lote A, dia 2)
    // 10/01 → Aplicação 50.000 (lote B, dia 10)
    // 20/02 → Resgate 100.617 (zera lote A após rendimento)
    // Esperado: posição continua com aniversário dia 2 (dominante)
    const movs = [
      { data: "2024-01-02", tipo_movimentacao: "Aplicação Inicial", valor: 100000 },
      { data: "2024-01-10", tipo_movimentacao: "Aplicação", valor: 50000 },
      { data: "2024-02-20", tipo_movimentacao: "Resgate", valor: 100617 },
    ];
    const lotes = buildPoupancaLotesFromMovs(movs);

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

    // 02/02: ambos lotes rendem no dia 2 (dominante)
    const feb02 = rows.find(r => r.data === "2024-02-02");
    expect(feb02?.ganhoDiario).toBeCloseTo(617 + 308.5, 1);

    // 10/02: sem rendimento (dia 10 não é aniversário dominante)
    const feb10 = rows.find(r => r.data === "2024-02-10");
    expect(feb10?.ganhoDiario).toBe(0);

    // Após resgate de 100.617: lote A zerado, lote B (50.308,50) permanece
    // Aniversário dominante continua dia 2
    // 02/03: rendimento sobre ~50.308,50 com taxa 0.5%
    const mar02 = rows.find(r => r.data === "2024-03-02");
    expect(mar02?.ganhoDiario).toBeGreaterThan(0);
    expect(mar02?.ganhoDiario).toBeCloseTo(50308.5 * 0.005, 1);

    // 10/03: sem rendimento (dia 10 nunca é usado)
    const mar10 = rows.find(r => r.data === "2024-03-10");
    expect(mar10?.ganhoDiario).toBe(0);
  });
});

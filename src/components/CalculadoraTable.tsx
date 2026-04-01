import { DailyRow } from "@/lib/rendaFixaEngine";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Props {
  rows: DailyRow[];
}

export default function CalculadoraTable({ rows }: Props) {
  return (
    <div className="rounded-md border border-border overflow-auto max-h-[75vh]">
      <Table>
        <TableHeader className="sticky top-0 z-10">
          <TableRow className="bg-muted">
            <TableHead className="text-xs whitespace-nowrap bg-muted">Data</TableHead>
            <TableHead className="text-xs whitespace-nowrap text-center bg-muted">Dia Útil</TableHead>
            <TableHead className="text-xs whitespace-nowrap text-right bg-muted">Valor da Cota (1)</TableHead>
            <TableHead className="text-xs whitespace-nowrap text-right bg-muted">Saldo de Cotas (1)</TableHead>
            <TableHead className="text-xs whitespace-nowrap text-right bg-muted">Líquido (1)</TableHead>
            <TableHead className="text-xs whitespace-nowrap text-right bg-muted">Valor da Cota (2)</TableHead>
            <TableHead className="text-xs whitespace-nowrap text-right bg-muted">Saldo de Cotas (2)</TableHead>
            <TableHead className="text-xs whitespace-nowrap text-right bg-muted">Líquido (2)</TableHead>
            <TableHead className="text-xs whitespace-nowrap text-right bg-muted">Aplicações</TableHead>
            <TableHead className="text-xs whitespace-nowrap text-right bg-muted">QTD Cotas (Compra)</TableHead>
            <TableHead className="text-xs whitespace-nowrap text-right bg-muted">Resgate</TableHead>
            <TableHead className="text-xs whitespace-nowrap text-right bg-muted">QTD Cotas (Resgate)</TableHead>
            <TableHead className="text-xs whitespace-nowrap text-right bg-muted">Rent. Diária (R$)</TableHead>
            <TableHead className="text-xs whitespace-nowrap text-right bg-muted">R$ Rent. Acumulada</TableHead>
            <TableHead className="text-xs whitespace-nowrap text-right bg-muted">% Rent. Acumulada</TableHead>
            <TableHead className="text-xs whitespace-nowrap text-right bg-muted">CDI Diário</TableHead>
            <TableHead className="text-xs whitespace-nowrap text-right bg-muted">Multiplicador</TableHead>
            <TableHead className="text-xs whitespace-nowrap text-center bg-muted">Pgto Juros</TableHead>
            <TableHead className="text-xs whitespace-nowrap text-right bg-muted">Apoio Cupom</TableHead>
            <TableHead className="text-xs whitespace-nowrap text-right bg-muted">Cupom Acumulado</TableHead>
            <TableHead className="text-xs whitespace-nowrap text-right bg-muted">Juros Pago</TableHead>
            <TableHead className="text-xs whitespace-nowrap text-right bg-muted">Valor Investido</TableHead>
            <TableHead className="text-xs whitespace-nowrap text-right bg-muted">Resgate Limpo</TableHead>
            <TableHead className="text-xs whitespace-nowrap text-right bg-muted">Preço Unitário</TableHead>
            <TableHead className="text-xs whitespace-nowrap text-right bg-muted">QTD Aplicação</TableHead>
            <TableHead className="text-xs whitespace-nowrap text-right bg-muted">QTD Resgate</TableHead>
            <TableHead className="text-xs whitespace-nowrap text-right bg-muted">PU Juros Periódicos</TableHead>
            <TableHead className="text-xs whitespace-nowrap text-right bg-muted">QTD Aplicação (2)</TableHead>
            <TableHead className="text-xs whitespace-nowrap text-right bg-muted">QTD Resgate (2)</TableHead>
            <TableHead className="text-xs whitespace-nowrap text-right bg-muted bg-green-50 dark:bg-green-950">Base Econômica</TableHead>
            <TableHead className="text-xs whitespace-nowrap text-right bg-muted bg-green-50 dark:bg-green-950">Aplicação Ex Cupom</TableHead>
            <TableHead className="text-xs whitespace-nowrap text-right bg-muted bg-green-50 dark:bg-green-950">Resgate Ex Cupom</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={r.data} className={i % 2 === 0 ? "" : "bg-muted/30"}>
              <TableCell className="text-xs whitespace-nowrap">{formatDate(r.data)}</TableCell>
              <TableCell className="text-xs text-center">{r.diaUtil ? "Sim" : "Não"}</TableCell>
              <TableCell className="text-xs text-right font-mono">{fmt(r.valorCota, 2)}</TableCell>
              <TableCell className="text-xs text-right font-mono">{fmt(r.saldoCotas, 2)}</TableCell>
              <TableCell className="text-xs text-right font-mono">{fmtCurrency(r.liquido)}</TableCell>
              <TableCell className="text-xs text-right font-mono">{fmt(r.valorCota2, 2)}</TableCell>
              <TableCell className="text-xs text-right font-mono">{fmt(r.saldoCotas2, 2)}</TableCell>
              <TableCell className="text-xs text-right font-mono">{fmtCurrency(r.liquido2)}</TableCell>
              <TableCell className="text-xs text-right font-mono">
                {r.aplicacoes > 0 ? fmtCurrency(r.aplicacoes) : "—"}
              </TableCell>
              <TableCell className="text-xs text-right font-mono">
                {r.qtdCotasCompra > 0 ? fmt(r.qtdCotasCompra, 6) : "—"}
              </TableCell>
              <TableCell className="text-xs text-right font-mono">
                {r.resgates > 0.01 ? fmtCurrency(r.resgates) : "—"}
              </TableCell>
              <TableCell className="text-xs text-right font-mono">
                {r.qtdCotasResgate > 0.001 ? fmt(r.qtdCotasResgate, 6) : "—"}
              </TableCell>
              <TableCell className="text-xs text-right font-mono">
                {Math.abs(r.ganhoDiario) > 0.001 ? fmtCurrency(r.ganhoDiario) : "—"}
              </TableCell>
              <TableCell className="text-xs text-right font-mono">
                {Math.abs(r.ganhoAcumulado) > 0.001 ? fmtCurrency(r.ganhoAcumulado) : "—"}
              </TableCell>
              <TableCell className="text-xs text-right font-mono">
                {Math.abs(r.rentabilidadeAcumuladaPct) > 0.00001
                  ? `${(r.rentabilidadeAcumuladaPct * 100).toFixed(2)}%`
                  : "—"}
              </TableCell>
              <TableCell className="text-xs text-right font-mono">
                {r.cdiDiario > 0 ? r.cdiDiario.toFixed(8) : "—"}
              </TableCell>
              <TableCell className="text-xs text-right font-mono">
                {r.multiplicador > 0 ? r.multiplicador.toFixed(8) : "—"}
              </TableCell>
              <TableCell className="text-xs text-center">
                {r.jurosPago > 0.01 ? "Sim" : ""}
              </TableCell>
              <TableCell className="text-xs text-right font-mono">
                {r.apoioCupom > 0.01 ? fmtCurrency(r.apoioCupom) : "—"}
              </TableCell>
              <TableCell className="text-xs text-right font-mono">
                {r.cupomAcumulado > 0.01 ? fmtCurrency(r.cupomAcumulado) : "—"}
              </TableCell>
              <TableCell className="text-xs text-right font-mono">
                {r.jurosPago > 0.01 ? fmtCurrency(r.jurosPago) : "—"}
              </TableCell>
              <TableCell className="text-xs text-right font-mono">
                {Math.abs(r.valorInvestido) > 0.01 ? fmtCurrency(r.valorInvestido) : "—"}
              </TableCell>
              <TableCell className="text-xs text-right font-mono">
                {Math.abs(r.resgateLimpo) > 0.01 ? fmtCurrency(r.resgateLimpo) : "—"}
              </TableCell>
              <TableCell className="text-xs text-right font-mono">
                {fmt(r.precoUnitario, 6)}
              </TableCell>
              <TableCell className="text-xs text-right font-mono">
                {r.qtdAplicacaoPU > 0.0000001 ? fmt(r.qtdAplicacaoPU, 7) : "—"}
              </TableCell>
              <TableCell className="text-xs text-right font-mono">
                {r.qtdResgatePU > 0.0000001 ? fmt(r.qtdResgatePU, 7) : "—"}
              </TableCell>
              <TableCell className="text-xs text-right font-mono">
                {fmt(r.puJurosPeriodicos, 6)}
              </TableCell>
              <TableCell className="text-xs text-right font-mono">
                {r.qtdAplicacao2 > 0.0000001 ? fmt(r.qtdAplicacao2, 7) : "—"}
              </TableCell>
              <TableCell className="text-xs text-right font-mono">
                {r.qtdResgate2 > 0.0000001 ? fmt(r.qtdResgate2, 7) : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function formatDate(d: string): string {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function fmt(v: number, decimals: number): string {
  return v.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtCurrency(v: number): string {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

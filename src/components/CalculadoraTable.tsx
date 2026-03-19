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
    <div className="rounded-md border border-border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="text-xs whitespace-nowrap">Data</TableHead>
            <TableHead className="text-xs whitespace-nowrap text-center">Dia Útil</TableHead>
            <TableHead className="text-xs whitespace-nowrap text-right">Valor da Cota (1)</TableHead>
            <TableHead className="text-xs whitespace-nowrap text-right">Saldo de Cotas (1)</TableHead>
            <TableHead className="text-xs whitespace-nowrap text-right">Líquido (1)</TableHead>
            <TableHead className="text-xs whitespace-nowrap text-right">Valor da Cota (2)</TableHead>
            <TableHead className="text-xs whitespace-nowrap text-right">Saldo de Cotas (2)</TableHead>
            <TableHead className="text-xs whitespace-nowrap text-right">Líquido (2)</TableHead>
            <TableHead className="text-xs whitespace-nowrap text-right">Aplicações</TableHead>
            <TableHead className="text-xs whitespace-nowrap text-right">QTD Cotas (Compra)</TableHead>
            <TableHead className="text-xs whitespace-nowrap text-right">Resgate</TableHead>
            <TableHead className="text-xs whitespace-nowrap text-right">QTD Cotas (Resgate)</TableHead>
            <TableHead className="text-xs whitespace-nowrap text-right">Pgto Juros</TableHead>
            <TableHead className="text-xs whitespace-nowrap text-right">Rent. Diária</TableHead>
            <TableHead className="text-xs whitespace-nowrap text-right">Multiplicador</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={r.data} className={i % 2 === 0 ? "" : "bg-muted/30"}>
              <TableCell className="text-xs whitespace-nowrap">
                {formatDate(r.data)}
              </TableCell>
              <TableCell className="text-xs text-center">
                {r.diaUtil ? "Sim" : "Não"}
              </TableCell>
              <TableCell className="text-xs text-right font-mono">
                {fmt(r.valorCota, 2)}
              </TableCell>
              <TableCell className="text-xs text-right font-mono">
                {fmt(r.saldoCotas, 2)}
              </TableCell>
              <TableCell className="text-xs text-right font-mono">
                {fmtCurrency(r.liquido)}
              </TableCell>
              <TableCell className="text-xs text-right font-mono">
                {fmt(r.valorCota2, 2)}
              </TableCell>
              <TableCell className="text-xs text-right font-mono">
                {fmt(r.saldoCotas2, 2)}
              </TableCell>
              <TableCell className="text-xs text-right font-mono">
                {fmtCurrency(r.liquido2)}
              </TableCell>
              <TableCell className="text-xs text-right font-mono">
                {r.aplicacoes > 0 ? fmtCurrency(r.aplicacoes) : "—"}
              </TableCell>
              <TableCell className="text-xs text-right font-mono">
                {r.qtdCotasCompra > 0 ? fmt(r.qtdCotasCompra, 6) : "—"}
              </TableCell>
              <TableCell className="text-xs text-right font-mono">
                {r.resgates > 0 ? fmtCurrency(r.resgates) : "—"}
              </TableCell>
              <TableCell className="text-xs text-right font-mono">
                {r.qtdCotasResgate > 0 ? fmt(r.qtdCotasResgate, 6) : "—"}
              </TableCell>
              <TableCell className="text-xs text-right font-mono">
                {r.pagamentoJuros > 0 ? fmtCurrency(r.pagamentoJuros) : "—"}
              </TableCell>
              <TableCell className="text-xs text-right font-mono">
                {r.rentabilidadeDiaria != null
                  ? `${(r.rentabilidadeDiaria * 100).toFixed(2)}%`
                  : "—"}
              </TableCell>
              <TableCell className="text-xs text-right font-mono">
                {r.multiplicador > 0
                  ? r.multiplicador.toFixed(8)
                  : "—"}
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

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const MONTH_HEADERS = [
  "JAN", "FEV", "MAR", "ABR", "MAI", "JUN",
  "JUL", "AGO", "SET", "OUT", "NOV", "DEZ",
];

export interface DetailRow {
  year: number;
  patrimonioMonths: (number | null)[]; // 12 entries, R$ values
  rentabilidadeMonths: (number | null)[]; // 12 entries, % values
  cdiMonths: (number | null)[]; // 12 entries, % values
  rentNoAno: number | null;
  rentAcumulado: number | null;
  cdiNoAno: number | null;
  cdiAcumulado: number | null;
}

function fmtPct(v: number | null): string {
  if (v === null) return "—";
  return v.toFixed(2) + "%";
}

function fmtBrl(v: number | null): string {
  if (v === null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface Props {
  rows: DetailRow[];
  tituloLabel: string;
}

export default function RentabilidadeDetailTable({ rows, tituloLabel }: Props) {
  if (rows.length === 0) return null;

  return (
    <div className="space-y-6">
      {rows.map((row) => (
        <div key={row.year} className="rounded-md border border-border bg-card p-6">
          <h2 className="text-sm font-semibold text-foreground">
            Tabela de Rentabilidade — {row.year}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Rentabilidade mensal e acumulada
          </p>
          <div className="mt-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-semibold whitespace-nowrap">{row.year}</TableHead>
                  {MONTH_HEADERS.map((m) => (
                    <TableHead key={m} className="text-xs font-semibold text-center whitespace-nowrap">
                      {m}
                    </TableHead>
                  ))}
                  <TableHead className="text-xs font-semibold text-center whitespace-nowrap">No Ano</TableHead>
                  <TableHead className="text-xs font-semibold text-center whitespace-nowrap">Acumulado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Patrimônio row */}
                <TableRow>
                  <TableCell className="text-xs font-medium whitespace-nowrap">Patrimônio</TableCell>
                  {row.patrimonioMonths.map((v, i) => (
                    <TableCell key={i} className="text-xs text-center whitespace-nowrap">
                      {fmtBrl(v)}
                    </TableCell>
                  ))}
                  <TableCell className="text-xs text-center whitespace-nowrap">—</TableCell>
                  <TableCell className="text-xs text-center whitespace-nowrap">—</TableCell>
                </TableRow>

                {/* Rentabilidade row */}
                <TableRow>
                  <TableCell className="text-xs font-medium whitespace-nowrap">{tituloLabel}</TableCell>
                  {row.rentabilidadeMonths.map((v, i) => (
                    <TableCell key={i} className="text-xs text-center whitespace-nowrap">
                      {fmtPct(v)}
                    </TableCell>
                  ))}
                  <TableCell className="text-xs text-center font-medium whitespace-nowrap">
                    {fmtPct(row.rentNoAno)}
                  </TableCell>
                  <TableCell className="text-xs text-center font-medium whitespace-nowrap">
                    {fmtPct(row.rentAcumulado)}
                  </TableCell>
                </TableRow>

                {/* CDI row */}
                <TableRow>
                  <TableCell className="text-xs font-medium whitespace-nowrap">CDI</TableCell>
                  {row.cdiMonths.map((v, i) => (
                    <TableCell key={i} className="text-xs text-center whitespace-nowrap">
                      {fmtPct(v)}
                    </TableCell>
                  ))}
                  <TableCell className="text-xs text-center font-medium whitespace-nowrap">
                    {fmtPct(row.cdiNoAno)}
                  </TableCell>
                  <TableCell className="text-xs text-center font-medium whitespace-nowrap">
                    {fmtPct(row.cdiAcumulado)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      ))}
    </div>
  );
}

import { useState, useRef } from "react";
import { Download, Upload, FileSpreadsheet, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useDataReferencia } from "@/contexts/DataReferenciaContext";
import {
  generateTemplate,
  parseExcel,
  importTransactions,
  generateReturnExcel,
  type ImportRow,
  type ImportResult,
} from "@/lib/batchImport";
import * as XLSX from "xlsx";

export default function AdminPage() {
  const { user } = useAuth();
  const { dataReferenciaISO, applyDataReferencia } = useDataReferencia();
  const fileRef = useRef<HTMLInputElement>(null);

  const [parsedRows, setParsedRows] = useState<ImportRow[]>([]);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [fileName, setFileName] = useState("");

  const handleDownloadTemplate = () => {
    const wb = generateTemplate();
    XLSX.writeFile(wb, "modelo_transacoes.xlsx");
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResults([]);
    try {
      const buf = await file.arrayBuffer();
      const rows = parseExcel(buf);
      setParsedRows(rows);
    } catch (err: any) {
      setParsedRows([]);
      alert(err.message || "Erro ao ler arquivo.");
    }
    // Reset input so same file can be re-selected
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleImport = async () => {
    if (!user || parsedRows.length === 0) return;
    setImporting(true);
    setResults([]);
    setProgress({ done: 0, total: parsedRows.length });
    try {
      const res = await importTransactions(parsedRows, user.id, dataReferenciaISO, (done, total) => {
        setProgress({ done, total });
      });
      setResults(res);
      applyDataReferencia();
    } catch (err: any) {
      alert(err.message || "Erro na importação.");
    } finally {
      setImporting(false);
      setProgress(null);
    }
  };

  const handleDownloadReturn = () => {
    if (results.length === 0 || parsedRows.length === 0) return;
    const wb = generateReturnExcel(parsedRows, results);
    XLSX.writeFile(wb, "retorno_importacao.xlsx");
  };

  const successCount = results.filter((r) => r.status === "sucesso").length;
  const errorCount = results.filter((r) => r.status === "erro").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Admin</h1>
        <p className="text-xs text-muted-foreground">Ferramentas administrativas do sistema</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Template card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Modelo Excel
            </CardTitle>
            <CardDescription className="text-xs">
              Baixe o modelo para preencher transações em lote
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Baixar modelo
            </Button>
          </CardContent>
        </Card>

        {/* Import card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Importar Transações
            </CardTitle>
            <CardDescription className="text-xs">
              Selecione o arquivo preenchido e importe
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={importing}>
                Selecionar arquivo
              </Button>
              {fileName && <span className="text-xs text-muted-foreground truncate max-w-[200px]">{fileName}</span>}
            </div>

            {parsedRows.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{parsedRows.length} linha(s) encontrada(s)</span>
                <Button size="sm" onClick={handleImport} disabled={importing}>
                  {importing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {progress ? `${progress.done}/${progress.total}` : "Importando..."}
                    </>
                  ) : (
                    "Importar"
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm">Resultado da Importação</CardTitle>
                <CardDescription className="text-xs mt-1">
                  Total: {results.length} | 
                  <span className="text-green-600 ml-1">Sucesso: {successCount}</span> | 
                  <span className="text-destructive ml-1">Erro: {errorCount}</span>
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={handleDownloadReturn}>
                <Download className="h-4 w-4 mr-2" />
                Baixar retorno
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Linha</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Status</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Mensagem</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.linha} className="border-t border-border">
                      <td className="px-3 py-2 text-foreground">{r.linha}</td>
                      <td className="px-3 py-2">
                        {r.status === "sucesso" ? (
                          <span className="inline-flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="h-3 w-3" /> Sucesso
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-destructive">
                            <XCircle className="h-3 w-3" /> Erro
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-foreground">{r.mensagem}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fullSyncAfterMovimentacao } from "@/lib/syncEngine";
import { useDataReferencia } from "@/contexts/DataReferenciaContext";
import { toast } from "sonner";

const CATEGORIA_RENDA_FIXA = "47b2c6b5-8b20-48e8-9d05-4b9f52747dda";
const PRODUTO_CDB = "a56a5936-bf65-416f-b5f1-554a3ebb8406";
const INSTITUICAO_XP = "1d43339d-9901-4ec4-84b4-90b5d91cdcb7";
const EMISSOR_BANCO_B3 = "df84d3b5-227c-4a19-a236-b137d58bbf1f";

interface CdbLine {
  data: string;
  taxa: number;
  valor: number;
  vencimento: string;
  pagamento: string;
  pu: number;
}

const CDB_LINES: CdbLine[] = [
  { data: "2024-01-02", taxa: 12, valor: 10000, vencimento: "2025-12-30", pagamento: "No Vencimento", pu: 1000 },
  { data: "2024-01-09", taxa: 12, valor: 20000, vencimento: "2025-12-29", pagamento: "No Vencimento", pu: 1023.20 },
  { data: "2024-02-06", taxa: 13, valor: 30000, vencimento: "2025-11-25", pagamento: "Mensal", pu: 1000 },
  { data: "2024-02-22", taxa: 13, valor: 40000, vencimento: "2025-12-08", pagamento: "Mensal", pu: 1023.20 },
  { data: "2024-03-05", taxa: 14, valor: 50000, vencimento: "2024-12-30", pagamento: "Bimestral", pu: 1000 },
  { data: "2024-03-18", taxa: 14, valor: 60000, vencimento: "2025-05-05", pagamento: "Bimestral", pu: 1023.20 },
];

function formatVencimentoBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function buildNomeAtivo(taxa: number, vencimento: string): string {
  return `CDB Banco B3 Prefixado ${taxa}% a.a. - ${formatVencimentoBR(vencimento)}`;
}

function formatValorExtrato(valor: number, pu: number, qtd: number): string {
  const fmtBrl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return `${fmtBrl(valor)} (${fmtBrl(pu)} x ${qtd.toFixed(7)})`;
}

export default function AdminPage() {
  const { user } = useAuth();
  const { dataReferenciaISO, applyDataReferencia } = useDataReferencia();
  const [inserting, setInserting] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const addLog = (msg: string) => setLog((prev) => [...prev, msg]);

  const handleInsertCDBs = async () => {
    if (!user) {
      toast.error("Usuário não autenticado.");
      return;
    }

    setInserting(true);
    setLog([]);

    try {
      // Get current max codigo_custodia
      const { data: maxData } = await supabase
        .from("custodia")
        .select("codigo_custodia")
        .eq("user_id", user.id)
        .order("codigo_custodia", { ascending: false })
        .limit(1);

      let nextCodigo = (maxData?.[0]?.codigo_custodia ?? 0) + 1;
      addLog(`Código custódia inicial: ${nextCodigo}`);

      for (let i = 0; i < CDB_LINES.length; i++) {
        const line = CDB_LINES[i];
        const codigo = nextCodigo + i;
        const quantidade = line.valor / line.pu;
        const nomeAtivo = buildNomeAtivo(line.taxa, line.vencimento);
        const valorExtrato = formatValorExtrato(line.valor, line.pu, quantidade);

        addLog(`[${i + 1}/6] Inserindo: ${nomeAtivo} — Código ${codigo}`);

        const { data: inserted, error } = await supabase
          .from("movimentacoes")
          .insert({
            user_id: user.id,
            tipo_movimentacao: "Aplicação Inicial",
            data: line.data,
            categoria_id: CATEGORIA_RENDA_FIXA,
            produto_id: PRODUTO_CDB,
            instituicao_id: INSTITUICAO_XP,
            emissor_id: EMISSOR_BANCO_B3,
            modalidade: "Prefixado",
            indexador: "Prefixado",
            taxa: line.taxa,
            valor: line.valor,
            preco_unitario: line.pu,
            quantidade,
            vencimento: line.vencimento,
            pagamento: line.pagamento,
            nome_ativo: nomeAtivo,
            codigo_custodia: codigo,
            valor_extrato: valorExtrato,
            origem: "manual",
          })
          .select("id")
          .single();

        if (error || !inserted) {
          addLog(`❌ Erro ao inserir linha ${i + 1}: ${error?.message}`);
          continue;
        }

        addLog(`✅ Movimentação inserida: ${inserted.id}`);

        // Sync: creates custodia + carteira
        await fullSyncAfterMovimentacao(
          inserted.id,
          CATEGORIA_RENDA_FIXA,
          user.id,
          dataReferenciaISO
        );
        addLog(`🔄 Sync concluído para código ${codigo}`);
      }

      applyDataReferencia();
      toast.success("6 CDBs inseridos e sincronizados com sucesso!");
      addLog("🎉 Processo finalizado.");
    } catch (err: any) {
      addLog(`❌ Erro geral: ${err?.message}`);
      toast.error("Erro durante a inserção.");
    } finally {
      setInserting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Admin</h1>
        <p className="text-xs text-muted-foreground">Ferramentas administrativas do sistema</p>
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-4">
        <h2 className="text-sm font-medium text-foreground">Inserção em massa — 6 CDBs Prefixados</h2>
        <p className="text-xs text-muted-foreground">
          Insere 6 movimentações de CDB (Banco B3 / XP Investimentos) seguindo o fluxo completo da boleta, com sync automático.
        </p>
        <Button onClick={handleInsertCDBs} disabled={inserting}>
          {inserting ? "Inserindo..." : "Inserir CDBs"}
        </Button>

        {log.length > 0 && (
          <div className="rounded-md border bg-muted/50 p-3 max-h-60 overflow-y-auto">
            {log.map((l, i) => (
              <p key={i} className="text-xs font-mono text-foreground">{l}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

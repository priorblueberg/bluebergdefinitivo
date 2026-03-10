import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import {
  CarteiraVisaoGeral,
  CarteiraRendaFixa,
  CarteiraRendaVariavel,
  CarteiraFundos,
  CarteiraTesouroDireto,
  CarteiraAnaliseIndividual,
  Movimentacoes,
  ProventosRecebidos,
  CadastrarTransacao,
  Configuracoes,
  Usuario,
  Admin,
  Custodia,
  ControleCarteiras,
} from "@/pages/AppPages";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/carteira" replace />} />
          <Route element={<AppLayout />}>
            <Route path="/carteira" element={<CarteiraVisaoGeral />} />
            <Route path="/carteira/renda-fixa" element={<CarteiraRendaFixa />} />
            <Route path="/carteira/renda-variavel" element={<CarteiraRendaVariavel />} />
            <Route path="/carteira/fundos" element={<CarteiraFundos />} />
            <Route path="/carteira/tesouro-direto" element={<CarteiraTesouroDireto />} />
            <Route path="/carteira/analise-individual" element={<CarteiraAnaliseIndividual />} />
            <Route path="/movimentacoes" element={<Movimentacoes />} />
            <Route path="/custodia" element={<Custodia />} />
            <Route path="/controle-carteiras" element={<ControleCarteiras />} />
            <Route path="/proventos" element={<ProventosRecebidos />} />
            <Route path="/cadastrar-transacao" element={<CadastrarTransacao />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
            <Route path="/usuario" element={<Usuario />} />
            <Route path="/admin" element={<Admin />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

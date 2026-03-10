import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
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
import NotFound from "./pages/NotFound";
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import CadastroPage from "./pages/CadastroPage";
import OnboardingPage from "./pages/OnboardingPage";
import PlanosPage from "./pages/PlanosPage";
import CheckoutPage from "./pages/CheckoutPage";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, hasProfile } = useAuth();

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    );
  if (!user) return <Navigate to="/auth" replace />;
  if (hasProfile === null)
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    );
  if (!hasProfile) return <Navigate to="/onboarding" replace />;
  return <AppLayout>{children}</AppLayout>;
};

const OnboardingRoute = () => {
  const { user, loading, hasProfile } = useAuth();
  if (loading || hasProfile === null)
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    );
  if (!user) return <Navigate to="/auth" replace />;
  if (hasProfile) return <Navigate to="/carteira" replace />;
  return <OnboardingPage />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/cadastro" element={<CadastroPage />} />
          <Route path="/onboarding" element={<OnboardingRoute />} />
          <Route path="/planos" element={<PlanosPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />

          {/* Protected routes */}
          <Route path="/carteira" element={<ProtectedRoute><CarteiraVisaoGeral /></ProtectedRoute>} />
          <Route path="/carteira/renda-fixa" element={<ProtectedRoute><CarteiraRendaFixa /></ProtectedRoute>} />
          <Route path="/carteira/renda-variavel" element={<ProtectedRoute><CarteiraRendaVariavel /></ProtectedRoute>} />
          <Route path="/carteira/fundos" element={<ProtectedRoute><CarteiraFundos /></ProtectedRoute>} />
          <Route path="/carteira/tesouro-direto" element={<ProtectedRoute><CarteiraTesouroDireto /></ProtectedRoute>} />
          <Route path="/carteira/analise-individual" element={<ProtectedRoute><CarteiraAnaliseIndividual /></ProtectedRoute>} />
          <Route path="/movimentacoes" element={<ProtectedRoute><Movimentacoes /></ProtectedRoute>} />
          <Route path="/custodia" element={<ProtectedRoute><Custodia /></ProtectedRoute>} />
          <Route path="/controle-carteiras" element={<ProtectedRoute><ControleCarteiras /></ProtectedRoute>} />
          <Route path="/proventos" element={<ProtectedRoute><ProventosRecebidos /></ProtectedRoute>} />
          <Route path="/cadastrar-transacao" element={<ProtectedRoute><CadastrarTransacao /></ProtectedRoute>} />
          <Route path="/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
          <Route path="/usuario" element={<ProtectedRoute><Usuario /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

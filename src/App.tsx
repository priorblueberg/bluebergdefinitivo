import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, Outlet } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import {
  CarteiraVisaoGeral,
  CarteiraRendaVariavel,
  CarteiraFundos,
  CarteiraTesouroDireto,
  
  Movimentacoes,
  ProventosRecebidos,
  CadastrarTransacao,
  Configuracoes,
  Usuario,
  Admin,
  Custodia,
  ControleCarteiras,
} from "@/pages/AppPages";
import CarteiraRendaFixa from "@/pages/CarteiraRendaFixaPage";
import CalculadoraPage from "@/pages/CalculadoraPage";
import PosicaoConsolidadaPage from "@/pages/PosicaoConsolidadaPage";
import NotFound from "./pages/NotFound";
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import OnboardingPage from "./pages/OnboardingPage";
import WelcomeOnboardingPage from "./pages/WelcomeOnboardingPage";
import PlanosPage from "./pages/PlanosPage";
import CheckoutPage from "./pages/CheckoutPage";

const queryClient = new QueryClient();

const ProtectedRoute = () => {
  const { user, loading, hasProfile, hasCustodia } = useAuth();

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    );
  if (!user) return <Navigate to="/auth" replace />;
  if (hasProfile === null || hasCustodia === null)
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    );
  if (!hasProfile) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
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

const WelcomeRoute = () => {
  const { user, loading, hasProfile, hasCustodia } = useAuth();
  if (loading || hasProfile === null || hasCustodia === null)
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    );
  if (!user) return <Navigate to="/auth" replace />;
  if (!hasProfile) return <Navigate to="/onboarding" replace />;
  if (hasCustodia) return <Navigate to="/carteira" replace />;
  return <WelcomeOnboardingPage />;
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
          <Route path="/onboarding" element={<OnboardingRoute />} />
          <Route path="/welcome" element={<WelcomeRoute />} />
          <Route path="/planos" element={<PlanosPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />

          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/carteira" element={<Navigate to="/carteira/renda-fixa" replace />} />
              <Route path="/carteira/renda-fixa" element={<CarteiraRendaFixa />} />
              <Route path="/carteira/renda-variavel" element={<CarteiraRendaVariavel />} />
              <Route path="/carteira/fundos" element={<CarteiraFundos />} />
              <Route path="/carteira/tesouro-direto" element={<CarteiraTesouroDireto />} />
              <Route path="/posicao-consolidada" element={<PosicaoConsolidadaPage />} />
              <Route path="/movimentacoes" element={<Movimentacoes />} />
              <Route path="/custodia" element={<Custodia />} />
              <Route path="/controle-carteiras" element={<ControleCarteiras />} />
              <Route path="/proventos" element={<ProventosRecebidos />} />
              <Route path="/cadastrar-transacao" element={<CadastrarTransacao />} />
              <Route path="/configuracoes" element={<Configuracoes />} />
              <Route path="/usuario" element={<Usuario />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/calculadora" element={<CalculadoraPage />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

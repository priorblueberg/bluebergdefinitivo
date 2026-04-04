import { useState, useEffect, useRef } from "react";
import { Outlet, useLocation, Navigate } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { SubTabs } from "./SubTabs";
import { DataReferenciaProvider, useDataReferencia } from "@/contexts/DataReferenciaContext";
import { RecalculatingOverlay } from "./RecalculatingOverlay";
import { useAuth } from "@/hooks/useAuth";
import { recalculateAllForDataReferencia } from "@/lib/syncEngine";
import { format } from "date-fns";

function AppLayoutInner() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const isCarteira = location.pathname.startsWith("/carteira");
  const isWelcome = location.pathname === "/welcome";
  const { user, hasCustodia, refreshCustodia } = useAuth();
  const { dataReferencia, applyDataReferencia, setIsRecalculating } = useDataReferencia();
  const hasRunInitial = useRef(false);

  useEffect(() => {
    if (!user || hasCustodia !== true || isWelcome || hasRunInitial.current) return;

    hasRunInitial.current = true;

    (async () => {
      setIsRecalculating(true);
      try {
        await recalculateAllForDataReferencia(user.id, format(dataReferencia, "yyyy-MM-dd"));
        await refreshCustodia();
        applyDataReferencia();
      } catch (err) {
        console.error("Erro no recálculo inicial", err);
      } finally {
        setIsRecalculating(false);
      }
    })();
  }, [user, hasCustodia, isWelcome, dataReferencia, refreshCustodia, applyDataReferencia, setIsRecalculating]);

  if (hasCustodia === null) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    );
  }

  if (!isWelcome && hasCustodia === false) {
    return <Navigate to="/welcome" replace />;
  }

  if (isWelcome && hasCustodia === true) {
    return <Navigate to="/carteira" replace />;
  }

  return (
    <div className="flex min-h-screen w-full">
      <div className={isWelcome ? "pointer-events-none opacity-60" : ""}>
        <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      </div>
      <div
        className="flex flex-1 flex-col min-h-screen"
        style={{
          marginLeft: collapsed ? 56 : 220,
          transition: "margin-left 120ms linear",
        }}
      >
        <AppHeader disableControls={isWelcome} />
        {isCarteira && !isWelcome && <SubTabs />}
        <main className="relative flex-1 overflow-y-auto p-6">
          {!isWelcome && <RecalculatingOverlay />}
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function AppLayout() {
  return (
    <DataReferenciaProvider>
      <AppLayoutInner />
    </DataReferenciaProvider>
  );
}

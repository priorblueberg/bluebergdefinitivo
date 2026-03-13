import { useState, useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
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
  const { user } = useAuth();
  const { dataReferencia, applyDataReferencia, setIsRecalculating } = useDataReferencia();
  const hasRunInitial = useRef(false);

  useEffect(() => {
    if (!user || hasRunInitial.current) return;
    hasRunInitial.current = true;
    (async () => {
      setIsRecalculating(true);
      try {
        await recalculateAllForDataReferencia(user.id, format(dataReferencia, "yyyy-MM-dd"));
        applyDataReferencia();
      } catch (err) {
        console.error("Erro no recálculo inicial", err);
      } finally {
        setIsRecalculating(false);
      }
    })();
  }, [user]);

  return (
    <div className="flex min-h-screen w-full">
        <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
        <div
          className="flex flex-1 flex-col min-h-screen"
          style={{
            marginLeft: collapsed ? 56 : 220,
            transition: "margin-left 120ms linear",
          }}
        >
          <AppHeader />
          {isCarteira && <SubTabs />}
          <main className="relative flex-1 overflow-y-auto p-6">
            <RecalculatingOverlay />
            <Outlet />
          </main>
        </div>
      </div>
    </DataReferenciaProvider>
  );
}

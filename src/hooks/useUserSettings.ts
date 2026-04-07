import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface UserSettings {
  poupancaFifo: boolean;
}

export function useUserSettings() {
  const { user } = useAuth();
  const [poupancaFifo, setPoupancaFifoState] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase
        .from("user_settings")
        .select("poupanca_fifo")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setPoupancaFifoState(data.poupanca_fifo);
      setLoading(false);
    })();
  }, [user]);

  const setPoupancaFifo = useCallback(async (value: boolean) => {
    if (!user) return;
    setPoupancaFifoState(value);
    await supabase
      .from("user_settings")
      .upsert({ user_id: user.id, poupanca_fifo: value }, { onConflict: "user_id" });
  }, [user]);

  return { poupancaFifo, setPoupancaFifo, loading };
}

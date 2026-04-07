import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface UserSettings {
  poupancaFifo: boolean;
}

const userSettingsCache = new Map<string, UserSettings>();

export function useUserSettings() {
  const { user } = useAuth();
  const cachedSettings = user ? userSettingsCache.get(user.id) : undefined;
  const [poupancaFifo, setPoupancaFifoState] = useState(cachedSettings?.poupancaFifo ?? true);
  const [loading, setLoading] = useState(Boolean(user && !cachedSettings));

  useEffect(() => {
    let isMounted = true;

    if (!user) {
      setPoupancaFifoState(true);
      setLoading(false);
      return () => {
        isMounted = false;
      };
    }

    const cached = userSettingsCache.get(user.id);
    if (cached) {
      setPoupancaFifoState(cached.poupancaFifo);
      setLoading(false);
      return () => {
        isMounted = false;
      };
    }

    setLoading(true);

    (async () => {
      const { data, error } = await supabase
        .from("user_settings")
        .select("poupanca_fifo")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!isMounted) return;

      if (error) {
        console.error("Erro ao carregar configurações do usuário", error);
        setPoupancaFifoState(true);
        setLoading(false);
        return;
      }

      const nextValue = data?.poupanca_fifo ?? true;
      userSettingsCache.set(user.id, { poupancaFifo: nextValue });
      setPoupancaFifoState(nextValue);
      setLoading(false);
    })();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const setPoupancaFifo = useCallback(async (value: boolean) => {
    if (!user) return;

    const previousValue = userSettingsCache.get(user.id)?.poupancaFifo ?? poupancaFifo;
    userSettingsCache.set(user.id, { poupancaFifo: value });
    setPoupancaFifoState(value);

    const { error } = await supabase
      .from("user_settings")
      .upsert({ user_id: user.id, poupanca_fifo: value }, { onConflict: "user_id" });

    if (error) {
      userSettingsCache.set(user.id, { poupancaFifo: previousValue });
      setPoupancaFifoState(previousValue);
      throw error;
    }
  }, [poupancaFifo, user]);

  return { poupancaFifo, setPoupancaFifo, loading };
}

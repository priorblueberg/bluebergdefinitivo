import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [hasCustodia, setHasCustodia] = useState<boolean | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);

  useEffect(() => {
    const checkProfile = async (userId: string) => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome_completo")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Erro ao verificar perfil", error);
        return;
      }

      setHasProfile(!!data);
      setProfileName(data?.nome_completo ?? null);
    };

    const checkCustodia = async (userId: string) => {
      const { data, error } = await supabase
        .from("custodia")
        .select("id")
        .eq("user_id", userId)
        .limit(1);

      if (error) {
        console.error("Erro ao verificar custódia", error);
        return;
      }

      setHasCustodia(data.length > 0);
    };

    const hydrateUserState = async (userId: string, resetFirst = true) => {
      if (resetFirst) {
        setHasProfile(null);
        setHasCustodia(null);
        setProfileName(null);
      }
      await Promise.all([checkProfile(userId), checkCustodia(userId)]);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);

        if (session?.user) {
          void hydrateUserState(session.user.id);
        } else {
          setHasProfile(null);
          setHasCustodia(null);
          setProfileName(null);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        void hydrateUserState(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    if (user) {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome_completo")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Erro ao atualizar perfil", error);
        return;
      }

      setHasProfile(!!data);
      setProfileName(data?.nome_completo ?? null);
    }
  };

  const refreshCustodia = async () => {
    if (user) {
      const { data, error } = await supabase
        .from("custodia")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);

      if (error) {
        console.error("Erro ao atualizar custódia", error);
        return;
      }

      setHasCustodia(data.length > 0);
    }
  };

  return { user, loading, hasProfile, hasCustodia, profileName, signOut, refreshProfile, refreshCustodia };
};

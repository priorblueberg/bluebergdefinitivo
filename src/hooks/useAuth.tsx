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
      const { data } = await supabase
        .from("profiles")
        .select("id, nome_completo")
        .eq("user_id", userId)
        .maybeSingle();
      setHasProfile(!!data);
      setProfileName(data?.nome_completo ?? null);
    };

    const checkCustodia = async (userId: string) => {
      const { data } = await supabase
        .from("custodia")
        .select("id")
        .eq("user_id", userId)
        .limit(1);
      setHasCustodia(!!data && data.length > 0);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
        if (session?.user) {
          checkProfile(session.user.id);
          checkCustodia(session.user.id);
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
        checkProfile(session.user.id);
        checkCustodia(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    if (user) {
      const { data } = await supabase
        .from("profiles")
        .select("id, nome_completo")
        .eq("user_id", user.id)
        .maybeSingle();
      setHasProfile(!!data);
      setProfileName(data?.nome_completo ?? null);
    }
  };

  const refreshCustodia = async () => {
    if (user) {
      const { data } = await supabase
        .from("custodia")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);
      setHasCustodia(!!data && data.length > 0);
    }
  };

  return { user, loading, hasProfile, hasCustodia, profileName, signOut, refreshProfile, refreshCustodia };
};

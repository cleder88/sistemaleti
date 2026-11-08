"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type UserRole = "admin" | "operator";

export interface UserRoleState {
  userId: string | null;
  role: UserRole | null;
  isAdmin: boolean;
  loading: boolean;
}

/**
 * Lê o papel do utilizador autenticado na tabela 'user_profiles'.
 * A RLS permite que cada utilizador leia o próprio perfil.
 */
export function useUserRole(): UserRoleState {
  const [state, setState] = useState<UserRoleState>({
    userId: null,
    role: null,
    isAdmin: false,
    loading: true,
  });

  useEffect(() => {
    let active = true;

    async function loadRole() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          if (active) {
            setState({ userId: null, role: null, isAdmin: false, loading: false });
          }
          return;
        }

        const { data } = await supabase
          .from("user_profiles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();

        const role: UserRole =
          data?.role === "admin" ? "admin" : "operator";

        if (active) {
          setState({
            userId: user.id,
            role,
            isAdmin: role === "admin",
            loading: false,
          });
        }
      } catch {
        if (active) {
          setState({
            userId: null,
            role: "operator",
            isAdmin: false,
            loading: false,
          });
        }
      }
    }

    loadRole();

    return () => {
      active = false;
    };
  }, []);

  return state;
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchWallet, type WalletState } from "@/lib/wallet";
import { useAuth } from "@/hooks/useAuth";

export function useWallet() {
  const { user } = useAuth();
  const [state, setState] = useState<WalletState>({ balance: 0, locked: 0, loaded: false });

  useEffect(() => {
    if (!user) { setState({ balance: 0, locked: 0, loaded: false }); return; }
    let active = true;
    fetchWallet(user.id).then(s => active && setState(s));

    const ch = supabase
      .channel(`wallet:${user.id}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "wallets", filter: `user_id=eq.${user.id}` },
        (p: any) => {
          setState({
            balance: (p.new.balance_cents ?? 0) / 100,
            locked: (p.new.locked_cents ?? 0) / 100,
            loaded: true,
          });
        })
      .subscribe();

    const onCustom = () => fetchWallet(user.id).then(s => active && setState(s));
    window.addEventListener("wallet:refresh", onCustom);

    return () => { active = false; supabase.removeChannel(ch); window.removeEventListener("wallet:refresh", onCustom); };
  }, [user?.id]);

  return state;
}

export function refreshWallet() {
  window.dispatchEvent(new CustomEvent("wallet:refresh"));
}

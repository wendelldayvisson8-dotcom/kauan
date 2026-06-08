// Wallet agora vive no servidor. Este módulo apenas faz leituras + assina realtime.
import { supabase } from "@/integrations/supabase/client";

export interface WalletState {
  balance: number;   // reais
  locked: number;    // reais
  loaded: boolean;
}

export async function fetchWallet(userId: string): Promise<WalletState> {
  const { data } = await supabase
    .from("wallets")
    .select("balance_cents, locked_cents")
    .eq("user_id", userId)
    .maybeSingle();
  return {
    balance: (data?.balance_cents ?? 0) / 100,
    locked: (data?.locked_cents ?? 0) / 100,
    loaded: true,
  };
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { WalletHeader } from "@/components/WalletHeader";
import { DepositDialog } from "@/components/DepositDialog";
import { WithdrawDialog } from "@/components/WithdrawDialog";
import { AuthDialog } from "@/components/AuthDialog";
import { Lobby } from "@/components/Lobby";
import { GameScreen } from "@/components/GameScreen";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { refreshWallet } from "@/hooks/useWallet";
import { toast } from "sonner";
import { LogOut, Shield } from "lucide-react";

const Index = () => {
  const { user, loading } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [bet, setBet] = useState(10);
  const [starting, setStarting] = useState(false);
  const [round, setRound] = useState<{ id: string; bet: number; rows: { multiplier: number }[] } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!loading && !user) setAuthOpen(true);
    if (user) {
      setAuthOpen(false);
      supabase.from("user_roles").select("role").eq("user_id", user.id).then(({ data }) => {
        setIsAdmin((data ?? []).some(r => r.role === "admin"));
      });
    }
  }, [user, loading]);

  const requireAuth = () => {
    if (!user) { setAuthOpen(true); toast.error("Faça login ou cadastre-se"); return false; }
    return true;
  };

  const handleStart = async () => {
    if (!requireAuth()) return;
    if (bet < 1) return toast.error("Aposta inválida");
    setStarting(true);
    try {
      const { data, error } = await supabase.functions.invoke("play-start", {
        body: { bet_cents: Math.round(bet * 100) },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      setRound({ id: data.round_id, bet: data.bet_cents / 100, rows: data.rows });
      refreshWallet();
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setStarting(false); }
  };

  const handleDeposit = () => { if (requireAuth()) setDepositOpen(true); };
  const handleWithdraw = () => { if (requireAuth()) setWithdrawOpen(true); };

  return (
    <main className="min-h-screen px-4 py-6 sm:px-8 sm:py-10 max-w-5xl mx-auto">
      <WalletHeader onDepositClick={handleDeposit} onWithdrawClick={handleWithdraw} />
      {user && (
        <div className="flex justify-end -mt-4 mb-4 gap-3">
          {isAdmin && (
            <Link to="/admin" className="text-xs text-primary-glow hover:underline flex items-center gap-1">
              <Shield className="w-3 h-3" /> Painel admin
            </Link>
          )}
          <button
            onClick={async () => { await supabase.auth.signOut(); toast.success("Sessão encerrada"); }}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <LogOut className="w-3 h-3" /> {user.email} • sair
          </button>
        </div>
      )}
      <Lobby bet={bet} setBet={setBet} onStart={handleStart} starting={starting} />
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
      <DepositDialog open={depositOpen} onOpenChange={setDepositOpen} />
      <WithdrawDialog open={withdrawOpen} onOpenChange={setWithdrawOpen} />
      {round && (
        <GameScreen
          bet={round.bet}
          roundId={round.id}
          rows={round.rows}
          onExit={() => { setRound(null); refreshWallet(); }}
        />
      )}
      <footer className="text-center text-xs text-muted-foreground mt-10">
        ICE STEP • RTP 92% • Jogo do servidor — RNG e saldo no backend.
      </footer>
    </main>
  );
};

export default Index;

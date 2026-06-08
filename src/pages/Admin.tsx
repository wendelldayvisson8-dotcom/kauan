import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

interface Withdrawal {
  id: string; user_id: string; amount_cents: number; pix_key: string; pix_key_type: string;
  status: string; admin_note: string | null; created_at: string;
}
interface Deposit { id: string; user_id: string | null; amount: number; status: string; created_at: string; }
interface Round { id: string; user_id: string; bet_cents: number; payout_cents: number; status: string; current_multiplier: number; rows_cleared: number; started_at: string; }
interface Wallet { user_id: string; balance_cents: number; total_deposited_cents: number; total_withdrawn_cents: number; }

const Admin = () => {
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("role").eq("user_id", user.id).then(({ data }) => {
      setIsAdmin((data ?? []).some(r => r.role === "admin"));
    });
  }, [user]);

  const reload = async () => {
    const [w, d, r, wl] = await Promise.all([
      supabase.from("withdrawals").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("deposits").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("game_rounds").select("*").order("started_at", { ascending: false }).limit(200),
      supabase.from("wallets").select("*"),
    ]);
    setWithdrawals(w.data ?? []);
    setDeposits(d.data ?? []);
    setRounds(r.data ?? []);
    setWallets(wl.data ?? []);
  };

  useEffect(() => { if (isAdmin) reload(); }, [isAdmin]);

  const act = async (id: string, action: "approve" | "paid" | "deny") => {
    setBusy(id);
    try {
      const note = action === "deny" ? prompt("Motivo da recusa (opcional)") ?? undefined : undefined;
      const { data, error } = await supabase.functions.invoke("admin-withdrawal", {
        body: { withdrawal_id: id, action, note },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast.success(`Saque ${action === "deny" ? "negado" : action}`);
      await reload();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  };

  if (loading || isAdmin === null) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!user || !isAdmin) return <Navigate to="/" replace />;

  // KPIs
  const totalDeposited = deposits.filter(d => d.status === "paid").reduce((s, d) => s + d.amount, 0) / 100;
  const totalWithdrawn = withdrawals.filter(w => w.status === "paid").reduce((s, w) => s + w.amount_cents, 0) / 100;
  const ggr = rounds.reduce((s, r) => s + (r.bet_cents - r.payout_cents), 0) / 100;
  const pendingWithdrawals = withdrawals.filter(w => w.status === "pending").length;

  return (
    <main className="min-h-screen px-4 py-6 max-w-6xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to="/" className="glass w-10 h-10 rounded-xl flex items-center justify-center"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="text-2xl font-bold text-glow">Painel Admin</h1>
        </div>
        <Button variant="secondary" onClick={reload}>Atualizar</Button>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Kpi label="Total depositado" value={`R$ ${totalDeposited.toFixed(2)}`} />
        <Kpi label="Total sacado" value={`R$ ${totalWithdrawn.toFixed(2)}`} />
        <Kpi label="GGR (bet-payout)" value={`R$ ${ggr.toFixed(2)}`} accent={ggr >= 0 ? "good" : "bad"} />
        <Kpi label="Saques pendentes" value={String(pendingWithdrawals)} accent={pendingWithdrawals > 0 ? "warn" : undefined} />
      </div>

      <Tabs defaultValue="withdrawals">
        <TabsList>
          <TabsTrigger value="withdrawals">Saques</TabsTrigger>
          <TabsTrigger value="deposits">Depósitos</TabsTrigger>
          <TabsTrigger value="rounds">Partidas</TabsTrigger>
          <TabsTrigger value="users">Usuários</TabsTrigger>
        </TabsList>

        <TabsContent value="withdrawals" className="mt-4">
          <div className="glass rounded-2xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground"><tr>
                <th className="p-3">Quando</th><th className="p-3">Usuário</th><th className="p-3">Valor</th><th className="p-3">Chave PIX</th><th className="p-3">Status</th><th className="p-3">Ações</th>
              </tr></thead>
              <tbody>
                {withdrawals.map(w => (
                  <tr key={w.id} className="border-t border-white/5">
                    <td className="p-3 text-xs">{new Date(w.created_at).toLocaleString()}</td>
                    <td className="p-3 font-mono text-[10px]">{w.user_id.slice(0,8)}</td>
                    <td className="p-3 font-bold">R$ {(w.amount_cents/100).toFixed(2)}</td>
                    <td className="p-3 text-xs">{w.pix_key_type}: <span className="font-mono">{w.pix_key}</span></td>
                    <td className="p-3"><StatusBadge s={w.status} /></td>
                    <td className="p-3 flex gap-1">
                      {w.status === "pending" && <Button size="sm" variant="secondary" disabled={busy===w.id} onClick={() => act(w.id, "approve")}>Aprovar</Button>}
                      {(w.status === "pending" || w.status === "approved") && <Button size="sm" disabled={busy===w.id} onClick={() => act(w.id, "paid")}>Marcar pago</Button>}
                      {(w.status === "pending" || w.status === "approved") && <Button size="sm" variant="destructive" disabled={busy===w.id} onClick={() => act(w.id, "deny")}>Negar</Button>}
                    </td>
                  </tr>
                ))}
                {withdrawals.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground text-sm">Nenhum saque</td></tr>}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="deposits" className="mt-4">
          <SimpleTable rows={deposits.map(d => [
            new Date(d.created_at).toLocaleString(),
            d.user_id?.slice(0,8) ?? "—",
            `R$ ${(d.amount/100).toFixed(2)}`,
            <StatusBadge key={d.id} s={d.status} />,
          ])} headers={["Quando","Usuário","Valor","Status"]} />
        </TabsContent>

        <TabsContent value="rounds" className="mt-4">
          <SimpleTable rows={rounds.map(r => [
            new Date(r.started_at).toLocaleString(),
            r.user_id.slice(0,8),
            `R$ ${(r.bet_cents/100).toFixed(2)}`,
            `${r.rows_cleared} (${Number(r.current_multiplier).toFixed(2)}x)`,
            `R$ ${(r.payout_cents/100).toFixed(2)}`,
            <StatusBadge key={r.id} s={r.status} />,
          ])} headers={["Quando","Usuário","Aposta","Cleared","Prêmio","Status"]} />
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <SimpleTable rows={wallets.map(w => [
            <span key={w.user_id} className="font-mono text-[10px]">{w.user_id}</span>,
            `R$ ${(w.balance_cents/100).toFixed(2)}`,
            `R$ ${(w.total_deposited_cents/100).toFixed(2)}`,
            `R$ ${(w.total_withdrawn_cents/100).toFixed(2)}`,
          ])} headers={["User ID","Saldo","Depositado","Sacado"]} />
        </TabsContent>
      </Tabs>
    </main>
  );
};

const Kpi = ({ label, value, accent }: { label: string; value: string; accent?: "good"|"bad"|"warn" }) => (
  <div className="glass rounded-2xl p-4">
    <p className="text-xs uppercase text-muted-foreground">{label}</p>
    <p className={`text-2xl font-bold mt-1 ${accent==="good"?"text-success":accent==="bad"?"text-destructive":accent==="warn"?"text-primary-glow":""}`}>{value}</p>
  </div>
);

const StatusBadge = ({ s }: { s: string }) => {
  const color = s === "paid" || s === "cashed" ? "text-success" :
                s === "pending" || s === "active" ? "text-primary-glow" :
                s === "approved" ? "text-primary-glow" :
                s === "denied" || s === "failed" || s === "lost" || s === "expired" ? "text-destructive" : "text-muted-foreground";
  return <span className={`text-xs font-bold uppercase ${color}`}>{s}</span>;
};

const SimpleTable = ({ rows, headers }: { rows: any[][]; headers: string[] }) => (
  <div className="glass rounded-2xl overflow-x-auto">
    <table className="w-full text-sm">
      <thead className="text-left text-xs uppercase text-muted-foreground"><tr>{headers.map(h => <th key={h} className="p-3">{h}</th>)}</tr></thead>
      <tbody>
        {rows.map((r, i) => <tr key={i} className="border-t border-white/5">{r.map((c, j) => <td key={j} className="p-3">{c}</td>)}</tr>)}
        {rows.length === 0 && <tr><td colSpan={headers.length} className="p-6 text-center text-muted-foreground">Sem registros</td></tr>}
      </tbody>
    </table>
  </div>
);

export default Admin;

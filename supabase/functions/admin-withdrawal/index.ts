// Admin aprova, paga ou nega um saque. Requer role 'admin'.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, json, requireUser, serviceClient } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = await requireUser(req);
    if ("error" in auth) return auth.error;

    const sb = serviceClient();
    const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", auth.userId);
    const isAdmin = (roles ?? []).some(r => r.role === "admin");
    if (!isAdmin) return json({ error: "forbidden" }, 403);

    const { withdrawal_id, action, note } = await req.json();
    if (!withdrawal_id || !["approve","paid","deny"].includes(action)) return json({ error: "params" }, 400);

    const { data: wd, error } = await sb.from("withdrawals").select("*").eq("id", withdrawal_id).single();
    if (error || !wd) return json({ error: "saque não encontrado" }, 404);

    if (action === "deny") {
      if (wd.status !== "pending" && wd.status !== "approved") return json({ error: "não pode negar" }, 400);
      // estorna saldo
      const { data: w } = await sb.from("wallets").select("balance_cents").eq("user_id", wd.user_id).single();
      if (w) {
        const newBal = w.balance_cents + Number(wd.amount_cents);
        await sb.from("wallets").update({ balance_cents: newBal }).eq("user_id", wd.user_id);
        await sb.from("wallet_transactions").insert({
          user_id: wd.user_id, type: "withdraw_refund",
          amount_cents: Number(wd.amount_cents),
          balance_after_cents: newBal,
          ref_table: "withdrawals", ref_id: wd.id,
        });
      }
      await sb.from("withdrawals").update({ status: "denied", admin_note: note ?? null, processed_at: new Date().toISOString() }).eq("id", wd.id);
      return json({ ok: true, status: "denied" });
    }

    if (action === "approve") {
      await sb.from("withdrawals").update({ status: "approved", admin_note: note ?? null }).eq("id", wd.id);
      return json({ ok: true, status: "approved" });
    }

    if (action === "paid") {
      await sb.from("withdrawals").update({ status: "paid", admin_note: note ?? null, processed_at: new Date().toISOString() }).eq("id", wd.id);
      // total_withdrawn_cents
      const { data: w } = await sb.from("wallets").select("total_withdrawn_cents").eq("user_id", wd.user_id).single();
      if (w) {
        await sb.from("wallets")
          .update({ total_withdrawn_cents: Number(w.total_withdrawn_cents) + Number(wd.amount_cents) })
          .eq("user_id", wd.user_id);
        await sb.from("wallet_transactions").insert({
          user_id: wd.user_id, type: "withdraw_paid",
          amount_cents: -Number(wd.amount_cents),
          balance_after_cents: 0, // saldo já debitado no hold; usamos 0 como marcador informativo
          ref_table: "withdrawals", ref_id: wd.id,
        });
      }
      return json({ ok: true, status: "paid" });
    }
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

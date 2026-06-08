// Encerra a partida e credita o prêmio = bet * current_multiplier.
import { corsHeaders, json, requireUser, serviceClient } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = await requireUser(req);
    if ("error" in auth) return auth.error;

    const { round_id } = await req.json();
    const sb = serviceClient();

    const { data: round, error } = await sb
      .from("game_rounds").select("*")
      .eq("id", round_id).eq("user_id", auth.userId).single();
    if (error || !round) return json({ error: "round não encontrado" }, 404);
    if (round.status !== "active") return json({ error: "round encerrado" }, 400);
    if (round.rows_cleared <= 0) return json({ error: "nada a sacar" }, 400);

    const payout = Math.floor(Number(round.bet_cents) * Number(round.current_multiplier));
    const { data: w } = await sb.from("wallets").select("balance_cents, locked_cents").eq("user_id", auth.userId).single();
    if (!w) return json({ error: "wallet" }, 400);

    const newBalance = w.balance_cents + payout;
    const newLocked = Math.max(0, w.locked_cents - round.bet_cents);

    await sb.from("wallets").update({ balance_cents: newBalance, locked_cents: newLocked }).eq("user_id", auth.userId);
    await sb.from("game_rounds").update({
      status: "cashed",
      payout_cents: payout,
      ended_at: new Date().toISOString(),
    }).eq("id", round.id);
    await sb.from("wallet_transactions").insert({
      user_id: auth.userId, type: "payout",
      amount_cents: payout,
      balance_after_cents: newBalance,
      ref_table: "game_rounds", ref_id: round.id,
    });

    return json({ status: "cashed", payout_cents: payout, balance_cents: newBalance });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

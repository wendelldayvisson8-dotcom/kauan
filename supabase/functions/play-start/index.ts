// Inicia uma partida: trava a aposta na carteira e cria game_round.
import { corsHeaders, json, requireUser, serviceClient } from "../_shared/auth.ts";
import { LIMITS, ROWS } from "../_shared/game-config.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = await requireUser(req);
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const betCents = Math.round(Number(body?.bet_cents));
    if (!Number.isFinite(betCents) || betCents < LIMITS.bet.min || betCents > LIMITS.bet.max) {
      return json({ error: `Aposta deve estar entre ${LIMITS.bet.min/100} e ${LIMITS.bet.max/100} reais` }, 400);
    }

    const sb = serviceClient();

    // Trava saldo via update condicional (sem race)
    const { data: wallet, error: wErr } = await sb
      .from("wallets")
      .select("balance_cents, locked_cents")
      .eq("user_id", auth.userId)
      .single();
    if (wErr || !wallet) return json({ error: "Carteira não encontrada" }, 400);
    if (wallet.balance_cents < betCents) return json({ error: "Saldo insuficiente" }, 400);

    const newBal = wallet.balance_cents - betCents;
    const { error: uErr } = await sb
      .from("wallets")
      .update({ balance_cents: newBal, locked_cents: wallet.locked_cents + betCents })
      .eq("user_id", auth.userId)
      .eq("balance_cents", wallet.balance_cents);
    if (uErr) return json({ error: "Falha ao travar saldo" }, 400);

    // Cria round (índice único impede 2 ativas por user)
    const serverSeed = crypto.randomUUID() + crypto.randomUUID();
    const { data: round, error: rErr } = await sb
      .from("game_rounds")
      .insert({
        user_id: auth.userId,
        bet_cents: betCents,
        server_seed: serverSeed,
        status: "active",
      })
      .select()
      .single();
    if (rErr || !round) {
      // devolve saldo
      await sb.from("wallets").update({ balance_cents: wallet.balance_cents, locked_cents: wallet.locked_cents }).eq("user_id", auth.userId);
      return json({ error: "Já existe uma partida ativa" }, 400);
    }

    await sb.from("wallet_transactions").insert({
      user_id: auth.userId,
      type: "bet",
      amount_cents: -betCents,
      balance_after_cents: newBal,
      ref_table: "game_rounds",
      ref_id: round.id,
    });

    return json({
      round_id: round.id,
      bet_cents: betCents,
      rows: ROWS.map(r => ({ multiplier: r.multiplier })), // só multipliers ao cliente, prob fica no servidor
      total_rows: ROWS.length,
    });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

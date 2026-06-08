// Avança uma linha: RNG no servidor decide se foi safe/broken.
import { corsHeaders, json, requireUser, serviceClient } from "../_shared/auth.ts";
import { ROWS, secureRandom } from "../_shared/game-config.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = await requireUser(req);
    if ("error" in auth) return auth.error;

    const { round_id, pick } = await req.json();
    if (!round_id || (pick !== 0 && pick !== 1)) return json({ error: "params" }, 400);

    const sb = serviceClient();
    const { data: round, error } = await sb
      .from("game_rounds").select("*")
      .eq("id", round_id).eq("user_id", auth.userId).single();
    if (error || !round) return json({ error: "round não encontrado" }, 404);
    if (round.status !== "active") return json({ error: "round encerrado" }, 400);
    if (round.rows_cleared >= ROWS.length) return json({ error: "fim do jogo" }, 400);

    const rowIdx = round.rows_cleared;
    const rowCfg = ROWS[rowIdx];

    // RNG no servidor
    const safe = secureRandom() < rowCfg.safeProbability;
    const safeIndex = secureRandom() < 0.5 ? 0 : 1; // posição visual
    // se safe=true, garantimos que o pick acerta; se false, garantimos que erra
    const visualSafeIndex = safe ? pick : (pick === 0 ? 1 : 0);

    const stepRecord = { row: rowIdx, pick, safe, safe_index: visualSafeIndex, ts: Date.now() };
    const newSteps = [...(round.steps as unknown[] || []), stepRecord];

    if (!safe) {
      // perdeu — libera locked, registra loss
      await sb.from("game_rounds").update({
        status: "lost",
        steps: newSteps,
        ended_at: new Date().toISOString(),
      }).eq("id", round.id);

      const { data: w } = await sb.from("wallets").select("locked_cents, balance_cents").eq("user_id", auth.userId).single();
      if (w) {
        const newLocked = Math.max(0, w.locked_cents - round.bet_cents);
        await sb.from("wallets").update({ locked_cents: newLocked }).eq("user_id", auth.userId);
        await sb.from("wallet_transactions").insert({
          user_id: auth.userId, type: "loss",
          amount_cents: -round.bet_cents,
          balance_after_cents: w.balance_cents,
          ref_table: "game_rounds", ref_id: round.id,
        });
      }

      return json({ safe: false, safe_index: visualSafeIndex, status: "lost" });
    }

    // safe — avança
    const newCleared = rowIdx + 1;
    const newMult = rowCfg.multiplier;
    await sb.from("game_rounds").update({
      rows_cleared: newCleared,
      current_multiplier: newMult,
      steps: newSteps,
    }).eq("id", round.id);

    return json({
      safe: true,
      safe_index: visualSafeIndex,
      rows_cleared: newCleared,
      current_multiplier: newMult,
      potential_payout_cents: Math.floor(round.bet_cents * newMult),
      finished: newCleared >= ROWS.length,
    });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

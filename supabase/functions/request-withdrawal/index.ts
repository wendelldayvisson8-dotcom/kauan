// Solicitação de saque PIX (modo MANUAL: fica pendente para admin aprovar/pagar).
import { corsHeaders, json, requireUser, serviceClient } from "../_shared/auth.ts";
import { LIMITS } from "../_shared/game-config.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = await requireUser(req);
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const amountCents = Math.round(Number(body?.amount_cents));
    const pix_key = String(body?.pix_key || "").trim();
    const pix_key_type = String(body?.pix_key_type || "");

    if (!Number.isFinite(amountCents) || amountCents < LIMITS.withdraw.min || amountCents > LIMITS.withdraw.max) {
      return json({ error: `Saque entre R$${LIMITS.withdraw.min/100} e R$${LIMITS.withdraw.max/100}` }, 400);
    }
    if (!pix_key || pix_key.length > 200) return json({ error: "Chave Pix inválida" }, 400);
    if (!["cpf","email","phone","random"].includes(pix_key_type)) return json({ error: "Tipo Pix inválido" }, 400);

    const sb = serviceClient();

    // limite diário
    const since = new Date(Date.now() - 24*60*60*1000).toISOString();
    const { data: recent } = await sb
      .from("withdrawals").select("amount_cents")
      .eq("user_id", auth.userId)
      .gte("created_at", since)
      .neq("status", "denied");
    const usedToday = (recent ?? []).reduce((s, r) => s + Number(r.amount_cents), 0);
    if (usedToday + amountCents > LIMITS.withdraw.dailyMax) {
      return json({ error: `Limite diário de saque (R$${LIMITS.withdraw.dailyMax/100}) excedido` }, 400);
    }

    // debita já (hold) — admin marca como pago depois
    const { data: w } = await sb.from("wallets").select("balance_cents, total_withdrawn_cents").eq("user_id", auth.userId).single();
    if (!w) return json({ error: "Carteira" }, 400);
    if (w.balance_cents < amountCents) return json({ error: "Saldo insuficiente" }, 400);

    const newBal = w.balance_cents - amountCents;
    const { error: uErr } = await sb.from("wallets")
      .update({ balance_cents: newBal })
      .eq("user_id", auth.userId).eq("balance_cents", w.balance_cents);
    if (uErr) return json({ error: "Falha ao debitar" }, 400);

    const { data: wd, error: iErr } = await sb.from("withdrawals").insert({
      user_id: auth.userId,
      amount_cents: amountCents,
      pix_key, pix_key_type,
      status: "pending",
    }).select().single();
    if (iErr || !wd) {
      await sb.from("wallets").update({ balance_cents: w.balance_cents }).eq("user_id", auth.userId);
      return json({ error: "Falha ao criar saque" }, 400);
    }

    await sb.from("wallet_transactions").insert({
      user_id: auth.userId, type: "withdraw_hold",
      amount_cents: -amountCents,
      balance_after_cents: newBal,
      ref_table: "withdrawals", ref_id: wd.id,
    });

    return json({ withdrawal_id: wd.id, status: "pending", balance_cents: newBal });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

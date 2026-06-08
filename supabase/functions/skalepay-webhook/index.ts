// Webhook SkalePay — quando o PIX é pago, credita a carteira do usuário (idempotente).
// TODO: trocar validação genérica por HMAC oficial quando a doc da SkalePay chegar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-signature, x-webhook-secret",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function hmacSha256Hex(secret: string, body: string) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2,"0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SECRET = Deno.env.get("SKALEPAY_WEBHOOK_SECRET");

    const rawBody = await req.text();

    // Validação genérica: aceita header igual ao secret OU HMAC-SHA256(body) hex.
    if (SECRET) {
      const headerSig = req.headers.get("x-webhook-signature") ?? req.headers.get("x-webhook-secret") ?? new URL(req.url).searchParams.get("secret");
      const expectedHmac = await hmacSha256Hex(SECRET, rawBody);
      const ok = headerSig === SECRET || headerSig === expectedHmac;
      if (!ok) {
        console.warn("webhook: assinatura inválida", { headerSig: headerSig?.slice(0,10) });
        return json({ error: "unauthorized" }, 401);
      }
    }

    const event = JSON.parse(rawBody || "{}");
    console.log("SkalePay webhook:", JSON.stringify(event).slice(0, 500));

    const externalId = event?.metadata ?? event?.data?.metadata ?? event?.external_id ?? event?.data?.external_id ?? event?.transaction?.external_id ?? null;
    const providerId = event?.id ?? event?.transaction_id ?? event?.data?.id ?? event?.transaction?.id ?? null;
    const status = String(event?.status ?? event?.data?.status ?? event?.transaction?.status ?? "").toLowerCase();

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

    let q = sb.from("deposits").select("*").limit(1);
    if (externalId) q = q.eq("id", externalId);
    else if (providerId) q = q.eq("provider_charge_id", providerId);
    else return json({ error: "no identifier" }, 400);

    const { data: rows } = await q;
    const deposit = rows?.[0];
    if (!deposit) return json({ ok: true, ignored: true });

    let newStatus = deposit.status;
    if (["paid","approved","completed","succeeded"].includes(status)) newStatus = "paid";
    else if (["expired","canceled","cancelled"].includes(status)) newStatus = "expired";
    else if (["failed","refused","denied"].includes(status)) newStatus = "failed";

    // idempotência: só credita se mudou para paid e ainda não estava paid
    const becamePaid = newStatus === "paid" && deposit.status !== "paid";

    await sb.from("deposits").update({
      status: newStatus,
      provider_charge_id: providerId ?? deposit.provider_charge_id,
      raw: event,
    }).eq("id", deposit.id);

    if (becamePaid && deposit.user_id) {
      const { data: w } = await sb.from("wallets")
        .select("balance_cents, total_deposited_cents")
        .eq("user_id", deposit.user_id).single();
      if (w) {
        const newBal = Number(w.balance_cents) + Number(deposit.amount);
        await sb.from("wallets").update({
          balance_cents: newBal,
          total_deposited_cents: Number(w.total_deposited_cents) + Number(deposit.amount),
        }).eq("user_id", deposit.user_id);
        await sb.from("wallet_transactions").insert({
          user_id: deposit.user_id,
          type: "deposit",
          amount_cents: Number(deposit.amount),
          balance_after_cents: newBal,
          ref_table: "deposits",
          ref_id: deposit.id,
        });
      }
    }

    return json({ ok: true, status: newStatus });
  } catch (e) {
    console.error("webhook error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

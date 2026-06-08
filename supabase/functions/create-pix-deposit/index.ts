// Cria cobrança PIX (SkalePay) para o usuário autenticado e registra deposit pendente.
// Doc: POST https://api.conta.skalepay.com.br/v1/transactions
import { corsHeaders, json, requireUser, serviceClient } from "../_shared/auth.ts";
import { LIMITS } from "../_shared/game-config.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = await requireUser(req);
    if ("error" in auth) return auth.error;

    const RAW_URL = Deno.env.get("SKALEPAY_API_URL");
    const SKALEPAY_API_URL = RAW_URL && /^https?:\/\//i.test(RAW_URL) ? RAW_URL : "https://api.conta.skalepay.com.br/v1";
    const SKALEPAY_API_KEY = Deno.env.get("SKALEPAY_API_KEY")?.trim();
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    if (!SKALEPAY_API_KEY) return json({ error: "Gateway não configurado" }, 500);
    if (SKALEPAY_API_KEY.startsWith("pk_")) {
      return json({ error: "Gateway configurado com chave pública. Use a Secret Key da SkalePay (sk_test_ ou sk_live_)." }, 500);
    }
    if (!SKALEPAY_API_KEY.startsWith("sk_test_") && !SKALEPAY_API_KEY.startsWith("sk_live_")) {
      return json({ error: "Secret Key da SkalePay inválida. Ela deve começar com sk_test_ ou sk_live_." }, 500);
    }

    const body = await req.json();
    const amountReais = Number(body?.amount);
    const amountCents = Math.round(amountReais * 100);
    if (!Number.isFinite(amountCents) || amountCents < LIMITS.deposit.min || amountCents > LIMITS.deposit.max) {
      return json({ error: `Depósito entre R$${LIMITS.deposit.min/100} e R$${LIMITS.deposit.max/100}` }, 400);
    }

    const sb = serviceClient();

    // limite diário
    const since = new Date(Date.now() - 24*60*60*1000).toISOString();
    const { data: recent } = await sb.from("deposits")
      .select("amount").eq("user_id", auth.userId)
      .gte("created_at", since).eq("status", "paid");
    const usedToday = (recent ?? []).reduce((s, r) => s + Number(r.amount), 0);
    if (usedToday + amountCents > LIMITS.deposit.dailyMax) {
      return json({ error: `Limite diário de depósito (R$${LIMITS.deposit.dailyMax/100}) excedido` }, 400);
    }

    // Pega email/nome do profile pra customer
    const { data: profile } = await sb.from("profiles")
      .select("email, display_name").eq("user_id", auth.userId).maybeSingle();

    const { data: deposit, error: insErr } = await sb.from("deposits").insert({
      client_id: auth.userId,
      user_id: auth.userId,
      provider: "skalepay",
      amount: amountCents,
      status: "pending",
    }).select().single();
    if (insErr) throw insErr;

    const webhookUrl = `${SUPABASE_URL}/functions/v1/skalepay-webhook`;
    const customerName = profile?.display_name || (profile?.email?.split("@")[0]) || "Jogador ICE STEP";
    const customerEmail = profile?.email || `player-${auth.userId.slice(0,8)}@icestep.app`;

    // Payload no formato real da SkalePay
    const payload = {
      amount: amountCents,
      paymentMethod: "pix",
      customer: {
        name: customerName,
        email: customerEmail,
        phone: "11999999999",
        document: { number: "11144477735", type: "cpf" },
      },
      items: [{
        title: "Créditos ICE STEP",
        unitPrice: amountCents,
        quantity: 1,
        tangible: false,
      }],
      metadata: deposit.id,
      postbackUrl: webhookUrl,
      pix: { expires_in: 3600 },
    };

    const apiUrl = `${SKALEPAY_API_URL.replace(/\/$/, "")}/transactions`;
    console.log("SkalePay request →", apiUrl);

    const basicAuth = "Basic " + btoa(`${SKALEPAY_API_KEY}:x`);
    const resp = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: basicAuth,
      },
      body: JSON.stringify(payload),
    });
    const raw = await resp.json().catch(() => ({}));
    console.log("SkalePay status:", resp.status, "body:", JSON.stringify(raw).slice(0, 500));

    if (!resp.ok) {
      await sb.from("deposits").update({ status: "failed", raw }).eq("id", deposit.id);
      return json({ error: raw?.message || "Falha no gateway", details: raw }, 502);
    }

    const providerId = raw?.id ?? raw?.transaction_id ?? null;
    const brCode = raw?.pix?.qrcode ?? raw?.pix?.qr_code ?? raw?.pix?.payload ?? null;
    const qrImage = raw?.pix?.qrcode_image ?? raw?.pix?.qr_code_image ?? null;
    const expiresAt = raw?.pix?.expirationDate ?? raw?.expires_at ?? null;

    if (!brCode) {
      console.error("SkalePay sem qrcode no retorno", raw);
      await sb.from("deposits").update({ status: "failed", raw }).eq("id", deposit.id);
      return json({ error: "Gateway não retornou QR Code", details: raw }, 502);
    }

    await sb.from("deposits").update({
      provider_charge_id: providerId,
      br_code: brCode,
      qr_code_image: qrImage,
      expires_at: expiresAt,
      raw,
    }).eq("id", deposit.id);

    return json({ deposit_id: deposit.id, amount: amountCents, br_code: brCode, qr_code_image: qrImage, expires_at: expiresAt });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

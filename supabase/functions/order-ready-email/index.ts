// order-ready-email — tells the customer their order is ready for pickup.
//
// Security: the caller must be a logged-in ADMIN (checked against the `admins`
// table). The recipient address is read from the ORDER ROW in the database, never
// from the request body — so this cannot be used to email arbitrary people.
//
// Body: { order_id: number }
// Secrets: GMAIL_USER, GMAIL_APP_PASSWORD
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by the platform.)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function readyEmailHtml(opts: {
  customer: string;
  meal: string;
  quantity: number;
  options: string[];
  coins: number;
}) {
  const optLine = opts.options.length
    ? `<tr><td style="padding:8px 0;color:#777;font-size:14px;">الخيارات / Options</td>
       <td style="padding:8px 0;color:#222;font-size:16px;font-weight:bold;">${esc(
         opts.options.join("، ")
       )}</td></tr>`
    : "";
  const coinLine = opts.coins
    ? `<tr><td style="padding:8px 0;color:#777;font-size:14px;">النقاط / Coins</td>
       <td style="padding:8px 0;color:#b8860b;font-size:16px;font-weight:bold;">🪙 ${opts.coins}</td></tr>`
    : "";

  return `
<div style="background:#f0f2f5;padding:24px;font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.12);">
    <tr>
      <td style="background:#222222;padding:22px;text-align:center;">
        <div style="font-size:26px;font-weight:bold;color:#d4af37;">مطعم الشيف سنا</div>
        <div style="font-size:12px;color:#aaaaaa;letter-spacing:2px;margin-top:4px;">CHEF SANA'S RESTAURANT</div>
      </td>
    </tr>
    <tr>
      <td style="padding:10px 26px 0;text-align:center;">
        <div style="font-size:64px;line-height:1;">🐤</div>
      </td>
    </tr>
    <tr>
      <td style="padding:10px 26px 28px;text-align:center;">
        <h1 style="margin:8px 0 6px;font-size:24px;color:#2e7d32;">🛎️ طلبك جاهز! Your order is ready</h1>
        <p style="margin:0 0 20px;color:#555;font-size:16px;">
          ${esc(opts.customer)}، طلبك جاهز للاستلام.<br/>
          <span style="color:#777;font-size:14px;">Your order is ready for pickup.</span>
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
               style="text-align:left;border-top:1px solid #eee;border-bottom:1px solid #eee;">
          <tr>
            <td style="padding:8px 0;color:#777;font-size:14px;width:40%;">الوجبة / Meal</td>
            <td style="padding:8px 0;color:#222;font-size:16px;font-weight:bold;">${esc(opts.meal)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#777;font-size:14px;">الكمية / Quantity</td>
            <td style="padding:8px 0;color:#222;font-size:16px;font-weight:bold;">× ${opts.quantity}</td>
          </tr>
          ${optLine}
          ${coinLine}
        </table>
        <p style="margin:22px 0 0;color:#2e7d32;font-size:15px;font-weight:bold;">بالهناء والشفاء 🌿 Enjoy your meal!</p>
      </td>
    </tr>
    <tr>
      <td style="background:#222222;color:#ffffff;text-align:center;padding:14px;font-size:13px;">
        2026، مطعم الشيف سنا — فَإِذَا طَعِمْتُمْ فَانتَشِرُوا
      </td>
    </tr>
  </table>
</div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let body: { order_id?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  const orderId = Number(body.order_id);
  if (!Number.isFinite(orderId)) return json({ error: "missing order_id" }, 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "server misconfigured" }, 500);
  const svc = createClient(supabaseUrl, serviceKey);

  // --- Caller must be a logged-in admin ---
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "unauthorized" }, 401);
  const { data: userData, error: userErr } = await svc.auth.getUser(jwt);
  const email = userData?.user?.email;
  if (userErr || !email) return json({ error: "unauthorized" }, 401);

  const { data: adminRow } = await svc
    .from("admins")
    .select("email")
    .ilike("email", email)
    .maybeSingle();
  if (!adminRow) return json({ error: "forbidden" }, 403);

  // --- Recipient comes from the DB, not the request ---
  const { data: order, error: orderErr } = await svc
    .from("orders")
    .select("customer_name, customer_email, meal_title, quantity, selected_options, points")
    .eq("id", orderId)
    .maybeSingle();
  if (orderErr || !order) return json({ error: "order not found" }, 404);
  if (!order.customer_email) return json({ ok: true, skipped: "no customer email" });

  const gmailUser = Deno.env.get("GMAIL_USER");
  const gmailPass = Deno.env.get("GMAIL_APP_PASSWORD");
  if (!gmailUser || !gmailPass) return json({ error: "email not configured" }, 500);

  const html = readyEmailHtml({
    customer: order.customer_name ?? "",
    meal: order.meal_title ?? "",
    quantity: order.quantity ?? 1,
    options: Array.isArray(order.selected_options) ? order.selected_options : [],
    coins: order.points ?? 0,
  });

  const client = new SMTPClient({
    connection: {
      hostname: "smtp.gmail.com",
      port: 465,
      tls: true,
      auth: { username: gmailUser, password: gmailPass },
    },
  });

  try {
    await client.send({
      from: `Chef Sana <${gmailUser}>`,
      to: order.customer_email,
      subject: `🛎️ طلبك جاهز! Your order is ready — ${order.meal_title}`,
      content:
        `${order.customer_name}، طلبك جاهز للاستلام.\n` +
        `Your order is ready for pickup.\n\n` +
        `Meal: ${order.meal_title}\nQuantity: ${order.quantity}\n`,
      html,
    });
    return json({ ok: true });
  } catch (e) {
    console.error("order-ready-email send failed:", e);
    return json({ error: "send failed" }, 500);
  } finally {
    try { await client.close(); } catch { /* ignore */ }
  }
});

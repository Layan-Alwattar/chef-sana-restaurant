// order-email — emails Chef Sana a branded HTML notification when an order arrives.
// Recipient is FIXED server-side (ORDER_NOTIFY_TO / GMAIL_USER), so this endpoint
// can only ever email Chef Sana.
//
// Secrets: GMAIL_USER, GMAIL_APP_PASSWORD, ORDER_NOTIFY_TO (optional)

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

function brandedEmail(title: string, intro: string, rows: [string, string][]) {
  const cells = rows
    .map(
      ([k, v]) => `
      <tr>
        <td style="padding:8px 0;color:#777;font-size:14px;width:40%;">${esc(k)}</td>
        <td style="padding:8px 0;color:#222;font-size:16px;font-weight:bold;">${esc(v)}</td>
      </tr>`
    )
    .join("");

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
      <td style="padding:28px 26px;">
        <h1 style="margin:0 0 6px;font-size:22px;color:#2e7d32;">${esc(title)}</h1>
        <p style="margin:0 0 18px;color:#555;font-size:15px;">${esc(intro)}</p>
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
               style="border-top:1px solid #eee;border-bottom:1px solid #eee;">
          ${cells}
        </table>
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

  let p: {
    meal_title?: string;
    customer_name?: string;
    note?: string;
    options?: string[];
    coins?: number;
    quantity?: number;
  };
  try {
    p = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const mealTitle = (p.meal_title ?? "").toString().trim();
  const customer = (p.customer_name ?? "").toString().trim();
  const note = (p.note ?? "").toString().trim();
  const options = Array.isArray(p.options)
    ? p.options.map((o) => String(o).trim()).filter(Boolean)
    : [];
  const coins = Number.isFinite(p.coins) ? Number(p.coins) : 0;
  const qty = Number.isFinite(p.quantity) && Number(p.quantity) > 0 ? Number(p.quantity) : 1;
  if (!mealTitle || !customer) return json({ error: "missing fields" }, 400);

  const user = Deno.env.get("GMAIL_USER");
  const pass = Deno.env.get("GMAIL_APP_PASSWORD");
  const to = Deno.env.get("ORDER_NOTIFY_TO") || user;
  if (!user || !pass || !to) {
    console.error("order-email: missing GMAIL_USER / GMAIL_APP_PASSWORD secrets");
    return json({ error: "email not configured" }, 500);
  }

  const rows: [string, string][] = [
    ["الزبون / Customer", customer],
    ["الوجبة / Meal", mealTitle],
    ["الكمية / Quantity", `× ${qty}`],
  ];
  if (options.length) rows.push(["الخيارات / Options", options.join("، ")]);
  if (coins) rows.push(["النقاط / Coins", `🪙 ${coins}`]);
  if (note) rows.push(["ملاحظة / Note", note]);

  const html = brandedEmail(
    "🛎️ طلب جديد — New order",
    `${customer} ordered ${qty} × ${mealTitle}`,
    rows
  );
  const text =
    `طلب جديد على موقع مطعم الشيف سنا\n\n` +
    rows.map(([k, v]) => `${k}: ${v}`).join("\n") +
    `\n`;

  const client = new SMTPClient({
    connection: {
      hostname: "smtp.gmail.com",
      port: 465,
      tls: true,
      auth: { username: user, password: pass },
    },
  });

  try {
    await client.send({
      from: `Chef Sana Orders <${user}>`,
      to,
      subject: `🛎️ طلب جديد: ${customer} طلب ${qty} × ${mealTitle}`,
      content: text,
      html,
    });
    return json({ ok: true });
  } catch (e) {
    console.error("order-email send failed:", e);
    return json({ error: "send failed" }, 500);
  } finally {
    try { await client.close(); } catch { /* ignore */ }
  }
});

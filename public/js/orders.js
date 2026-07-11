// Admin orders dashboard. Lists active ("new") orders; each has a "Ready"
// button that marks it done so it leaves the list (the row is kept for history,
// not deleted). New orders appear live via Realtime. Admin-only.

let ordersCache = [];

async function loadOrders() {
  const { data, error } = await sb
    .from("orders")
    .select("*")
    .eq("status", "new")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Failed to load orders:", error);
    return;
  }
  ordersCache = data || [];
}

function escO(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderOrders() {
  const list = document.getElementById("orders-list");
  const empty = document.getElementById("orders-empty");
  if (!list) return;
  empty.style.display = ordersCache.length ? "none" : "";
  list.innerHTML = ordersCache
    .map(
      (o) => `
      <div class="order-card" data-order-id="${o.id}">
        <div class="order-card-body">
          <h3>${escO(o.meal_title)} <span class="order-qty-badge">× ${o.quantity || 1}</span></h3>
          <p class="order-customer">👤 <strong>${escO(o.customer_name)}</strong></p>
          ${
            o.selected_options && o.selected_options.length
              ? `<p class="order-opts-line">📝 ${escO(o.selected_options.join("، "))}</p>`
              : ""
          }
          <p class="order-coins-line">🪙 ${o.points || 0} <span data-i18n="coins">coins</span></p>
          ${
            o.note
              ? `<p class="order-note-line"><span data-i18n="orderNote">Note</span>: ${escO(
                  o.note
                )}</p>`
              : ""
          }
          <p class="order-time">${new Date(o.created_at).toLocaleString()}</p>
        </div>
        <button class="ready-btn" data-order-id="${o.id}" data-i18n="markReady">Ready ✓</button>
      </div>
    `
    )
    .join("");
  list.querySelectorAll(".ready-btn").forEach((btn) => {
    btn.addEventListener("click", () => markReady(parseInt(btn.getAttribute("data-order-id"))));
  });
  applyLang();
}

async function markReady(id) {
  const order = ordersCache.find((o) => o.id === id);
  const { error } = await sb.from("orders").update({ status: "ready" }).eq("id", id);
  if (error) {
    alert(error.message);
    return;
  }

  // 1) Ping the customer's browser (if they still have the site open).
  if (order && order.client_token) {
    try {
      const ch = sb.channel(`ready-${order.client_token}`);
      await ch.subscribe();
      await ch.send({
        type: "broadcast",
        event: "order_ready",
        payload: { meal_title: order.meal_title, quantity: order.quantity || 1 },
      });
      sb.removeChannel(ch);
    } catch (err) {
      console.warn("ready broadcast failed:", err);
    }
  }

  // 2) Email them (only if they left an address). Recipient is read server-side.
  try {
    await sb.functions.invoke("order-ready-email", { body: { order_id: id } });
  } catch (err) {
    console.warn("ready email failed (order still marked ready):", err);
  }

  ordersCache = ordersCache.filter((o) => o.id !== id);
  renderOrders();
}

function subscribeOrders() {
  sb.channel("orders-dashboard")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "orders" },
      (payload) => {
        ordersCache.unshift(payload.new);
        renderOrders();
      }
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "orders" },
      (payload) => {
        // If an order was marked ready elsewhere, drop it from the active list.
        if (payload.new.status !== "new") {
          ordersCache = ordersCache.filter((o) => o.id !== payload.new.id);
          renderOrders();
        }
      }
    )
    .subscribe();
}

document.addEventListener("DOMContentLoaded", async () => {
  await authReady;
  if (!isAdmin()) {
    window.location.replace("account.html");
    return;
  }
  await loadOrders();
  renderOrders();
  subscribeOrders();
});

document.addEventListener("langchange", renderOrders);

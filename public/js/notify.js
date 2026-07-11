// Admin-only live order alerts: when Chef Sana is logged in and a guest places
// an order, show an in-app toast + play a chime (+ a browser notification if
// allowed). Regular visitors never see this — both the database (RLS on orders)
// and the isAdmin() guard below restrict it to the admin.

let _ordersChannel = null;
let _audioCtx = null;

function _initAudio() {
  if (_audioCtx) return;
  try {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (_e) {
    /* no audio available */
  }
}

// Browsers block audio until the user interacts with the page; resume on any
// click/keypress so the chime can play afterwards.
["click", "keydown", "touchstart"].forEach((ev) =>
  document.addEventListener(
    ev,
    () => {
      _initAudio();
      if (_audioCtx && _audioCtx.state === "suspended") _audioCtx.resume();
    },
    { passive: true }
  )
);

function _playChime() {
  if (!_audioCtx) return;
  const now = _audioCtx.currentTime;
  [880, 1320].forEach((freq, i) => {
    const osc = _audioCtx.createOscillator();
    const gain = _audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(_audioCtx.destination);
    const start = now + i * 0.18;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
    osc.start(start);
    osc.stop(start + 0.4);
  });
}

function _esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function _showToast(title, body, onClick) {
  let wrap = document.getElementById("toast-wrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "toast-wrap";
    document.body.appendChild(wrap);
  }
  const toast = document.createElement("div");
  toast.className = "order-toast";
  toast.innerHTML = `<span class="toast-bell">🛎️</span>
    <div class="toast-text"><strong>${_esc(title)}</strong><div>${_esc(body)}</div>
      <div class="toast-hint">${_esc(t("viewMeal"))}</div></div>`;
  wrap.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  const remove = () => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  };
  toast.addEventListener("click", () => {
    if (typeof onClick === "function") onClick();
    remove();
  });
  setTimeout(remove, 9000);
}

// Open/reveal the ordered meal's card. If we're not on the home page (where the
// cards live), navigate there with ?meal=ID so it reveals on load.
function openOrderedMeal(mealId) {
  if (mealId == null) return;
  if (typeof window.revealMeal === "function" && window.revealMeal(mealId)) return;
  const inPages = location.pathname.includes("/pages/");
  window.location.href =
    (inPages ? "../index.html" : "index.html") + "?meal=" + encodeURIComponent(mealId);
}

function _faviconHref() {
  const link = document.querySelector('link[rel="icon"]');
  return link ? link.href : undefined;
}

function notifyOrder(order) {
  const title = t("newOrderTitle");
  let body = `${order.customer_name} — ${order.meal_title}`;
  if (order.note) body += ` (${order.note})`;
  const open = () => openOrderedMeal(order.meal_id);
  _playChime();
  _showToast(title, body, open);
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      const n = new Notification(title, { body, icon: _faviconHref() });
      n.onclick = () => {
        window.focus();
        open();
        n.close();
      };
    } catch (_e) {
      /* ignore */
    }
  }
}

function startOrderAlerts() {
  if (_ordersChannel) return;
  _ordersChannel = sb
    .channel("orders-admin-alerts")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "orders" },
      (payload) => notifyOrder(payload.new)
    )
    .subscribe();
  // Ask for OS-level notification permission (optional; toast works regardless).
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}

function stopOrderAlerts() {
  if (_ordersChannel) {
    sb.removeChannel(_ordersChannel);
    _ordersChannel = null;
  }
}

// Start only for admins; stop on logout / non-admin.
document.addEventListener("authchange", (e) => {
  if (e.detail && e.detail.isAdmin) startOrderAlerts();
  else stopOrderAlerts();
});

// Handle the case where the admin session is already restored on page load.
(async function () {
  await authReady;
  if (isAdmin()) startOrderAlerts();
})();

/* ============================================================
   Customer side: "your order is ready" alert.
   Chef Sana's dashboard broadcasts on a channel named after this
   browser's private token, so only the person who ordered sees it.
   ============================================================ */

function showReadyBird(mealTitle, quantity) {
  const overlay = document.createElement("div");
  overlay.className = "ready-overlay";

  const box = document.createElement("div");
  box.className = "ready-box";

  const img = document.createElement("img");
  img.src = location.pathname.includes("/pages/")
    ? "../img/order-bird.gif"
    : "img/order-bird.gif";
  img.alt = "";
  img.className = "ready-bird-img";
  img.onerror = () => {
    const e = document.createElement("div");
    e.className = "ready-bird-emoji";
    e.textContent = "🐤";
    box.replaceChild(e, img);
  };
  box.appendChild(img);

  const title = document.createElement("h2");
  title.textContent = t("orderReadyTitle");
  box.appendChild(title);

  const meal = document.createElement("p");
  meal.className = "ready-meal";
  meal.textContent = quantity > 1 ? `${mealTitle} × ${quantity}` : mealTitle;
  box.appendChild(meal);

  const sub = document.createElement("p");
  sub.className = "ready-sub";
  sub.textContent = t("orderReadyBody");
  box.appendChild(sub);

  const btn = document.createElement("button");
  btn.textContent = t("close");
  btn.addEventListener("click", () => overlay.remove());
  box.appendChild(btn);

  overlay.appendChild(box);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
}

function notifyOrderReady(payload) {
  const meal = (payload && payload.meal_title) || "";
  const qty = (payload && payload.quantity) || 1;
  _playChime();
  showReadyBird(meal, qty);
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(t("orderReadyTitle"), {
        body: meal,
        icon: _faviconHref(),
      });
    } catch (_e) {
      /* ignore */
    }
  }
}

// Listen on this browser's private channel for its own order-ready pings.
(function startReadyListener() {
  const token = getClientToken();
  sb.channel(`ready-${token}`)
    .on("broadcast", { event: "order_ready" }, ({ payload }) => notifyOrderReady(payload))
    .subscribe();
})();

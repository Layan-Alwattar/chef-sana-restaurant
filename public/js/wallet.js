// Coins Wallet — a friendly, game-style view of the points spent on orders.
//   • Admin (Chef Sana): everyone's coins, monthly totals, a leaderboard.
//   • Logged-in visitor: their own coins + order count.
//   • Guest: a prompt to log in.

function wEsc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function monthKey(d) {
  const x = new Date(d);
  return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0");
}
function monthShort(key) {
  const [y, m] = key.split("-");
  const d = new Date(parseInt(y), parseInt(m) - 1, 1);
  return d.toLocaleString(getLang() === "ar" ? "ar" : "en", { month: "short" });
}

async function renderWallet() {
  const box = document.getElementById("wallet-content");
  if (!box) return;
  if (isAdmin()) {
    await renderAdminWallet(box);
  } else if (currentUser()) {
    await renderUserWallet(box, currentUser());
  } else {
    box.innerHTML = `
      <div class="wallet-guest">
        <div class="wallet-big-emoji">🪙</div>
        <p data-i18n="walletLoginPrompt">Log in to see your coins!</p>
        <a class="order-btn wallet-login-link" href="account.html" data-i18n="login">Log in</a>
      </div>`;
  }
  applyLang();
}

async function renderAdminWallet(box) {
  const { data, error } = await sb
    .from("orders")
    .select("customer_name,points,created_at");
  if (error) {
    box.innerHTML = `<p class="error">${wEsc(error.message)}</p>`;
    return;
  }
  const orders = data || [];
  if (!orders.length) {
    box.innerHTML = `<p class="wallet-empty" data-i18n="noWalletData">No orders yet!</p>`;
    return;
  }

  const perPerson = {};
  const perMonth = {};
  let grand = 0;
  orders.forEach((o) => {
    const pts = o.points || 0;
    grand += pts;
    const name = (o.customer_name || "—").trim();
    if (!perPerson[name]) perPerson[name] = { orders: 0, coins: 0 };
    perPerson[name].orders++;
    perPerson[name].coins += pts;
    const mk = monthKey(o.created_at);
    perMonth[mk] = (perMonth[mk] || 0) + pts;
  });

  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(monthKey(d));
  }
  const thisMonth = perMonth[monthKey(now)] || 0;
  const maxMonth = Math.max(1, ...months.map((m) => perMonth[m] || 0));

  const bars = months
    .map((m) => {
      const v = perMonth[m] || 0;
      const h = Math.round((v / maxMonth) * 100);
      return `
      <div class="bar-col">
        <div class="bar-value">${v}</div>
        <div class="bar" style="height:${Math.max(6, h)}%"></div>
        <div class="bar-label">${wEsc(monthShort(m))}</div>
      </div>`;
    })
    .join("");

  const medals = ["👑", "🥈", "🥉"];
  const people = Object.entries(perPerson).sort((a, b) => b[1].coins - a[1].coins);
  const rows = people
    .map((p, i) => {
      const [name, s] = p;
      return `
      <div class="lb-row${i === 0 ? " lb-top" : ""}">
        <span class="lb-rank">${medals[i] || i + 1}</span>
        <span class="lb-name">${wEsc(name)}</span>
        <span class="lb-orders">${s.orders} <span data-i18n="ordersWord">orders</span></span>
        <span class="lb-coins">🪙 ${s.coins}</span>
      </div>`;
    })
    .join("");

  box.innerHTML = `
    <div class="wallet-cards">
      <div class="wallet-card wallet-card-month">
        <div class="wc-emoji">🪙</div>
        <div class="wc-num">${thisMonth}</div>
        <div class="wc-label" data-i18n="thisMonthCoins">Coins this month</div>
      </div>
      <div class="wallet-card wallet-card-total">
        <div class="wc-emoji">🏦</div>
        <div class="wc-num">${grand}</div>
        <div class="wc-label" data-i18n="totalCoins">Total coins</div>
      </div>
    </div>

    <h2 class="wallet-h2" data-i18n="coinsPerMonth">Coins each month</h2>
    <div class="wallet-bars">${bars}</div>

    <h2 class="wallet-h2" data-i18n="leaderboard">Top players</h2>
    <div class="leaderboard">${rows}</div>
  `;
}

async function renderUserWallet(box, user) {
  const { data, error } = await sb
    .from("orders")
    .select("points,created_at")
    .eq("user_id", user.id);
  if (error) {
    box.innerHTML = `<p class="error">${wEsc(error.message)}</p>`;
    return;
  }
  const orders = data || [];
  const coins = orders.reduce((s, o) => s + (o.points || 0), 0);
  const count = orders.length;
  const timesMsg = t("youOrderedTimes").replace("{n}", count);

  box.innerHTML = `
    <div class="wallet-user">
      <div class="wallet-big-emoji">🪙</div>
      <div class="wallet-user-coins">${coins}</div>
      <div class="wallet-user-label" data-i18n="yourCoins">Your coins</div>
      <div class="wallet-user-orders">${wEsc(timesMsg)}</div>
    </div>`;
}

document.addEventListener("DOMContentLoaded", async () => {
  await authReady;
  renderWallet();
});
document.addEventListener("authchange", renderWallet);
document.addEventListener("langchange", renderWallet);

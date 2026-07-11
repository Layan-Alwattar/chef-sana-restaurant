// Public viewer: live list of meals (realtime), reviews, ordering, favorites.
// Data lives in Supabase now, not localStorage, so every visitor sees the chef's
// changes instantly. Admin-only edit/delete are gated by auth.js + RLS.

let mealsCache = [];
let favoriteIds = new Set();
let categoriesCache = [];
let currentCategoryId = null; // active category tab (null = All)

// ---------- data loading ----------
async function loadMeals() {
  const { data, error } = await sb
    .from("meals")
    .select("*, reviews(id,name,rating,comment,created_at), meal_categories(category_id)")
    .order("created_at", { ascending: true });
  if (error) {
    console.error("Failed to load meals:", error);
    return;
  }
  mealsCache = data || [];
}

async function loadCategories() {
  const { data, error } = await sb
    .from("categories")
    .select("id,name")
    .order("position", { ascending: true })
    .order("name", { ascending: true });
  if (error) {
    console.error("Failed to load categories:", error);
    return;
  }
  categoriesCache = data || [];
}

function mealInCategory(meal, categoryId) {
  return (meal.meal_categories || []).some((mc) => mc.category_id === categoryId);
}

async function loadFavorites() {
  favoriteIds = new Set();
  const user = currentUser();
  if (!user) return;
  const { data, error } = await sb
    .from("favorites")
    .select("meal_id")
    .eq("user_id", user.id);
  if (!error) (data || []).forEach((f) => favoriteIds.add(f.meal_id));
}

function currentSearch() {
  const s = document.getElementById("search");
  return s ? s.value : "";
}

// ---------- helpers (unchanged behavior) ----------
function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function avgRating(meal) {
  if (!meal.reviews || meal.reviews.length === 0) return 0;
  const sum = meal.reviews.reduce((s, r) => s + (r.rating || 0), 0);
  return sum / meal.reviews.length;
}

function matchesSearch(meal, raw) {
  const q = (raw || "").trim().toLowerCase();
  if (!q) return true;
  if (q.startsWith("#")) {
    const tagQ = q.slice(1);
    return (meal.tags || []).some((t) => t.toLowerCase().includes(tagQ));
  }
  if (meal.title && meal.title.toLowerCase().includes(q)) return true;
  return (meal.tags || []).some((t) => t.toLowerCase().includes(q));
}

function renderStars(rating, interactive, mealId) {
  let html = `<span class="stars-row${interactive ? " interactive" : ""}" ${
    interactive ? `data-meal-id="${mealId}"` : ""
  }>`;
  for (let i = 1; i <= 5; i++) {
    const filled = i <= Math.round(rating);
    html += `<span class="star ${filled ? "filled" : ""}" data-value="${i}">★</span>`;
  }
  html += `</span>`;
  return html;
}

function renderReviews(meal) {
  if (!meal.reviews || meal.reviews.length === 0) {
    return `<p class="no-reviews">${t("noReviews")}</p>`;
  }
  return meal.reviews
    .slice()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(
      (r) => `
      <div class="review">
        <div class="review-head">
          <strong>${escapeHtml(r.name)}</strong>
          <span class="stars small">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</span>
        </div>
        <p class="review-comment">${escapeHtml(r.comment)}</p>
        <small class="review-date">${new Date(r.created_at).toLocaleString()}</small>
      </div>
    `
    )
    .join("");
}

// Translate [data-i18n*] nodes within a subtree WITHOUT dispatching langchange
// (applyLang() dispatches the event globally, which would re-enter renderMeals).
function translateWithin(root) {
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
  });
  root.querySelectorAll("[data-i18n-title]").forEach((el) => {
    el.title = t(el.getAttribute("data-i18n-title"));
  });
}

// Build the menu tabs from the admin-defined categories (plus "All").
function renderTabs() {
  const wrap = document.getElementById("category-tabs");
  if (!wrap) return;
  if (!categoriesCache.length) {
    wrap.innerHTML = "";
    return;
  }
  let html = `<button class="cat-tab${
    currentCategoryId ? "" : " active"
  }" data-cat="">${t("allCategory")}</button>`;
  html += categoriesCache
    .map(
      (c) =>
        `<button class="cat-tab${
          currentCategoryId === c.id ? " active" : ""
        }" data-cat="${c.id}">${escapeHtml(c.name)}</button>`
    )
    .join("");
  wrap.innerHTML = html;
  wrap.querySelectorAll(".cat-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      const raw = btn.getAttribute("data-cat");
      currentCategoryId = raw ? parseInt(raw) : null;
      renderMeals(currentSearch());
    });
  });
}

// ---------- render ----------
let _rendering = false;
function renderMeals(searchText = "") {
  // Guard against re-entrancy: applyLang() at the end dispatches "langchange",
  // whose listener calls renderMeals again — this stops the recursion.
  if (_rendering) return;
  _rendering = true;
  const container = document.getElementById("meals-list");
  if (!container) {
    _rendering = false;
    return;
  }
  container.innerHTML = "";
  renderTabs();

  mealsCache
    .filter((m) => matchesSearch(m, searchText))
    .filter((m) => !currentCategoryId || mealInCategory(m, currentCategoryId))
    .forEach((meal) => {
      const card = document.createElement("div");
      card.className = "card";
      card.setAttribute("data-meal-id", meal.id);
      const avg = avgRating(meal);
      const isFav = favoriteIds.has(meal.id);
      card.innerHTML = `
        <div class="meal-img-wrap">
          <img src="${escapeHtml(meal.image) || "https://via.placeholder.com/150"}" alt="${escapeHtml(
        meal.title
      )}" class="meal-img"/>
          <button class="fav-btn${isFav ? " faved" : ""}" data-auth-in title="${t(
        "favorite"
      )}">${isFav ? "♥" : "♡"}</button>
        </div>
        <div class="card-content">
          <h3>${escapeHtml(meal.title)}</h3>
          <p><strong data-i18n="date">Date</strong>: ${new Date(meal.created_at).toLocaleString()}</p>
          <p><strong data-i18n="tags">Tags</strong>:
            ${(meal.tags || [])
              .map(
                (tag) =>
                  `<span class="tag clickable-tag" data-tag="${escapeHtml(tag)}">#${escapeHtml(
                    tag
                  )}</span>`
              )
              .join(" ")}
          </p>
          <p><strong data-i18n="calories">Calories</strong>: ${meal.calories} <span data-i18n="kcal">kcal</span></p>
          <p class="coins-line">🪙 <strong>${meal.points || 0}</strong> <span data-i18n="coins">coins</span></p>
          <p><strong data-i18n="satisfaction">Satisfaction</strong>: <span class="stars">${"⭐".repeat(
            meal.satisfaction || 0
          )}</span></p>
          <p class="meta-row">
            <span>👁️ <span data-i18n="views">Views</span>: <strong>${meal.views || 0}</strong></span>
            <span>⭐ <span data-i18n="avgRating">Avg. Rating</span>:
              <strong>${avg ? avg.toFixed(1) : "—"}</strong>
              (${meal.reviews ? meal.reviews.length : 0})
            </span>
          </p>

          <button class="order-btn" data-i18n="orderNow">Order now</button>

          <button class="toggle-desc-btn" data-i18n="showDescription">Show Description</button>
          <p class="description hidden">${escapeHtml(meal.description)}</p>

          <div class="reviews-section">
            <div class="reviews-header">
              <h4 data-i18n="reviews">Reviews</h4>
              <button type="button" class="toggle-reviews-btn" data-i18n="showReviews">Show Reviews</button>
            </div>
            <div class="reviews-body hidden">
            <div class="reviews-list">${renderReviews(meal)}</div>
            <form class="review-form" data-meal-id="${meal.id}">
              <label class="rating-label" data-i18n="rateThisMeal">Rate this meal</label>
              ${renderStars(0, true, meal.id)}
              <input type="hidden" name="rating" value="0" />
              <input type="text" name="name" data-i18n-placeholder="yourName" placeholder="Your name" required />
              <textarea name="comment" data-i18n-placeholder="yourComment" placeholder="Write a comment..." required></textarea>
              <button type="submit" data-i18n="submitReview">Submit Review</button>
            </form>
            </div>
          </div>

          <div class="actions-btns" data-admin-only>
            <button class="edit-btn">✏️</button>
            <button class="delete-btn">🗑️</button>
          </div>
        </div>
      `;
      container.appendChild(card);
    });

  attachCardHandlers();
  applyAdminUi();
  applyAuthUi();
  applyLang(); // dispatches langchange → guarded re-entry above is a no-op
  _rendering = false;
}

// View counter increments once per meal per page load.
const viewedMeals = new Set();

function attachCardHandlers() {
  document.querySelectorAll(".card").forEach((card) => {
    const id = parseInt(card.getAttribute("data-meal-id"));
    if (viewedMeals.has(id)) return;
    viewedMeals.add(id);
    incrementView(id);
  });

  document.querySelectorAll(".toggle-desc-btn").forEach((btn) => {
    btn.addEventListener("click", () => toggleDescription(btn));
  });

  document.querySelectorAll(".toggle-reviews-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const body = btn.closest(".reviews-section").querySelector(".reviews-body");
      const hidden = body.classList.toggle("hidden");
      const key = hidden ? "showReviews" : "hideReviews";
      btn.setAttribute("data-i18n", key);
      btn.textContent = t(key);
    });
  });

  document.querySelectorAll(".clickable-tag").forEach((chip) => {
    chip.addEventListener("click", () => {
      const tag = chip.getAttribute("data-tag");
      const search = document.getElementById("search");
      if (search) {
        search.value = "#" + tag;
        renderMeals(search.value);
      }
    });
  });

  // Order buttons
  document.querySelectorAll(".card .order-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = parseInt(btn.closest(".card").getAttribute("data-meal-id"));
      const meal = mealsCache.find((m) => m.id === id);
      if (meal) openOrderModal(meal);
    });
  });

  // Favorite hearts
  document.querySelectorAll(".card .fav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = parseInt(btn.closest(".card").getAttribute("data-meal-id"));
      toggleFavorite(id, btn);
    });
  });

  // Star rating in review form
  document.querySelectorAll(".stars-row.interactive").forEach((row) => {
    row.querySelectorAll(".star").forEach((star) => {
      star.addEventListener("click", () => {
        const val = parseInt(star.getAttribute("data-value"));
        const form = row.closest(".review-form");
        form.querySelector('input[name="rating"]').value = val;
        row.querySelectorAll(".star").forEach((s) => {
          s.classList.toggle("filled", parseInt(s.getAttribute("data-value")) <= val);
        });
      });
    });
  });

  // Submit review
  document.querySelectorAll(".review-form").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const id = parseInt(form.getAttribute("data-meal-id"));
      const rating = parseInt(form.querySelector('input[name="rating"]').value);
      const name = form.querySelector('input[name="name"]').value.trim();
      const comment = form.querySelector('textarea[name="comment"]').value.trim();
      if (!rating) {
        alert(t("pleaseRate"));
        return;
      }
      if (!name) {
        alert(t("pleaseName"));
        return;
      }
      if (!comment) {
        alert(t("pleaseComment"));
        return;
      }
      addReview(id, { rating, name, comment });
    });
  });

  // Admin edit/delete
  document.querySelectorAll(".card .edit-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!isAdmin()) return;
      const id = parseInt(btn.closest(".card").getAttribute("data-meal-id"));
      const meal = mealsCache.find((m) => m.id === id);
      if (meal) editMeal(meal);
    });
  });
  document.querySelectorAll(".card .delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!isAdmin()) return;
      const id = parseInt(btn.closest(".card").getAttribute("data-meal-id"));
      deleteMeal(id);
    });
  });
}

async function incrementView(id) {
  await sb.rpc("increment_meal_views", { p_meal_id: id });
  // Optimistically bump the local badge; realtime will reconcile.
  const meal = mealsCache.find((m) => m.id === id);
  if (meal) meal.views = (meal.views || 0) + 1;
  const card = document.querySelector(`.card[data-meal-id="${id}"]`);
  if (card) {
    const strong = card.querySelector(".meta-row strong");
    if (strong && meal) strong.textContent = meal.views;
  }
}

async function addReview(id, review) {
  const { error } = await sb.from("reviews").insert({
    meal_id: id,
    name: review.name,
    rating: review.rating,
    comment: review.comment,
  });
  if (error) {
    alert(error.message);
    return;
  }
  await loadMeals();
  renderMeals(currentSearch());
}

async function deleteMeal(id) {
  if (!confirm(t("confirmDelete"))) return;
  const { error } = await sb.from("meals").delete().eq("id", id);
  if (error) {
    alert(error.message);
    return;
  }
  await loadMeals();
  renderMeals(currentSearch());
}

// ---------- favorites ----------
async function toggleFavorite(mealId, btn) {
  const user = currentUser();
  if (!user) {
    alert(t("loginToFavorite"));
    return;
  }
  if (favoriteIds.has(mealId)) {
    const { error } = await sb
      .from("favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("meal_id", mealId);
    if (error) {
      alert(error.message);
      return;
    }
    favoriteIds.delete(mealId);
  } else {
    const { error } = await sb
      .from("favorites")
      .insert({ user_id: user.id, meal_id: mealId });
    if (error) {
      alert(error.message);
      return;
    }
    favoriteIds.add(mealId);
  }
  const faved = favoriteIds.has(mealId);
  btn.classList.toggle("faved", faved);
  btn.textContent = faved ? "♥" : "♡";
}

// ---------- ordering ----------
let _orderMeal = null;

function ensureOrderModal() {
  if (document.getElementById("order-modal")) return;
  const modal = document.createElement("div");
  modal.id = "order-modal";
  modal.className = "modal-overlay hidden";
  modal.innerHTML = `
    <div class="modal-box">
      <h3 id="order-modal-title" data-i18n="orderTitle">Place an order</h3>
      <p class="order-meal-name" id="order-meal-name"></p>
      <p class="order-coins" id="order-coins"></p>
      <form id="order-form">
        <div id="order-options" class="order-options"></div>
        <div class="qty-row">
          <span class="qty-label" data-i18n="quantity">Quantity</span>
          <div class="qty-stepper">
            <button type="button" id="qty-minus" aria-label="-">−</button>
            <input type="number" id="order-qty" min="1" step="1" value="1" />
            <button type="button" id="qty-plus" aria-label="+">+</button>
          </div>
        </div>
        <input type="text" id="order-name" data-i18n-placeholder="yourName" placeholder="Your name" required />
        <input type="email" id="order-email" data-i18n-placeholder="yourEmail" placeholder="Your email (optional)" />
        <small class="email-hint" data-i18n="emailForReady">We'll email you when your order is ready.</small>
        <textarea id="order-note" data-i18n-placeholder="orderNotePlaceholder" placeholder="Optional note or address..."></textarea>
        <div class="modal-actions">
          <button type="button" id="order-cancel" class="btn-secondary" data-i18n="cancel">Cancel</button>
          <button type="submit" data-i18n="sendOrder">Send order</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeOrderModal();
  });
  modal.querySelector("#order-cancel").addEventListener("click", closeOrderModal);
  modal.querySelector("#order-form").addEventListener("submit", submitOrder);

  // Quantity stepper — open-ended upwards, never below 1.
  const qtyInput = modal.querySelector("#order-qty");
  const setQty = (n) => {
    qtyInput.value = Math.max(1, n || 1);
    updateOrderCoins();
  };
  modal.querySelector("#qty-minus").addEventListener("click", () =>
    setQty(parseInt(qtyInput.value) - 1)
  );
  modal.querySelector("#qty-plus").addEventListener("click", () =>
    setQty(parseInt(qtyInput.value) + 1)
  );
  qtyInput.addEventListener("input", updateOrderCoins);
  qtyInput.addEventListener("blur", () => setQty(parseInt(qtyInput.value)));
}

// Show the live coin total (meal points × quantity) in the order modal.
function updateOrderCoins() {
  if (!_orderMeal) return;
  const qty = Math.max(1, parseInt(document.getElementById("order-qty").value) || 1);
  const total = (_orderMeal.points || 0) * qty;
  const el = document.getElementById("order-coins");
  if (el) el.innerHTML = `🪙 ${total} <span data-i18n="coins">coins</span>`;
}

function openOrderModal(meal) {
  ensureOrderModal();
  _orderMeal = meal;
  const modal = document.getElementById("order-modal");
  modal.querySelector("#order-meal-name").textContent = meal.title;
  modal.querySelector("#order-qty").value = 1;
  updateOrderCoins();

  // Build option checkboxes for this meal (if any).
  const optWrap = modal.querySelector("#order-options");
  if (meal.options && meal.options.length) {
    optWrap.innerHTML =
      `<div class="order-options-label" data-i18n="chooseOptions">Choose options</div>` +
      meal.options
        .map(
          (o) =>
            `<label class="opt-check"><input type="checkbox" value="${escapeHtml(
              o
            )}" /> <span>${escapeHtml(o)}</span></label>`
        )
        .join("");
  } else {
    optWrap.innerHTML = "";
  }

  const nameInput = modal.querySelector("#order-name");
  const user = currentUser();
  nameInput.value =
    (user && (user.user_metadata?.name || user.email?.split("@")[0])) || "";
  modal.querySelector("#order-email").value = (user && user.email) || "";
  modal.querySelector("#order-note").value = "";
  modal.classList.remove("hidden");
  translateWithin(modal);
  nameInput.focus();
}

function closeOrderModal() {
  const modal = document.getElementById("order-modal");
  if (modal) modal.classList.add("hidden");
  _orderMeal = null;
}

async function submitOrder(e) {
  e.preventDefault();
  if (!_orderMeal) return;
  const meal = _orderMeal;
  const name = document.getElementById("order-name").value.trim();
  const note = document.getElementById("order-note").value.trim();
  const email = document.getElementById("order-email").value.trim();
  const quantity = Math.max(1, parseInt(document.getElementById("order-qty").value) || 1);
  if (!name) {
    alert(t("pleaseName"));
    return;
  }
  const selectedOptions = Array.from(
    document.querySelectorAll("#order-options input[type=checkbox]:checked")
  ).map((c) => c.value);

  const submitBtn = e.target.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;

  const user = currentUser();
  const { error } = await sb.from("orders").insert({
    meal_id: meal.id,
    meal_title: meal.title,
    customer_name: name,
    customer_email: email || null,
    note: note || null,
    quantity,
    selected_options: selectedOptions,
    user_id: user ? user.id : null,
    client_token: getClientToken(),
  });

  if (error) {
    if (submitBtn) submitBtn.disabled = false;
    alert(error.message);
    return;
  }

  // Best-effort email to the chef; the order is already saved either way.
  try {
    await sb.functions.invoke("order-email", {
      body: {
        meal_title: meal.title,
        customer_name: name,
        note,
        options: selectedOptions,
        coins: (meal.points || 0) * quantity,
        quantity,
      },
    });
  } catch (err) {
    console.warn("order email failed (order still recorded):", err);
  }

  if (submitBtn) submitBtn.disabled = false;
  closeOrderModal();
  celebrateOrder(meal.id);
}

function toggleDescription(button) {
  const desc = button.nextElementSibling;
  if (desc.classList.contains("hidden")) {
    desc.classList.remove("hidden");
    button.setAttribute("data-i18n", "hideDescription");
    button.textContent = t("hideDescription");
  } else {
    desc.classList.add("hidden");
    button.setAttribute("data-i18n", "showDescription");
    button.textContent = t("showDescription");
  }
}

function editMeal(meal) {
  localStorage.setItem("editingMeal", JSON.stringify(meal));
  window.location.href = "pages/add.html";
}

// Scroll to a meal's card and flash it. Used when the admin clicks an order
// notification. Clears any active search so the card is guaranteed to render.
function revealMeal(mealId) {
  if (mealId == null) return false;
  const search = document.getElementById("search");
  if (search && search.value) {
    search.value = "";
    renderMeals("");
  }
  const card = document.querySelector(`.card[data-meal-id="${mealId}"]`);
  if (!card) return false;
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  card.classList.remove("highlight");
  void card.offsetWidth; // restart the animation if already applied
  card.classList.add("highlight");
  setTimeout(() => card.classList.remove("highlight"), 3200);
  return true;
}
window.revealMeal = revealMeal;

// Cheerful bird that pops up near the ordered meal as an order confirmation.
// Uses public/img/order-bird.png; falls back to an emoji if that file isn't there.
function celebrateOrder(mealId) {
  const bird = document.createElement("div");
  bird.className = "order-bird";
  const img = document.createElement("img");
  img.src = location.pathname.includes("/pages/")
    ? "../img/order-bird.gif"
    : "img/order-bird.gif";
  img.alt = "";
  img.className = "order-bird-img";
  img.onerror = () => {
    const e = document.createElement("span");
    e.className = "order-bird-emoji";
    e.textContent = "🐤";
    bird.replaceChild(e, img);
  };
  bird.appendChild(img);
  const cap = document.createElement("div");
  cap.className = "order-bird-cap";
  cap.textContent = t("orderSent");
  bird.appendChild(cap);

  const card = document.querySelector(`.card[data-meal-id="${mealId}"]`);
  if (card) {
    const r = card.getBoundingClientRect();
    bird.style.left = window.scrollX + r.left + r.width / 2 - 65 + "px";
    bird.style.top = window.scrollY + r.top + r.height / 2 - 80 + "px";
  } else {
    bird.style.left = "50%";
    bird.style.top = "40%";
    bird.style.marginInlineStart = "-65px";
  }
  document.body.appendChild(bird);
  setTimeout(() => bird.remove(), 3400);
}

// ---------- realtime ----------
let _reloadTimer = null;
function scheduleReload() {
  clearTimeout(_reloadTimer);
  _reloadTimer = setTimeout(async () => {
    await Promise.all([loadMeals(), loadCategories()]);
    // A deleted category shouldn't leave us stuck on an empty tab.
    if (currentCategoryId && !categoriesCache.some((c) => c.id === currentCategoryId)) {
      currentCategoryId = null;
    }
    renderMeals(currentSearch());
  }, 350);
}

function subscribeRealtime() {
  sb.channel("public-menu-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "meals" }, scheduleReload)
    .on("postgres_changes", { event: "*", schema: "public", table: "reviews" }, scheduleReload)
    .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, scheduleReload)
    .on("postgres_changes", { event: "*", schema: "public", table: "meal_categories" }, scheduleReload)
    .subscribe();
}

// ---------- boot ----------
document.addEventListener("DOMContentLoaded", async () => {
  await authReady;
  await Promise.all([loadMeals(), loadFavorites(), loadCategories()]);
  renderMeals();
  subscribeRealtime();

  // If we arrived from an order notification on another page (index.html?meal=ID),
  // reveal that meal once the grid is rendered.
  const mealParam = new URLSearchParams(location.search).get("meal");
  if (mealParam) {
    revealMeal(parseInt(mealParam));
    history.replaceState({}, document.title, location.pathname);
  }

  const search = document.getElementById("search");
  if (search) {
    search.addEventListener("input", () => renderMeals(search.value));
  }

  const logout = document.getElementById("logout-link");
  if (logout) {
    logout.addEventListener("click", (e) => {
      e.preventDefault();
      signOutUser();
    });
  }
});

// Re-render when the user logs in/out (favorites + admin buttons change).
document.addEventListener("authchange", async () => {
  await loadFavorites();
  renderMeals(currentSearch());
});

document.addEventListener("langchange", () => {
  renderMeals(currentSearch());
});

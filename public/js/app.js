// Public viewer: list meals, search by title/tag, add reviews & ratings.
// Admin-only actions (edit/delete) are gated by auth.js + the [data-admin-only]
// markers in the rendered card.

async function initializeMeals() {
  const mealsFromStorage = localStorage.getItem("meals");
  if (!mealsFromStorage) {
    try {
      const response = await fetch("https://gist.githubusercontent.com/abdalabaaji/b858d603dd6215b6e93627a4f3eeb7f0/raw/21db65d8353957f910f4a4cf093ba9394dc45ca1/meals");
      const meals = await response.json();
      localStorage.setItem("meals", JSON.stringify(meals));
    } catch (error) {
      console.error("Failed to fetch meals from server:", error);
    }
  }
}

function getMeals() {
  const meals = JSON.parse(localStorage.getItem("meals") || "[]");
  // Normalize older meals so reviews/views always exist.
  let mutated = false;
  meals.forEach(m => {
    if (typeof m.views !== "number") { m.views = 0; mutated = true; }
    if (!Array.isArray(m.reviews)) { m.reviews = []; mutated = true; }
  });
  if (mutated) localStorage.setItem("meals", JSON.stringify(meals));
  return meals;
}

function saveMeals(meals) {
  localStorage.setItem("meals", JSON.stringify(meals));
}

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

// Search matches title OR any tag. A leading '#' on the query forces tag-only.
function matchesSearch(meal, raw) {
  const q = (raw || "").trim().toLowerCase();
  if (!q) return true;
  if (q.startsWith("#")) {
    const tagQ = q.slice(1);
    return (meal.tags || []).some(t => t.toLowerCase().includes(tagQ));
  }
  if (meal.title && meal.title.toLowerCase().includes(q)) return true;
  return (meal.tags || []).some(t => t.toLowerCase().includes(q));
}

function renderStars(rating, interactive, mealId) {
  let html = `<span class="stars-row${interactive ? " interactive" : ""}" ${interactive ? `data-meal-id="${mealId}"` : ""}>`;
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
    .reverse()
    .map(r => `
      <div class="review">
        <div class="review-head">
          <strong>${escapeHtml(r.name)}</strong>
          <span class="stars small">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</span>
        </div>
        <p class="review-comment">${escapeHtml(r.comment)}</p>
        <small class="review-date">${new Date(r.date).toLocaleString()}</small>
      </div>
    `).join("");
}

function renderMeals(searchText = "") {
  const meals = getMeals();
  const container = document.getElementById("meals-list");
  if (!container) return;
  container.innerHTML = "";

  meals
    .filter(m => matchesSearch(m, searchText))
    .forEach(meal => {
      const card = document.createElement("div");
      card.className = "card";
      card.setAttribute("data-meal-id", meal.id);
      const avg = avgRating(meal);
      card.innerHTML = `
        <img src="${escapeHtml(meal.image) || 'https://via.placeholder.com/150'}" alt="${escapeHtml(meal.title)}" class="meal-img"/>
        <div class="card-content">
          <h3>${escapeHtml(meal.title)}</h3>
          <p><strong data-i18n="date">Date</strong>: ${new Date(meal.date).toLocaleString()}</p>
          <p><strong data-i18n="tags">Tags</strong>:
            ${(meal.tags || []).map(tag => `<span class="tag clickable-tag" data-tag="${escapeHtml(tag)}">#${escapeHtml(tag)}</span>`).join(" ")}
          </p>
          <p><strong data-i18n="calories">Calories</strong>: ${meal.calories} <span data-i18n="kcal">kcal</span></p>
          <p><strong data-i18n="satisfaction">Satisfaction</strong>: <span class="stars">${'⭐'.repeat(meal.satisfaction || 0)}</span></p>
          <p class="meta-row">
            <span>👁️ <span data-i18n="views">Views</span>: <strong>${meal.views || 0}</strong></span>
            <span>⭐ <span data-i18n="avgRating">Avg. Rating</span>:
              <strong>${avg ? avg.toFixed(1) : "—"}</strong>
              (${meal.reviews ? meal.reviews.length : 0})
            </span>
          </p>
          <button class="toggle-desc-btn" data-i18n="showDescription">Show Description</button>
          <p class="description hidden">${escapeHtml(meal.description)}</p>

          <div class="reviews-section">
            <div class="reviews-header">
              <h4 data-i18n="reviews">Reviews</h4>
              <button type="button" class="toggle-reviews-btn" data-i18n="hideReviews">Hide Reviews</button>
            </div>
            <div class="reviews-body">
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
  applyLang(); // re-apply translations to newly inserted nodes
}

// View counter increments once per meal per page load, not per re-render.
const viewedMeals = new Set();

function attachCardHandlers() {
  document.querySelectorAll(".card").forEach(card => {
    const id = parseInt(card.getAttribute("data-meal-id"));
    if (viewedMeals.has(id)) return;
    viewedMeals.add(id);
    incrementView(id);
  });

  // Show/hide description
  document.querySelectorAll(".toggle-desc-btn").forEach(btn => {
    btn.addEventListener("click", () => toggleDescription(btn));
  });

  // Show/hide reviews section
  document.querySelectorAll(".toggle-reviews-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const body = btn.closest(".reviews-section").querySelector(".reviews-body");
      const hidden = body.classList.toggle("hidden");
      const key = hidden ? "showReviews" : "hideReviews";
      btn.setAttribute("data-i18n", key);
      btn.textContent = t(key);
    });
  });

  // Click a tag chip to filter by it
  document.querySelectorAll(".clickable-tag").forEach(chip => {
    chip.addEventListener("click", () => {
      const tag = chip.getAttribute("data-tag");
      const search = document.getElementById("search");
      if (search) {
        search.value = "#" + tag;
        renderMeals(search.value);
      }
    });
  });

  // Star rating in review form
  document.querySelectorAll(".stars-row.interactive").forEach(row => {
    row.querySelectorAll(".star").forEach(star => {
      star.addEventListener("click", () => {
        const val = parseInt(star.getAttribute("data-value"));
        const form = row.closest(".review-form");
        form.querySelector('input[name="rating"]').value = val;
        row.querySelectorAll(".star").forEach(s => {
          s.classList.toggle("filled", parseInt(s.getAttribute("data-value")) <= val);
        });
      });
    });
  });

  // Submit review
  document.querySelectorAll(".review-form").forEach(form => {
    form.addEventListener("submit", e => {
      e.preventDefault();
      const id = parseInt(form.getAttribute("data-meal-id"));
      const rating = parseInt(form.querySelector('input[name="rating"]').value);
      const name = form.querySelector('input[name="name"]').value.trim();
      const comment = form.querySelector('textarea[name="comment"]').value.trim();
      if (!rating) { alert(t("pleaseRate")); return; }
      if (!name) { alert(t("pleaseName")); return; }
      if (!comment) { alert(t("pleaseComment")); return; }
      addReview(id, { rating, name, comment, date: new Date().toISOString() });
    });
  });

  // Admin-only edit/delete buttons
  document.querySelectorAll(".card .edit-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (!isAdmin()) return;
      const id = parseInt(btn.closest(".card").getAttribute("data-meal-id"));
      const meal = getMeals().find(m => m.id === id);
      if (meal) editMeal(meal);
    });
  });
  document.querySelectorAll(".card .delete-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (!isAdmin()) return;
      const id = parseInt(btn.closest(".card").getAttribute("data-meal-id"));
      deleteMeal(id);
    });
  });
}

function incrementView(id) {
  const meals = getMeals();
  const meal = meals.find(m => m.id === id);
  if (!meal) return;
  meal.views = (meal.views || 0) + 1;
  saveMeals(meals);
  // Update only the views badge in place to avoid a full re-render loop.
  const card = document.querySelector(`.card[data-meal-id="${id}"]`);
  if (card) {
    const strong = card.querySelector(".meta-row strong");
    if (strong) strong.textContent = meal.views;
  }
}

function addReview(id, review) {
  const meals = getMeals();
  const meal = meals.find(m => m.id === id);
  if (!meal) return;
  if (!Array.isArray(meal.reviews)) meal.reviews = [];
  meal.reviews.push(review);
  saveMeals(meals);
  renderMeals(document.getElementById("search").value || "");
}

function deleteMeal(id) {
  if (!confirm(t("confirmDelete"))) return;
  const meals = getMeals().filter(meal => meal.id !== id);
  saveMeals(meals);
  renderMeals(document.getElementById("search").value || "");
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

document.addEventListener("DOMContentLoaded", async () => {
  await initializeMeals();
  renderMeals();

  const search = document.getElementById("search");
  if (search) {
    search.addEventListener("input", () => renderMeals(search.value));
  }

  const logout = document.getElementById("logout-link");
  if (logout) {
    logout.addEventListener("click", e => {
      e.preventDefault();
      logoutAdmin();
      applyAdminUi();
      renderMeals(search ? search.value : "");
    });
  }
});

document.addEventListener("langchange", () => {
  const search = document.getElementById("search");
  renderMeals(search ? search.value : "");
});

// Admin page to define the menu categories (Drinks, Dinner, Snacks...).
// These become the tabs on the home page. Admin-only.

let catsCache = [];

function cEsc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function loadCategoriesAdmin() {
  const { data, error } = await sb
    .from("categories")
    .select("*")
    .order("position", { ascending: true })
    .order("name", { ascending: true });
  if (error) {
    console.error("Failed to load categories:", error);
    return;
  }
  catsCache = data || [];
}

function renderCategories() {
  const list = document.getElementById("cat-list");
  const empty = document.getElementById("cat-empty");
  if (!list) return;
  empty.style.display = catsCache.length ? "none" : "";
  list.innerHTML = catsCache
    .map(
      (c) => `
      <div class="cat-row" data-id="${c.id}">
        <span class="cat-name">${cEsc(c.name)}</span>
        <button class="delete-btn cat-del" data-id="${c.id}" data-i18n="deleteCategory">Delete</button>
      </div>`
    )
    .join("");
  list.querySelectorAll(".cat-del").forEach((btn) => {
    btn.addEventListener("click", () => removeCategory(parseInt(btn.getAttribute("data-id"))));
  });
  applyLang();
}

async function addCategory(name) {
  const clean = (name || "").trim();
  if (!clean) return;
  const { error } = await sb
    .from("categories")
    .insert({ name: clean, position: catsCache.length });
  if (error) {
    alert(error.message);
    return;
  }
  await loadCategoriesAdmin();
  renderCategories();
}

async function removeCategory(id) {
  if (!confirm(t("confirmDeleteCategory"))) return;
  const { error } = await sb.from("categories").delete().eq("id", id);
  if (error) {
    alert(error.message);
    return;
  }
  catsCache = catsCache.filter((c) => c.id !== id);
  renderCategories();
}

document.addEventListener("DOMContentLoaded", async () => {
  await authReady;
  if (!isAdmin()) {
    window.location.replace("account.html");
    return;
  }
  await loadCategoriesAdmin();
  renderCategories();

  const form = document.getElementById("cat-form");
  const input = document.getElementById("cat-name");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    await addCategory(input.value);
    input.value = "";
    input.focus();
  });
});

document.addEventListener("langchange", renderCategories);

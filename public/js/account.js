// Account page: sign up / log in / log out, and the visitor's saved favorites.

let _mode = "login"; // "login" | "signup"

function $(id) {
  return document.getElementById(id);
}

function setMode(mode) {
  _mode = mode;
  $("auth-submit").textContent = t(mode === "login" ? "login" : "signup");
  $("auth-title").textContent = t(mode === "login" ? "loginTitle" : "signupTitle");
  $("auth-toggle-text").textContent = t(
    mode === "login" ? "noAccountYet" : "haveAccount"
  );
  $("auth-toggle-link").textContent = t(mode === "login" ? "signup" : "login");
  $("auth-msg").textContent = "";
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const email = $("auth-email").value.trim();
  const password = $("auth-password").value;
  const msg = $("auth-msg");
  msg.className = "auth-msg";
  msg.textContent = "";
  if (!email || !password) {
    msg.textContent = t("fillEmailPassword");
    msg.classList.add("error");
    return;
  }
  const btn = $("auth-submit");
  btn.disabled = true;
  try {
    if (_mode === "signup") {
      const { data, error } = await sb.auth.signUp({ email, password });
      if (error) throw error;
      if (!data.session) {
        // Email confirmation is on — let them know to confirm.
        msg.textContent = t("checkEmailConfirm");
        msg.classList.add("ok");
      }
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
  } catch (err) {
    msg.textContent = err.message || String(err);
    msg.classList.add("error");
  } finally {
    btn.disabled = false;
  }
}

async function loadFavoritesView() {
  const user = currentUser();
  const list = $("fav-list");
  const empty = $("fav-empty");
  if (!user || !list) return;
  const { data, error } = await sb
    .from("favorites")
    .select("meal_id, meals(id,title,image,calories,tags)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) {
    console.error(error);
    return;
  }
  list.innerHTML = "";
  const rows = (data || []).filter((r) => r.meals);
  empty.style.display = rows.length ? "none" : "";
  rows.forEach((r) => {
    const m = r.meals;
    const card = document.createElement("div");
    card.className = "card fav-card";
    card.innerHTML = `
      <div class="meal-img-wrap">
        <img src="${escAttr(m.image) || "https://via.placeholder.com/150"}" alt="${escAttr(
      m.title
    )}" class="meal-img"/>
      </div>
      <div class="card-content">
        <h3>${escAttr(m.title)}</h3>
        <p><strong data-i18n="calories">Calories</strong>: ${m.calories ?? "—"} <span data-i18n="kcal">kcal</span></p>
        <button class="remove-fav-btn" data-meal-id="${m.id}" data-i18n="removeFavorite">Remove favorite</button>
      </div>
    `;
    list.appendChild(card);
  });
  list.querySelectorAll(".remove-fav-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = parseInt(btn.getAttribute("data-meal-id"));
      await sb.from("favorites").delete().eq("user_id", user.id).eq("meal_id", id);
      loadFavoritesView();
    });
  });
  applyLang();
}

function escAttr(s) {
  return String(s == null ? "" : s).replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function renderAccountState() {
  const user = currentUser();
  const authBox = $("auth-box");
  const accountBox = $("account-box");
  if (user) {
    authBox.style.display = "none";
    accountBox.style.display = "";
    $("account-email").textContent = user.email || "";
    loadFavoritesView();
  } else {
    authBox.style.display = "";
    accountBox.style.display = "none";
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  setMode("login");
  $("auth-form").addEventListener("submit", handleAuthSubmit);
  $("auth-toggle-link").addEventListener("click", (e) => {
    e.preventDefault();
    setMode(_mode === "login" ? "signup" : "login");
  });
  const logoutBtn = $("account-logout");
  if (logoutBtn) logoutBtn.addEventListener("click", () => signOutUser());

  await authReady;
  renderAccountState();
});

document.addEventListener("authchange", renderAccountState);
document.addEventListener("langchange", () => {
  setMode(_mode);
  if (currentUser()) loadFavoritesView();
});

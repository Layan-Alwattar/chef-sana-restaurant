// Simple client-side admin gate for NutriSnap.
// NOTE: This is *not* real security — it only hides the admin UI from casual
// visitors. The key lives in the client and any determined user can bypass it.
// For a real app, move auth to a backend.

const ADMIN_KEY = "Sana@2012";       // shared secret
const ADMIN_FLAG = "nutri_isAdmin";          // localStorage flag
const ADMIN_PATH_TOKEN = "admin";            // ?key=... unlock token in URL

function isAdmin() {
  return localStorage.getItem(ADMIN_FLAG) === "true";
}

function loginAdmin(key) {
  if (key === ADMIN_KEY) {
    localStorage.setItem(ADMIN_FLAG, "true");
    return true;
  }
  return false;
}

function logoutAdmin() {
  localStorage.removeItem(ADMIN_FLAG);
}

// Allow unlock via URL: pages/admin.html?key=nutri-admin-2025
(function autoUnlockFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const key = params.get("key");
    if (key && loginAdmin(key)) {
      // Clean the key out of the URL bar so it isn't bookmarked/shared.
      const url = new URL(window.location.href);
      url.searchParams.delete("key");
      window.history.replaceState({}, document.title, url.toString());
    }
  } catch (e) { /* ignore */ }
})();

// Toggle visibility of admin-only nav links etc.
function applyAdminUi() {
  const admin = isAdmin();
  document.querySelectorAll("[data-admin-only]").forEach(el => {
    el.style.display = admin ? "" : "none";
  });
  document.querySelectorAll("[data-public-only]").forEach(el => {
    el.style.display = admin ? "none" : "";
  });
}

document.addEventListener("DOMContentLoaded", applyAdminUi);

// Guard admin pages: redirect to login if not authed.
function requireAdminOrRedirect(loginPath) {
  if (!isAdmin()) {
    window.location.href = loginPath;
  }
}

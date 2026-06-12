// Authentication & admin state for Chef Sana's Restaurant.
//
// Accounts are real now (Supabase Auth). "Admin" = an account whose email is in
// the `admins` table — enforced server-side by RLS, not just hidden in the UI.
//
// UI visibility hooks (kept compatible with the old markup):
//   [data-admin-only] — shown only to admins (Chef Sana)
//   [data-auth-in]    — shown only when someone is logged in
//   [data-auth-out]   — shown only when logged out

let _user = null;
let _isAdmin = false;

let _resolveAuthReady;
const authReady = new Promise((r) => (_resolveAuthReady = r));

function isAdmin() {
  return _isAdmin;
}
function currentUser() {
  return _user;
}

async function refreshAdminFlag() {
  if (!_user) {
    _isAdmin = false;
    return;
  }
  try {
    const { data, error } = await sb.rpc("is_admin");
    _isAdmin = !error && data === true;
  } catch (_e) {
    _isAdmin = false;
  }
}

function applyAdminUi() {
  const admin = _isAdmin;
  document.querySelectorAll("[data-admin-only]").forEach((el) => {
    el.style.display = admin ? "" : "none";
  });
}

function applyAuthUi() {
  const loggedIn = !!_user;
  document.querySelectorAll("[data-auth-in]").forEach((el) => {
    el.style.display = loggedIn ? "" : "none";
  });
  document.querySelectorAll("[data-auth-out]").forEach((el) => {
    el.style.display = loggedIn ? "none" : "";
  });
}

async function applySession(session) {
  _user = (session && session.user) || null;
  await refreshAdminFlag();
  applyAdminUi();
  applyAuthUi();
  document.dispatchEvent(
    new CustomEvent("authchange", { detail: { user: _user, isAdmin: _isAdmin } })
  );
}

async function signOutUser() {
  await sb.auth.signOut();
  // onAuthStateChange will fire applySession(null).
}

// Guard admin-only pages. Waits for the session to load first so we don't
// bounce an admin out before their session is known.
async function requireAdminOrRedirect(loginPath) {
  await authReady;
  if (!isAdmin()) window.location.replace(loginPath);
}

(async function initAuth() {
  const {
    data: { session },
  } = await sb.auth.getSession();
  await applySession(session);
  _resolveAuthReady();
  sb.auth.onAuthStateChange((_event, session) => {
    applySession(session);
  });
})();

document.addEventListener("DOMContentLoaded", () => {
  applyAdminUi();
  applyAuthUi();
});

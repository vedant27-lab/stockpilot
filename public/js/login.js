const THEME_KEY = "stockpilot-theme";

const els = {
  form: document.getElementById("auth-form"),
  email: document.getElementById("auth-email"),
  password: document.getElementById("auth-password"),
  name: document.getElementById("auth-name"),
  nameGroup: document.getElementById("name-group"),
  submit: document.getElementById("auth-submit"),
  error: document.getElementById("login-error"),
  subtitle: document.getElementById("card-subtitle"),
  toggleText: document.getElementById("toggle-text"),
  toggleLink: document.getElementById("toggle-link"),
  themeToggle: document.getElementById("theme-toggle"),
};

let isRegister = false;
let isForgotPassword = false;

function toggleForgotPassword() {
  isForgotPassword = true;
  isRegister = false;
  els.nameGroup.style.display = "none";
  els.name.required = false;
  els.submit.textContent = "Reset Password";
  els.subtitle.textContent = "Reset your password";
  els.toggleText.textContent = "Remembered your password?";
  els.toggleLink.textContent = "Sign in";
  els.error.textContent = "";
  document.getElementById("forgot-password-link").style.display = "none";
}
window.toggleForgotPassword = toggleForgotPassword;

function toggleMode() {
  if (isForgotPassword) {
    isForgotPassword = false;
    document.getElementById("forgot-password-link").style.display = "block";
    els.error.textContent = "";
  } else {
    isRegister = !isRegister;
  }
  
  if (isRegister) {
    els.nameGroup.style.display = "grid";
    els.name.required = true;
    els.submit.textContent = "Create Account";
    els.subtitle.textContent = "Create your account";
    els.toggleText.textContent = "Already have an account?";
    els.toggleLink.textContent = "Sign in";
    document.getElementById("forgot-password-link").style.display = "none";
  } else {
    els.nameGroup.style.display = "none";
    els.name.required = false;
    els.submit.textContent = "Sign In";
    els.subtitle.textContent = "Sign in to your workspace";
    els.toggleText.textContent = "Don't have an account?";
    els.toggleLink.textContent = "Create one";
    document.getElementById("forgot-password-link").style.display = "block";
  }
  els.error.textContent = "";
}

window.toggleMode = toggleMode;

els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  els.error.textContent = "";
  els.submit.disabled = true;
  els.submit.textContent = isRegister ? "Creating…" : "Signing in…";

  if (isForgotPassword) {
    els.submit.textContent = "Resetting…";
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: els.email.value.trim(), newPassword: els.password.value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Reset failed.");
      els.error.textContent = data.message;
      els.error.style.color = "var(--success)";
      setTimeout(() => {
        els.error.style.color = "var(--danger)";
        toggleMode(); // Go back to login
      }, 2000);
    } catch (err) {
      els.error.textContent = err.message;
      els.submit.disabled = false;
      els.submit.textContent = "Reset Password";
    }
    return;
  }

  const body = { email: els.email.value.trim(), password: els.password.value };
  if (isRegister) body.name = els.name.value.trim();

  try {
    const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Authentication failed.");
    window.location.href = "/dashboard";
  } catch (err) {
    els.error.textContent = err.message;
    els.submit.disabled = false;
    els.submit.textContent = isRegister ? "Create Account" : "Sign In";
  }
});

function resolveTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return "dark";
}
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
}
els.themeToggle.addEventListener("click", () => {
  applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});
applyTheme(resolveTheme());

(async () => {
  try {
    const res = await fetch("/api/auth/me");
    if (res.ok) window.location.href = "/dashboard";
  } catch {}
})();

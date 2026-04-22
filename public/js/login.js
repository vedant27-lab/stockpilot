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

function toggleMode() {
  isRegister = !isRegister;

  if (isRegister) {
    els.nameGroup.style.display = "grid";
    els.name.required = true;
    els.submit.textContent = "Create Account";
    els.subtitle.textContent = "Create a customer account";
    els.toggleText.textContent = "Already have an account?";
    els.toggleLink.textContent = "Sign in";
  } else {
    els.nameGroup.style.display = "none";
    els.name.required = false;
    els.submit.textContent = "Sign In";
    els.subtitle.textContent = "Sign in to your workspace";
    els.toggleText.textContent = "Don't have an account?";
    els.toggleLink.textContent = "Create one";
  }

  els.error.textContent = "";
}

// Make toggleMode globally accessible
window.toggleMode = toggleMode;

els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  els.error.textContent = "";
  els.submit.disabled = true;
  els.submit.textContent = isRegister ? "Creating…" : "Signing in…";

  const body = {
    email: els.email.value.trim(),
    password: els.password.value,
  };

  if (isRegister) {
    body.name = els.name.value.trim();
  }

  try {
    const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Authentication failed.");
    }

    // Redirect based on role
    const role = data.user?.role;
    if (role === "admin") {
      window.location.href = "/admin";
    } else {
      window.location.href = "/customer";
    }
  } catch (err) {
    els.error.textContent = err.message;
    els.submit.disabled = false;
    els.submit.textContent = isRegister ? "Create Account" : "Sign In";
  }
});

// Theme
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
  applyTheme(
    document.documentElement.dataset.theme === "dark" ? "light" : "dark"
  );
});

applyTheme(resolveTheme());

// Check if already logged in
(async () => {
  try {
    const res = await fetch("/api/auth/me");
    if (res.ok) {
      const data = await res.json();
      if (data.user?.role === "admin") {
        window.location.href = "/admin";
      } else {
        window.location.href = "/customer";
      }
    }
  } catch {
    // Not logged in, stay on login page
  }
})();

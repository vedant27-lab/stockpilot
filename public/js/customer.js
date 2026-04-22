/* ─── StockPilot Customer Panel ──────────────────────────── */

const THEME_KEY = "stockpilot-theme";

const state = {
  products: [],
  movements: [],
  myRequests: [],
  currentTab: "overview",
};

/* ─── Helpers ────────────────────────────────────────────── */

function formatCurrency(v) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(v);
}

function formatDate(v) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(v));
}

function setStatus(msg, tone = "") {
  const el = document.getElementById("status-banner");
  el.textContent = msg;
  el.className = "status-banner";
  if (tone) el.classList.add(`status-banner--${tone}`);
  setTimeout(() => el.classList.add("status-banner--hidden"), 4000);
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  const data = res.headers.get("content-type")?.includes("json")
    ? await res.json()
    : null;
  if (!res.ok) throw new Error(data?.message || "Request failed");
  return data;
}

/* ─── Tab System ─────────────────────────────────────────── */

function switchTab(tab) {
  state.currentTab = tab;
  document.querySelectorAll(".tab-content").forEach((el) => {
    el.classList.toggle("tab-content--active", el.id === `tab-${tab}`);
  });
  document.querySelectorAll(".tab-nav-btn").forEach((btn) => {
    btn.classList.toggle("tab-bar__btn--active", btn.dataset.tab === tab);
  });
  // Sync mobile bottom nav
  document.querySelectorAll("#mobile-nav button").forEach((btn) => {
    btn.classList.toggle("tab-bar__btn--active", btn.dataset.tab === tab);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.getElementById("tab-nav").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-tab]");
  if (btn) switchTab(btn.dataset.tab);
});

// Mobile bottom nav
const mobileNav = document.getElementById("mobile-nav");
if (mobileNav) {
  mobileNav.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-tab]");
    if (btn) switchTab(btn.dataset.tab);
  });
}

/* ─── Load Dashboard ─────────────────────────────────────── */

async function loadDashboard() {
  try {
    const data = await api("/api/customer/dashboard");
    state.products = data.products || [];
    state.movements = data.movements || [];
    state.myRequests = data.myRequests || [];
    renderAll();
  } catch (err) {
    setStatus(err.message, "error");
  }
}

/* ─── Render Functions ───────────────────────────────────── */

function renderAll() {
  renderStats();
  renderChart();
  renderMovementSummary();
  renderActivityList();
  renderAlerts();
  renderInventory();
  renderMovementOptions();
  renderMyRequests();
}

function renderStats() {
  const totalUnits = state.products.reduce((s, p) => s + p.quantity, 0);
  const value = state.products.reduce((s, p) => s + p.quantity * p.price, 0);
  const low = state.products.filter((p) => p.quantity < 5).length;
  const pending = state.myRequests.filter((r) => r.status === "pending").length;

  document.getElementById("stats-grid").innerHTML = `
    <div class="stat-card animate-in">
      <div class="stat-card__label">Active Items</div>
      <div class="stat-card__value">${state.products.length}</div>
      <div class="stat-card__sub">Tracked inventory records</div>
    </div>
    <div class="stat-card animate-in">
      <div class="stat-card__label">Total Units</div>
      <div class="stat-card__value">${totalUnits}</div>
      <div class="stat-card__sub">Stock currently available</div>
    </div>
    <div class="stat-card animate-in">
      <div class="stat-card__label">Inventory Value</div>
      <div class="stat-card__value">${formatCurrency(value)}</div>
      <div class="stat-card__sub">Estimated current value</div>
    </div>
    <div class="stat-card animate-in">
      <div class="stat-card__label">Low Stock</div>
      <div class="stat-card__value">${low}</div>
      <div class="stat-card__sub">Items below 5 units</div>
    </div>
    <div class="stat-card animate-in" style="border-left: 3px solid var(--primary);">
      <div class="stat-card__label">My Pending</div>
      <div class="stat-card__value">${pending}</div>
      <div class="stat-card__sub">Requests awaiting review</div>
    </div>
  `;
}

function renderChart() {
  const chart = document.getElementById("category-chart");
  const catMap = new Map();
  state.products.forEach((p) => {
    catMap.set(p.category, (catMap.get(p.category) || 0) + p.quantity);
  });
  const entries = [...catMap.entries()];

  if (!entries.length) {
    chart.innerHTML = `<text x="50%" y="50%" text-anchor="middle" fill="currentColor" opacity="0.5">No category data</text>`;
    return;
  }

  const max = Math.max(...entries.map(([, v]) => v), 1);
  const colors = ["#14b8a6", "#6c8cff", "#fbbf24", "#f87171", "#a78bfa", "#fb923c"];
  const barW = Math.max(40, Math.floor(420 / entries.length));
  const gap = 16;
  const startX = 56;
  const baseY = 210;
  const chartH = 170;

  let svg = `<line x1="40" y1="${baseY}" x2="580" y2="${baseY}" stroke="currentColor" opacity="0.15"/>`;
  entries.forEach(([label, val], i) => {
    const x = startX + i * (barW + gap);
    const h = Math.max(14, Math.round((val / max) * chartH));
    const y = baseY - h;
    const c = colors[i % colors.length];
    svg += `
      <rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="8" fill="${c}" opacity="0.85"/>
      <text x="${x + barW / 2}" y="${y - 6}" text-anchor="middle" font-size="12" fill="currentColor">${val}</text>
      <text x="${x + barW / 2}" y="${baseY + 16}" text-anchor="middle" font-size="11" fill="currentColor" opacity="0.7">${label}</text>
    `;
  });
  chart.innerHTML = svg;
}

function renderMovementSummary() {
  const incoming = state.movements
    .filter((m) => m.type === "in")
    .reduce((s, m) => s + m.quantity, 0);
  const outgoing = state.movements
    .filter((m) => m.type === "out")
    .reduce((s, m) => s + m.quantity, 0);

  document.getElementById("movement-summary").innerHTML = `
    <div class="metric-card"><span>Incoming Units</span><strong>${incoming}</strong></div>
    <div class="metric-card"><span>Outgoing Units</span><strong>${outgoing}</strong></div>
    <div class="metric-card"><span>My Total Requests</span><strong>${state.myRequests.length}</strong></div>
  `;
}

function renderActivityList() {
  const el = document.getElementById("activity-list");
  if (!state.movements.length) {
    el.innerHTML = `<div class="empty-state"><strong>No activity yet</strong></div>`;
    return;
  }
  el.innerHTML = state.movements
    .slice(0, 8)
    .map(
      (m) => `
      <div class="stack-card">
        <div class="stack-card__row">
          <div>
            <strong>${m.productName}</strong>
            <p>${m.type === "in" ? "Stock In" : "Stock Out"} · ${m.quantity} units · ${m.note || ""}</p>
            <div class="meta">${formatDate(m.createdAt)}</div>
          </div>
          <div class="amount">${formatCurrency(m.amount || 0)}</div>
        </div>
      </div>`
    )
    .join("");
}

function renderAlerts() {
  const el = document.getElementById("alert-list");
  const low = state.products.filter((p) => p.quantity < 5);
  if (!low.length) {
    el.innerHTML = `<div class="empty-state"><strong>All stocked</strong><p>No items below 5 units.</p></div>`;
    return;
  }
  el.innerHTML = low
    .map(
      (p) => `
      <div class="stack-card stack-card--alert">
        <strong>${p.name}</strong>
        <p>${p.quantity} units left · Location: ${p.location}</p>
      </div>`
    )
    .join("");
}

/* ─── Inventory (Read-Only with Delete Request) ──────────── */

function getFilteredProducts() {
  const term = document.getElementById("search-input").value.trim().toLowerCase();
  if (!term) return state.products;
  return state.products.filter((p) =>
    [p.name, p.sku, p.category, p.supplier].join(" ").toLowerCase().includes(term)
  );
}

function renderInventory() {
  const tbody = document.getElementById("inventory-table");
  const products = getFilteredProducts();
  if (!products.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><strong>No items found</strong></div></td></tr>`;
    return;
  }
  tbody.innerHTML = products
    .map((p) => {
      const low = p.quantity < 5;
      return `
        <tr>
          <td data-label="Item"><div class="product-cell"><strong>${p.name}</strong><span>${p.category}</span></div></td>
          <td data-label="SKU">${p.sku}</td>
          <td data-label="Supplier">${p.supplier}</td>
          <td data-label="Units">${p.quantity}</td>
          <td data-label="Value">${formatCurrency(p.quantity * p.price)}</td>
          <td data-label="Location"><span class="pill ${low ? "pill--low" : "pill--healthy"}">${p.location}</span></td>
          <td data-label="Action"><button class="btn btn--ghost btn--sm" onclick="requestDelete('${p._id}','${p.name.replace(/'/g, "\\'")}')">Request Delete</button></td>
        </tr>`;
    })
    .join("");
}

document.getElementById("search-input").addEventListener("input", renderInventory);

async function requestDelete(productId, productName) {
  if (!confirm(`Submit a request to delete "${productName}"? Admin will review it.`)) return;
  try {
    await api("/api/customer/requests", {
      method: "POST",
      body: JSON.stringify({
        type: "delete_product",
        payload: { productId, productName },
      }),
    });
    setStatus("Delete request submitted for admin review.", "success");
    await loadDashboard();
    switchTab("my-requests");
  } catch (err) {
    setStatus(err.message, "error");
  }
}

/* ─── Movement Options ───────────────────────────────────── */

function renderMovementOptions() {
  const sel = document.getElementById("rm-product");
  if (!state.products.length) {
    sel.innerHTML = '<option value="">No products</option>';
    sel.disabled = true;
    return;
  }
  sel.disabled = false;
  sel.innerHTML = state.products
    .map((p) => `<option value="${p._id}">${p.name} · ${p.sku} · ${p.quantity} units</option>`)
    .join("");
}

/* ─── Request Forms ──────────────────────────────────────── */

document.getElementById("req-product-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    name: document.getElementById("rp-name").value.trim(),
    sku: document.getElementById("rp-sku").value.trim(),
    category: document.getElementById("rp-category").value.trim(),
    supplier: document.getElementById("rp-supplier").value.trim(),
    price: Number(document.getElementById("rp-price").value),
    quantity: Number(document.getElementById("rp-quantity").value),
    location: document.getElementById("rp-location").value.trim(),
    barcode: document.getElementById("rp-barcode").value.trim(),
  };
  try {
    await api("/api/customer/requests", {
      method: "POST",
      body: JSON.stringify({ type: "add_product", payload }),
    });
    e.target.reset();
    setStatus("Product request submitted for admin review.", "success");
    await loadDashboard();
    switchTab("my-requests");
  } catch (err) {
    setStatus(err.message, "error");
  }
});

document.getElementById("req-movement-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    productId: document.getElementById("rm-product").value,
    type: document.getElementById("rm-type").value,
    quantity: Number(document.getElementById("rm-quantity").value),
    note: document.getElementById("rm-note").value.trim(),
  };
  try {
    await api("/api/customer/requests", {
      method: "POST",
      body: JSON.stringify({ type: "record_movement", payload }),
    });
    e.target.reset();
    setStatus("Movement request submitted for admin review.", "success");
    await loadDashboard();
    switchTab("my-requests");
  } catch (err) {
    setStatus(err.message, "error");
  }
});

/* ─── My Requests ────────────────────────────────────────── */

function formatRequestPayload(req) {
  const p = req.payload;
  if (req.type === "add_product") {
    return `<strong>${p.name}</strong> · SKU: ${p.sku} · Location: ${p.location || "Unassigned"} · ₹${p.price} × ${p.quantity} units`;
  } else if (req.type === "record_movement") {
    return `<strong>${p.type === "in" ? "Stock In" : "Stock Out"}</strong> · ${p.quantity} units · "${p.note}"`;
  } else if (req.type === "delete_product") {
    return `Delete product: <strong>${p.productName || p.productId}</strong>`;
  }
  return JSON.stringify(p);
}

function renderMyRequests() {
  const el = document.getElementById("my-requests-list");
  if (!state.myRequests.length) {
    el.innerHTML = `<div class="empty-state"><strong>No requests yet</strong><p>Submit a change request to see it here.</p></div>`;
    return;
  }
  el.innerHTML = state.myRequests
    .map(
      (r) => `
      <div class="request-card animate-in">
        <div class="request-card__header">
          <div>
            <div class="request-card__type">${r.type.replace(/_/g, " ")}</div>
            <div class="meta">${formatDate(r.createdAt)}</div>
          </div>
          <span class="pill pill--${r.status}">${r.status}</span>
        </div>
        <div class="request-card__body">${formatRequestPayload(r)}</div>
        ${r.reviewNote ? `<div class="request-card__note">Admin note: ${r.reviewNote}</div>` : ""}
        ${
          r.status === "pending"
            ? `<div class="request-card__actions"><button class="btn btn--ghost btn--sm" onclick="cancelRequest('${r._id}')">Cancel Request</button></div>`
            : ""
        }
      </div>`
    )
    .join("");
}

async function cancelRequest(id) {
  if (!confirm("Cancel this pending request?")) return;
  try {
    await api(`/api/customer/requests/${id}`, { method: "DELETE" });
    setStatus("Request cancelled.", "success");
    await loadDashboard();
  } catch (err) {
    setStatus(err.message, "error");
  }
}

/* ─── Logout ─────────────────────────────────────────────── */

document.getElementById("logout-btn").addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/login.html";
});

/* ─── Theme ──────────────────────────────────────────────── */

function resolveTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return "dark";
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
}

document.getElementById("theme-toggle").addEventListener("click", () => {
  applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});

/* ─── Init ───────────────────────────────────────────────── */

(async () => {
  applyTheme(resolveTheme());
  switchTab("overview");

  try {
    const me = await api("/api/auth/me");
    document.getElementById("user-name").textContent = me.user?.name || "";
  } catch {
    window.location.href = "/login.html";
    return;
  }

  await loadDashboard();
})();

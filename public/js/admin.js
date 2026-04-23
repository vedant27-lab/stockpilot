/* ─── StockPilot Admin Panel ─────────────────────────────── */

const THEME_KEY = "stockpilot-theme";

const state = {
  products: [],
  movements: [],
  shares: [],
  pendingRequests: [],
  users: [],
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
    const data = await api("/api/admin/dashboard");
    state.products = data.products || [];
    state.movements = data.movements || [];
    state.shares = data.shares || [];
    state.pendingRequests = data.pendingRequests || [];
    state.users = data.users || [];
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
  renderRequests();
  renderRequestHistory();
  renderInventory();
  renderMovementOptions();
  renderMovementList();
  renderUsers();
  renderShares();
  updateBadge();
  renderCategories();
}

function renderCategories() {
  const list = document.getElementById("category-list");
  if (!list) return;
  const categoriesMap = new Map();
  state.products.forEach(p => {
    if (p.category) {
      const normalized = p.category.trim().toLowerCase();
      if (!categoriesMap.has(normalized)) {
        categoriesMap.set(normalized, p.category.trim());
      }
    }
  });
  const categories = [...categoriesMap.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  list.innerHTML = categories.map(c => `<option value="${c.replace(/"/g, '&quot;')}">`).join("");
}

function renderStats() {
  const totalUnits = state.products.reduce((s, p) => s + p.quantity, 0);
  const value = state.products.reduce((s, p) => s + p.quantity * p.price, 0);
  const locations = new Set(state.products.map((p) => p.location)).size;

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
      <div class="stat-card__label">Storage Areas</div>
      <div class="stat-card__value">${locations}</div>
      <div class="stat-card__sub">Unique locations used</div>
    </div>
    <div class="stat-card stat-card--danger animate-in">
      <div class="stat-card__label">Pending Requests</div>
      <div class="stat-card__value">${state.pendingRequests.length}</div>
      <div class="stat-card__sub">Awaiting your review</div>
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
  const colors = ["#6c8cff", "#34d399", "#fbbf24", "#f87171", "#a78bfa", "#fb923c"];
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
  const incoming = state.movements.filter((m) => m.type === "in").reduce((s, m) => s + m.quantity, 0);
  const outgoing = state.movements.filter((m) => m.type === "out").reduce((s, m) => s + m.quantity, 0);

  document.getElementById("movement-summary").innerHTML = `
    <div class="metric-card"><span>Incoming Units</span><strong>${incoming}</strong></div>
    <div class="metric-card"><span>Outgoing Units</span><strong>${outgoing}</strong></div>
    <div class="metric-card"><span>Shared Access</span><strong>${state.shares.length}</strong></div>
    <div class="metric-card"><span>Customers</span><strong>${state.users.length}</strong></div>
  `;
}

function renderActivityList() {
  const el = document.getElementById("activity-list");
  if (!state.movements.length) {
    el.innerHTML = `<div class="empty-state"><strong>No activity yet</strong><p>Record a movement to see activity.</p></div>`;
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

function updateBadge() {
  const badge = document.getElementById("pending-badge");
  const count = state.pendingRequests.length;
  badge.textContent = count;
  badge.style.display = count > 0 ? "inline-flex" : "none";
}

/* ─── Requests ───────────────────────────────────────────── */

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

function renderRequests() {
  const el = document.getElementById("request-list");
  if (!state.pendingRequests.length) {
    el.innerHTML = `<div class="empty-state"><strong>No pending requests</strong><p>All change requests have been reviewed.</p></div>`;
    return;
  }
  el.innerHTML = state.pendingRequests
    .map(
      (r) => `
      <div class="request-card animate-in">
        <div class="request-card__header">
          <div>
            <div class="request-card__type">${r.type.replace(/_/g, " ")}</div>
            <div class="meta">By ${r.requestedByName || "Customer"} · ${formatDate(r.createdAt)}</div>
          </div>
          <span class="pill pill--pending">Pending</span>
        </div>
        <div class="request-card__body">${formatRequestPayload(r)}</div>
        <div class="request-card__actions">
          <button class="btn btn--success btn--sm" onclick="approveRequest('${r._id}')">✓ Approve</button>
          <button class="btn btn--danger btn--sm" onclick="rejectRequest('${r._id}')">✗ Reject</button>
        </div>
      </div>`
    )
    .join("");
}

async function renderRequestHistory() {
  const el = document.getElementById("request-history");
  const logsTb = document.getElementById("logs-table");
  try {
    const data = await api("/api/admin/requests");
    const reqs = data.requests || [];

    if (logsTb) {
      if (!reqs.length) {
        logsTb.innerHTML = `<tr><td colspan="6"><div class="empty-state"><strong>No logs found</strong></div></td></tr>`;
      } else {
        logsTb.innerHTML = reqs.map((r) => {
          const reqBy = r.requestedBy ? r.requestedBy.name : r.requestedByName || "Unknown";
          const revBy = r.reviewedBy ? r.reviewedBy.name : "-";
          const dDate = formatDate(r.createdAt);
          return `<tr>
            <td data-label="Date">${dDate}</td>
            <td data-label="Action"><strong>${r.type.replace(/_/g, " ")}</strong></td>
            <td data-label="Requested By">${reqBy}</td>
            <td data-label="Status"><span class="pill pill--${r.status}">${r.status}</span></td>
            <td data-label="Reviewed By">${revBy}</td>
            <td data-label="Note">${r.reviewNote || "-"}</td>
          </tr>`;
        }).join("");
      }
    }

    const processed = reqs.filter((r) => r.status !== "pending");
    if (!processed.length) {
      el.innerHTML = `<div class="empty-state"><strong>No history</strong><p>Processed requests will appear here.</p></div>`;
      return;
    }
    el.innerHTML = processed
      .slice(0, 20)
      .map(
        (r) => `
        <div class="request-card">
          <div class="request-card__header">
            <div>
              <div class="request-card__type">${r.type.replace(/_/g, " ")}</div>
              <div class="meta">By ${r.requestedBy ? r.requestedBy.name : r.requestedByName || "Customer"} · ${formatDate(r.createdAt)}</div>
            </div>
            <span class="pill pill--${r.status}">${r.status}</span>
          </div>
          <div class="request-card__body">${formatRequestPayload(r)}</div>
          ${r.reviewNote ? `<div class="request-card__note">Admin note: ${r.reviewNote}</div>` : ""}
        </div>`
      )
      .join("");
  } catch {
    if (el) el.innerHTML = `<div class="empty-state"><strong>Could not load history</strong></div>`;
    if (logsTb) logsTb.innerHTML = `<tr><td colspan="6"><div class="empty-state"><strong>Could not load logs</strong></div></td></tr>`;
  }
}

async function approveRequest(id) {
  const note = prompt("Add an approval note (optional):", "Approved");
  if (note === null) return;
  try {
    await api(`/api/admin/requests/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ note: note || "Approved" }),
    });
    setStatus("Request approved and executed.", "success");
    await loadDashboard();
  } catch (err) {
    setStatus(err.message, "error");
  }
}

async function rejectRequest(id) {
  const note = prompt("Reason for rejection:");
  if (note === null) return;
  try {
    await api(`/api/admin/requests/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ note: note || "Rejected" }),
    });
    setStatus("Request rejected.", "success");
    await loadDashboard();
  } catch (err) {
    setStatus(err.message, "error");
  }
}

document.getElementById("download-logs-btn")?.addEventListener("click", async () => {
  try {
    const res = await fetch("/api/admin/requests/export");
    if (!res.ok) throw new Error("Failed to export logs");
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "requests_log.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    setStatus("Logs downloaded successfully.", "success");
  } catch (err) {
    setStatus(err.message, "error");
  }
});

/* ─── Inventory ──────────────────────────────────────────── */

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
          <td data-label="Action">
            <button class="btn btn--ghost btn--sm" onclick="openEditModal('${p._id}')">Edit</button>
            <button class="btn btn--danger btn--sm" onclick="deleteProduct('${p._id}')">Delete</button>
          </td>
        </tr>`;
    })
    .join("");
}

document.getElementById("search-input").addEventListener("input", renderInventory);

document.getElementById("product-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const product = {
    name: document.getElementById("p-name").value.trim(),
    sku: document.getElementById("p-sku").value.trim(),
    category: document.getElementById("p-category").value.trim(),
    supplier: document.getElementById("p-supplier").value.trim(),
    price: Number(document.getElementById("p-price").value),
    quantity: Number(document.getElementById("p-quantity").value),
    location: document.getElementById("p-location").value.trim(),
    barcode: document.getElementById("p-barcode").value.trim(),
  };
  try {
    await api("/api/admin/products", { method: "POST", body: JSON.stringify(product) });
    e.target.reset();
    setStatus(`"${product.name}" added.`, "success");
    await loadDashboard();
  } catch (err) {
    setStatus(err.message, "error");
  }
});

async function deleteProduct(id) {
  const p = state.products.find((x) => x._id === id);
  if (!p || !confirm(`Delete "${p.name}"?`)) return;
  try {
    await api(`/api/admin/products/${id}`, { method: "DELETE" });
    setStatus(`"${p.name}" deleted.`, "success");
    await loadDashboard();
  } catch (err) {
    setStatus(err.message, "error");
  }
}

function openEditModal(id) {
  const p = state.products.find((x) => x._id === id);
  if (!p) return;
  document.getElementById("ep-id").value = p._id;
  document.getElementById("ep-name").value = p.name;
  document.getElementById("ep-sku").value = p.sku;
  document.getElementById("ep-category").value = p.category;
  document.getElementById("ep-supplier").value = p.supplier;
  document.getElementById("ep-price").value = p.price;
  document.getElementById("ep-quantity").value = p.quantity;
  document.getElementById("ep-location").value = p.location || "";
  document.getElementById("ep-barcode").value = p.barcode || "";
  document.getElementById("edit-product-modal").classList.add("modal--open");
}

function closeEditModal() {
  document.getElementById("edit-product-modal").classList.remove("modal--open");
}

document.getElementById("edit-product-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("ep-id").value;
  const product = {
    name: document.getElementById("ep-name").value.trim(),
    sku: document.getElementById("ep-sku").value.trim(),
    category: document.getElementById("ep-category").value.trim(),
    supplier: document.getElementById("ep-supplier").value.trim(),
    price: Number(document.getElementById("ep-price").value),
    quantity: Number(document.getElementById("ep-quantity").value),
    location: document.getElementById("ep-location").value.trim(),
    barcode: document.getElementById("ep-barcode").value.trim(),
  };
  try {
    await api(`/api/admin/products/${id}`, { method: "PUT", body: JSON.stringify(product) });
    closeEditModal();
    setStatus(`"${product.name}" updated.`, "success");
    await loadDashboard();
  } catch (err) {
    setStatus(err.message, "error");
  }
});

/* ─── Movements ──────────────────────────────────────────── */

function renderMovementOptions() {
  const sel = document.getElementById("m-product");
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

function renderMovementList() {
  const el = document.getElementById("movement-list");
  if (!state.movements.length) {
    el.innerHTML = `<div class="empty-state"><strong>No movements</strong></div>`;
    return;
  }
  el.innerHTML = state.movements
    .slice(0, 10)
    .map(
      (m) => `
      <div class="stack-card">
        <div class="stack-card__row">
          <div>
            <strong>${m.productName}</strong>
            <p>${m.type === "in" ? "Stock In" : "Stock Out"} · ${m.quantity} units</p>
            <div class="meta">${formatDate(m.createdAt)}</div>
          </div>
          <div class="amount">${formatCurrency(m.amount || 0)}</div>
        </div>
      </div>`
    )
    .join("");
}

document.getElementById("movement-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const movement = {
    productId: document.getElementById("m-product").value,
    type: document.getElementById("m-type").value,
    quantity: Number(document.getElementById("m-quantity").value),
    note: document.getElementById("m-note").value.trim(),
  };
  try {
    await api("/api/admin/movements", { method: "POST", body: JSON.stringify(movement) });
    e.target.reset();
    setStatus("Movement recorded.", "success");
    await loadDashboard();
  } catch (err) {
    setStatus(err.message, "error");
  }
});

/* ─── Users ──────────────────────────────────────────────── */

function renderUsers() {
  const el = document.getElementById("user-list");
  if (!state.users.length) {
    el.innerHTML = `<div class="empty-state"><strong>No customers yet</strong><p>Customers will appear when they register.</p></div>`;
    return;
  }
  el.innerHTML = state.users
    .map(
      (u) => `
      <div class="user-card">
        <div class="user-card__info">
          <strong>${u.name}</strong>
          <span>${u.email} · Joined ${formatDate(u.createdAt)}</span>
        </div>
        <div style="display:flex;gap:0.5rem;align-items:center">
          <span class="pill ${u.status === "active" ? "pill--healthy" : "pill--low"}">${u.status}</span>
          <button class="btn btn--ghost btn--sm" onclick="toggleUserStatus('${u._id}')">${u.status === "active" ? "Suspend" : "Activate"}</button>
        </div>
      </div>`
    )
    .join("");
}

async function toggleUserStatus(id) {
  try {
    await api(`/api/admin/users/${id}/toggle-status`, { method: "POST" });
    setStatus("User status updated.", "success");
    await loadDashboard();
  } catch (err) {
    setStatus(err.message, "error");
  }
}

/* ─── Shares ─────────────────────────────────────────────── */

function renderShares() {
  const el = document.getElementById("share-list");
  if (!state.shares.length) {
    el.innerHTML = `<div class="empty-state"><strong>No shares</strong></div>`;
    return;
  }
  el.innerHTML = state.shares
    .map(
      (s) => `
      <div class="stack-card">
        <div class="stack-card__row">
          <div>
            <strong>${s.name}</strong>
            <p>${s.email} · ${s.role} · Token: ${s.token}</p>
          </div>
          <button class="btn btn--danger btn--sm" onclick="revokeShare('${s._id}')">Revoke</button>
        </div>
      </div>`
    )
    .join("");
}

document.getElementById("share-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const share = {
    name: document.getElementById("s-name").value.trim(),
    email: document.getElementById("s-email").value.trim(),
    role: document.getElementById("s-role").value,
  };
  try {
    await api("/api/admin/shares", { method: "POST", body: JSON.stringify(share) });
    e.target.reset();
    setStatus("Share access created.", "success");
    await loadDashboard();
  } catch (err) {
    setStatus(err.message, "error");
  }
});

async function revokeShare(id) {
  if (!confirm("Revoke this share?")) return;
  try {
    await api(`/api/admin/shares/${id}`, { method: "DELETE" });
    setStatus("Share revoked.", "success");
    await loadDashboard();
  } catch (err) {
    setStatus(err.message, "error");
  }
}

/* ─── Reset ──────────────────────────────────────────────── */

document.getElementById("reset-btn").addEventListener("click", async () => {
  if (!confirm("Reset demo data?")) return;
  try {
    await api("/api/admin/reset", { method: "POST" });
    setStatus("Demo data restored.", "success");
    await loadDashboard();
  } catch (err) {
    setStatus(err.message, "error");
  }
});

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

/* ─── Insights (AI Chat) ──────────────────────────────────── */

document.getElementById("chat-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = document.getElementById("chat-input");
  const query = input.value.trim();
  if (!query) return;

  const chatBox = document.getElementById("chat-box");

  // Add user message
  const userMsg = document.createElement("div");
  userMsg.className = "chat-msg chat-msg--user animate-in";
  userMsg.innerHTML = `<div class="chat-msg__bubble">${query}</div>`;
  chatBox.appendChild(userMsg);
  
  input.value = "";
  chatBox.scrollTop = chatBox.scrollHeight;

  // Add a temporary loading bot message
  const loadingMsg = document.createElement("div");
  loadingMsg.className = "chat-msg chat-msg--bot animate-in";
  loadingMsg.innerHTML = `<div class="chat-msg__bubble"><div class="typing-indicator"><span></span><span></span><span></span></div></div>`;
  chatBox.appendChild(loadingMsg);
  chatBox.scrollTop = chatBox.scrollHeight;

  try {
    const data = await api("/api/insights", {
      method: "POST",
      body: JSON.stringify({ query }),
    });

    loadingMsg.innerHTML = `<div class="chat-msg__bubble">${marked.parse(data.reply)}</div>`;

    // Render Mermaid graphs if any
    const mermaidBlocks = loadingMsg.querySelectorAll(".language-mermaid");
    if (mermaidBlocks.length > 0) {
      mermaidBlocks.forEach((block, index) => {
        const parent = block.parentElement; // The <pre> tag
        const div = document.createElement("div");
        div.className = "mermaid";
        div.textContent = block.textContent;
        parent.replaceWith(div);
      });
      // Initialize mermaid lazily if needed, and run
      if (typeof mermaid !== "undefined") {
        mermaid.initialize({ startOnLoad: false, theme: document.documentElement.dataset.theme === "dark" ? "dark" : "default" });
        mermaid.run({ querySelector: '.mermaid' });
      }
    }

  } catch (err) {
    loadingMsg.innerHTML = `<div class="chat-msg__bubble" style="color: var(--danger)">Error: ${err.message}</div>`;
  }
  chatBox.scrollTop = chatBox.scrollHeight;
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

  // Auto-refresh every 15 seconds
  setInterval(() => {
    loadDashboard();
  }, 15000);
})();

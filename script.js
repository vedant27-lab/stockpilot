const THEME_KEY = "stockpilot-theme";

const els = {
  productForm: document.getElementById("product-form"),
  movementForm: document.getElementById("movement-form"),
  shareForm: document.getElementById("share-form"),
  searchInput: document.getElementById("search-input"),
  themeToggle: document.getElementById("theme-toggle"),
  resetDemo: document.getElementById("reset-demo"),
  statusBanner: document.getElementById("status-banner"),
  productName: document.getElementById("product-name"),
  productSku: document.getElementById("product-sku"),
  productCategory: document.getElementById("product-category"),
  productSupplier: document.getElementById("product-supplier"),
  productPrice: document.getElementById("product-price"),
  productQuantity: document.getElementById("product-quantity"),
  productThreshold: document.getElementById("product-threshold"),
  movementProduct: document.getElementById("movement-product"),
  movementType: document.getElementById("movement-type"),
  movementQuantity: document.getElementById("movement-quantity"),
  movementNote: document.getElementById("movement-note"),
  shareName: document.getElementById("share-name"),
  shareEmail: document.getElementById("share-email"),
  shareRole: document.getElementById("share-role"),
  inventoryTable: document.getElementById("inventory-table"),
  alertList: document.getElementById("alert-list"),
  movementHistory: document.getElementById("movement-history"),
  shareList: document.getElementById("share-list"),
  movementSummary: document.getElementById("movement-summary"),
  categoryChart: document.getElementById("category-chart"),
  totalProducts: document.getElementById("total-products"),
  totalUnits: document.getElementById("total-units"),
  inventoryValue: document.getElementById("inventory-value"),
  lowStockCount: document.getElementById("low-stock-count"),
  emptyStateTemplate: document.getElementById("empty-state-template"),
};

const state = {
  products: [],
  movements: [],
  shares: [],
};

function setStatus(message, tone = "") {
  els.statusBanner.textContent = message;
  els.statusBanner.className = "status-banner";
  if (tone) {
    els.statusBanner.classList.add(`status-banner--${tone}`);
  }
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getFilteredProducts() {
  const term = els.searchInput.value.trim().toLowerCase();
  if (!term) {
    return state.products;
  }

  return state.products.filter((product) => {
    return [product.name, product.sku, product.category, product.supplier]
      .join(" ")
      .toLowerCase()
      .includes(term);
  });
}

function getAnalytics() {
  const totalUnits = state.products.reduce((sum, product) => sum + product.quantity, 0);
  const inventoryValue = state.products.reduce((sum, product) => sum + product.quantity * product.price, 0);
  const lowStock = state.products.filter((product) => product.quantity <= product.threshold);
  const incomingUnits = state.movements
    .filter((entry) => entry.type === "in")
    .reduce((sum, entry) => sum + entry.quantity, 0);
  const outgoingUnits = state.movements
    .filter((entry) => entry.type === "out")
    .reduce((sum, entry) => sum + entry.quantity, 0);

  const categoryMap = new Map();
  state.products.forEach((product) => {
    categoryMap.set(product.category, (categoryMap.get(product.category) || 0) + product.quantity);
  });

  return {
    totalUnits,
    inventoryValue,
    lowStock,
    incomingUnits,
    outgoingUnits,
    categoryBreakdown: [...categoryMap.entries()],
  };
}

function renderStats() {
  const analytics = getAnalytics();
  els.totalProducts.textContent = String(state.products.length);
  els.totalUnits.textContent = String(analytics.totalUnits);
  els.inventoryValue.textContent = formatCurrency(analytics.inventoryValue);
  els.lowStockCount.textContent = String(analytics.lowStock.length);
}

function renderMovementOptions() {
  if (!state.products.length) {
    els.movementProduct.innerHTML = '<option value="">No inventory items available</option>';
    els.movementProduct.disabled = true;
    return;
  }

  els.movementProduct.disabled = false;
  els.movementProduct.innerHTML = state.products
    .map((product) => {
      return `<option value="${product.id}">${product.name} | ${product.sku} | ${product.quantity} units</option>`;
    })
    .join("");
}

function renderInventory() {
  const products = getFilteredProducts();
  els.inventoryTable.innerHTML = "";

  if (!products.length) {
    els.inventoryTable.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">
            <strong>No matching inventory items</strong>
            <p>Try another search or add a new inventory record.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  products.forEach((product) => {
    const low = product.quantity <= product.threshold;
    const row = document.createElement("tr");
    row.innerHTML = `
      <td data-label="Item">
        <div class="product-cell">
          <strong>${product.name}</strong>
          <span>${product.category}</span>
        </div>
      </td>
      <td data-label="SKU">${product.sku}</td>
      <td data-label="Supplier">${product.supplier}</td>
      <td data-label="Units">${product.quantity}</td>
      <td data-label="Value">${formatCurrency(product.quantity * product.price)}</td>
      <td data-label="Status">
        <span class="status-pill ${low ? "status-pill--low" : "status-pill--healthy"}">
          ${low ? "Reorder" : "Healthy"}
        </span>
      </td>
      <td data-label="Action">
        <button class="table-action" data-delete-id="${product.id}" type="button" aria-label="Delete ${product.name}">
          Delete
        </button>
      </td>
    `;
    els.inventoryTable.appendChild(row);
  });
}

function renderAlerts() {
  const lowStockProducts = state.products.filter((product) => product.quantity <= product.threshold);
  els.alertList.innerHTML = "";

  if (!lowStockProducts.length) {
    els.alertList.appendChild(els.emptyStateTemplate.content.cloneNode(true));
    return;
  }

  lowStockProducts.forEach((product) => {
    const card = document.createElement("article");
    card.className = "alert-card";
    card.innerHTML = `
      <strong>${product.name}</strong>
      <p>${product.quantity} units left | reorder at ${product.threshold} | supplier: ${product.supplier}</p>
    `;
    els.alertList.appendChild(card);
  });
}

function renderMovementHistory() {
  els.movementHistory.innerHTML = "";

  if (!state.movements.length) {
    els.movementHistory.appendChild(els.emptyStateTemplate.content.cloneNode(true));
    return;
  }

  [...state.movements]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 8)
    .forEach((entry) => {
      const item = document.createElement("article");
      item.className = "sales-item";
      const amount = entry.amount ? formatCurrency(entry.amount) : "No value";
      item.innerHTML = `
        <div>
          <strong>${entry.productName}</strong>
          <div class="sales-item__meta">${entry.type === "in" ? "Stock In" : "Stock Out"} | ${entry.quantity} units | ${entry.note}</div>
          <div class="sales-item__meta">${formatDateTime(entry.createdAt)}</div>
        </div>
        <div class="sales-item__amount">${amount}</div>
      `;
      els.movementHistory.appendChild(item);
    });
}

function renderShares() {
  els.shareList.innerHTML = "";

  if (!state.shares.length) {
    els.shareList.appendChild(els.emptyStateTemplate.content.cloneNode(true));
    return;
  }

  state.shares.forEach((share) => {
    const card = document.createElement("article");
    card.className = "share-card";
    card.innerHTML = `
      <div>
        <strong>${share.name}</strong>
        <div class="sales-item__meta">${share.email}</div>
        <div class="sales-item__meta">${share.role} | ${share.status} | Invite ${share.token}</div>
      </div>
      <button class="table-action" data-share-delete-id="${share.id}" type="button" aria-label="Revoke access for ${share.name}">
        Revoke
      </button>
    `;
    els.shareList.appendChild(card);
  });
}

function renderMovementSummary() {
  const analytics = getAnalytics();
  els.movementSummary.innerHTML = `
    <article class="metric-card">
      <span>Incoming Units</span>
      <strong>${analytics.incomingUnits}</strong>
    </article>
    <article class="metric-card">
      <span>Outgoing Units</span>
      <strong>${analytics.outgoingUnits}</strong>
    </article>
    <article class="metric-card">
      <span>Shared Access</span>
      <strong>${state.shares.length}</strong>
    </article>
  `;
}

function renderCategoryChart() {
  const entries = getAnalytics().categoryBreakdown;
  els.categoryChart.innerHTML = "";

  if (!entries.length) {
    els.categoryChart.innerHTML = `
      <text x="50%" y="50%" text-anchor="middle" fill="currentColor" opacity="0.55">
        No category data available
      </text>
    `;
    return;
  }

  const maxValue = Math.max(...entries.map(([, value]) => value), 1);
  const colors = ["#d66a3c", "#3e8e7e", "#4c6edb", "#d9a441", "#9b5de5", "#2f9e44"];
  const width = 600;
  const chartHeight = 170;
  const baseY = 210;
  const barWidth = Math.max(52, Math.floor(420 / entries.length));
  const gap = 24;
  const startX = 56;

  const axis = `
    <line x1="40" y1="${baseY}" x2="${width - 20}" y2="${baseY}" stroke="currentColor" opacity="0.2" />
    <line x1="40" y1="24" x2="40" y2="${baseY}" stroke="currentColor" opacity="0.2" />
  `;

  const bars = entries
    .map(([label, value], index) => {
      const x = startX + index * (barWidth + gap);
      const height = Math.max(18, Math.round((value / maxValue) * chartHeight));
      const y = baseY - height;
      const color = colors[index % colors.length];
      return `
        <rect x="${x}" y="${y}" width="${barWidth}" height="${height}" rx="18" fill="${color}" opacity="0.88"></rect>
        <text x="${x + barWidth / 2}" y="${y - 8}" text-anchor="middle" font-size="14" fill="currentColor">${value}</text>
        <text x="${x + barWidth / 2}" y="${baseY + 18}" text-anchor="middle" font-size="13" fill="currentColor">${label}</text>
      `;
    })
    .join("");

  els.categoryChart.innerHTML = axis + bars;
}

function renderAll() {
  renderStats();
  renderMovementOptions();
  renderInventory();
  renderAlerts();
  renderMovementHistory();
  renderShares();
  renderMovementSummary();
  renderCategoryChart();
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    throw new Error(payload?.message || "Request failed");
  }

  return payload;
}

async function loadDashboard() {
  try {
    setStatus("Loading inventory workspace...");
    const payload = await apiRequest("/api/dashboard");
    state.products = payload.products || [];
    state.movements = payload.movements || [];
    state.shares = payload.shares || [];
    renderAll();
    setStatus("Inventory workspace loaded successfully.", "success");
  } catch (error) {
    setStatus(error.message || "Could not load workspace data.", "error");
  }
}

async function addProduct(event) {
  event.preventDefault();

  const product = {
    name: els.productName.value.trim(),
    sku: els.productSku.value.trim(),
    category: els.productCategory.value.trim(),
    supplier: els.productSupplier.value.trim(),
    price: Number(els.productPrice.value),
    quantity: Number(els.productQuantity.value),
    threshold: Number(els.productThreshold.value),
  };

  try {
    await apiRequest("/api/products", {
      method: "POST",
      body: JSON.stringify(product),
    });
    els.productForm.reset();
    await loadDashboard();
    setStatus(`Inventory item "${product.name}" added successfully.`, "success");
  } catch (error) {
    setStatus(error.message || "Could not add inventory item.", "error");
  }
}

async function recordMovement(event) {
  event.preventDefault();

  const movement = {
    productId: els.movementProduct.value,
    type: els.movementType.value,
    quantity: Number(els.movementQuantity.value),
    note: els.movementNote.value.trim(),
  };

  try {
    await apiRequest("/api/movements", {
      method: "POST",
      body: JSON.stringify(movement),
    });
    els.movementForm.reset();
    els.movementType.value = "in";
    await loadDashboard();
    setStatus("Inventory movement saved successfully.", "success");
  } catch (error) {
    setStatus(error.message || "Could not save inventory movement.", "error");
  }
}

async function createShareAccess(event) {
  event.preventDefault();

  const invite = {
    name: els.shareName.value.trim(),
    email: els.shareEmail.value.trim(),
    role: els.shareRole.value,
  };

  try {
    await apiRequest("/api/shares", {
      method: "POST",
      body: JSON.stringify(invite),
    });
    els.shareForm.reset();
    els.shareRole.value = "Viewer";
    await loadDashboard();
    setStatus(`Shared access created for ${invite.email}.`, "success");
  } catch (error) {
    setStatus(error.message || "Could not create shared access.", "error");
  }
}

async function deleteProduct(productId) {
  const product = state.products.find((item) => item.id === productId);
  if (!product) {
    return;
  }

  const confirmed = window.confirm(`Delete "${product.name}" from inventory?`);
  if (!confirmed) {
    return;
  }

  try {
    await apiRequest(`/api/products/${productId}`, { method: "DELETE" });
    await loadDashboard();
    setStatus(`Inventory item "${product.name}" deleted.`, "success");
  } catch (error) {
    setStatus(error.message || "Could not delete inventory item.", "error");
  }
}

async function revokeShare(shareId) {
  const share = state.shares.find((item) => item.id === shareId);
  if (!share) {
    return;
  }

  const confirmed = window.confirm(`Revoke shared access for "${share.name}"?`);
  if (!confirmed) {
    return;
  }

  try {
    await apiRequest(`/api/shares/${shareId}`, { method: "DELETE" });
    await loadDashboard();
    setStatus(`Shared access revoked for ${share.email}.`, "success");
  } catch (error) {
    setStatus(error.message || "Could not revoke shared access.", "error");
  }
}

async function resetDemoData() {
  const confirmed = window.confirm("Reset the app to its original inventory demo data?");
  if (!confirmed) {
    return;
  }

  try {
    await apiRequest("/api/reset", { method: "POST" });
    els.productForm.reset();
    els.movementForm.reset();
    els.shareForm.reset();
    els.searchInput.value = "";
    await loadDashboard();
    setStatus("Demo data restored.", "success");
  } catch (error) {
    setStatus(error.message || "Could not reset data.", "error");
  }
}

function resolvePreferredTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
  const darkMode = theme === "dark";
  els.themeToggle.textContent = darkMode ? "Light Mode" : "Dark Mode";
  els.themeToggle.setAttribute("aria-pressed", String(darkMode));
}

function toggleTheme() {
  applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
}

els.productForm.addEventListener("submit", addProduct);
els.movementForm.addEventListener("submit", recordMovement);
els.shareForm.addEventListener("submit", createShareAccess);
els.searchInput.addEventListener("input", renderInventory);
els.themeToggle.addEventListener("click", toggleTheme);
els.resetDemo.addEventListener("click", resetDemoData);

els.inventoryTable.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const productId = target.dataset.deleteId;
  if (productId) {
    deleteProduct(productId);
  }
});

els.shareList.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const shareId = target.dataset.shareDeleteId;
  if (shareId) {
    revokeShare(shareId);
  }
});

applyTheme(resolvePreferredTheme());
loadDashboard();

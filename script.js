const THEME_KEY = "stockpilot-theme";

const els = {
  productForm: document.getElementById("product-form"),
  saleForm: document.getElementById("sale-form"),
  searchInput: document.getElementById("search-input"),
  themeToggle: document.getElementById("theme-toggle"),
  resetDemo: document.getElementById("reset-demo"),
  statusBanner: document.getElementById("status-banner"),
  productName: document.getElementById("product-name"),
  productCategory: document.getElementById("product-category"),
  productPrice: document.getElementById("product-price"),
  productQuantity: document.getElementById("product-quantity"),
  productThreshold: document.getElementById("product-threshold"),
  saleProduct: document.getElementById("sale-product"),
  saleQuantity: document.getElementById("sale-quantity"),
  saleCustomer: document.getElementById("sale-customer"),
  inventoryTable: document.getElementById("inventory-table"),
  alertList: document.getElementById("alert-list"),
  salesHistory: document.getElementById("sales-history"),
  totalProducts: document.getElementById("total-products"),
  totalUnits: document.getElementById("total-units"),
  todayRevenue: document.getElementById("today-revenue"),
  lowStockCount: document.getElementById("low-stock-count"),
  emptyStateTemplate: document.getElementById("empty-state-template"),
};

const state = {
  products: [],
  sales: [],
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

function isToday(dateString) {
  const target = new Date(dateString);
  const now = new Date();
  return (
    target.getDate() === now.getDate() &&
    target.getMonth() === now.getMonth() &&
    target.getFullYear() === now.getFullYear()
  );
}

function getFilteredProducts() {
  const term = els.searchInput.value.trim().toLowerCase();
  if (!term) {
    return state.products;
  }

  return state.products.filter((product) => {
    return (
      product.name.toLowerCase().includes(term) ||
      product.category.toLowerCase().includes(term)
    );
  });
}

function renderStats() {
  const totalUnits = state.products.reduce((sum, product) => sum + product.quantity, 0);
  const todayRevenue = state.sales
    .filter((sale) => isToday(sale.createdAt))
    .reduce((sum, sale) => sum + sale.amount, 0);
  const lowStock = state.products.filter((product) => product.quantity <= product.threshold);

  els.totalProducts.textContent = String(state.products.length);
  els.totalUnits.textContent = String(totalUnits);
  els.todayRevenue.textContent = formatCurrency(todayRevenue);
  els.lowStockCount.textContent = String(lowStock.length);
}

function renderProductOptions() {
  if (!state.products.length) {
    els.saleProduct.innerHTML = '<option value="">No products available</option>';
    els.saleProduct.disabled = true;
    return;
  }

  els.saleProduct.disabled = false;
  els.saleProduct.innerHTML = state.products
    .map((product) => {
      return `<option value="${product.id}">${product.name} (${product.quantity} in stock)</option>`;
    })
    .join("");
}

function renderInventory() {
  const products = getFilteredProducts();
  els.inventoryTable.innerHTML = "";

  if (!products.length) {
    els.inventoryTable.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="empty-state">
            <strong>No matching products</strong>
            <p>Try a different search term or add a new product.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  products.forEach((product) => {
    const statusLow = product.quantity <= product.threshold;
    const row = document.createElement("tr");
    row.innerHTML = `
      <td data-label="Product">
        <div class="product-cell">
          <strong>${product.name}</strong>
          <span>Threshold: ${product.threshold}</span>
        </div>
      </td>
      <td data-label="Category">${product.category}</td>
      <td data-label="Price">${formatCurrency(product.price)}</td>
      <td data-label="Stock">${product.quantity}</td>
      <td data-label="Status">
        <span class="status-pill ${statusLow ? "status-pill--low" : "status-pill--healthy"}">
          ${statusLow ? "Low Stock" : "Healthy"}
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
      <p>${product.quantity} units left in ${product.category}</p>
    `;
    els.alertList.appendChild(card);
  });
}

function renderSalesHistory() {
  els.salesHistory.innerHTML = "";

  if (!state.sales.length) {
    els.salesHistory.appendChild(els.emptyStateTemplate.content.cloneNode(true));
    return;
  }

  [...state.sales]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 8)
    .forEach((sale) => {
      const item = document.createElement("article");
      item.className = "sales-item";
      item.innerHTML = `
        <div>
          <strong>${sale.productName}</strong>
          <div class="sales-item__meta">${sale.customer} | ${sale.quantity} unit(s) | ${formatDateTime(sale.createdAt)}</div>
        </div>
        <div class="sales-item__amount">${formatCurrency(sale.amount)}</div>
      `;
      els.salesHistory.appendChild(item);
    });
}

function renderAll() {
  renderStats();
  renderProductOptions();
  renderInventory();
  renderAlerts();
  renderSalesHistory();
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
    setStatus("Loading dashboard data...");
    const payload = await apiRequest("/api/dashboard");
    state.products = payload.products || [];
    state.sales = payload.sales || [];
    renderAll();
    setStatus("Dashboard data loaded successfully.", "success");
  } catch (error) {
    setStatus(error.message || "Could not load dashboard data.", "error");
  }
}

async function addProduct(event) {
  event.preventDefault();

  const product = {
    name: els.productName.value.trim(),
    category: els.productCategory.value.trim(),
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
    setStatus(`Product "${product.name}" added successfully.`, "success");
  } catch (error) {
    setStatus(error.message || "Could not add product.", "error");
  }
}

async function recordSale(event) {
  event.preventDefault();

  const sale = {
    productId: els.saleProduct.value,
    quantity: Number(els.saleQuantity.value),
    customer: els.saleCustomer.value.trim(),
  };

  try {
    await apiRequest("/api/sales", {
      method: "POST",
      body: JSON.stringify(sale),
    });
    els.saleForm.reset();
    await loadDashboard();
    setStatus("Sale recorded successfully.", "success");
  } catch (error) {
    setStatus(error.message || "Could not record sale.", "error");
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
    setStatus(`Product "${product.name}" deleted.`, "success");
  } catch (error) {
    setStatus(error.message || "Could not delete product.", "error");
  }
}

async function resetDemoData() {
  const confirmed = window.confirm("Reset the app to its original demo data?");
  if (!confirmed) {
    return;
  }

  try {
    await apiRequest("/api/reset", { method: "POST" });
    els.productForm.reset();
    els.saleForm.reset();
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
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
}

els.productForm.addEventListener("submit", addProduct);
els.saleForm.addEventListener("submit", recordSale);
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

applyTheme(resolvePreferredTheme());
loadDashboard();

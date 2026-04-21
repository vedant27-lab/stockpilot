const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, "data", "store.json");

function createSeedState() {
  const notebookId = randomUUID();

  return {
    products: [
      {
        id: notebookId,
        name: "Premium Notebook",
        category: "Stationery",
        price: 299,
        quantity: 34,
        threshold: 10,
      },
      {
        id: randomUUID(),
        name: "Wireless Mouse",
        category: "Electronics",
        price: 799,
        quantity: 7,
        threshold: 8,
      },
      {
        id: randomUUID(),
        name: "Ceramic Coffee Mug",
        category: "Home Goods",
        price: 249,
        quantity: 18,
        threshold: 6,
      },
    ],
    sales: [
      {
        id: randomUUID(),
        productId: notebookId,
        productName: "Premium Notebook",
        quantity: 2,
        customer: "Campus customer",
        amount: 598,
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

async function ensureDataFile() {
  try {
    await fs.access(DATA_FILE);
  } catch {
    await writeStore(createSeedState());
  }
}

async function readStore() {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, "utf8");
  return JSON.parse(raw);
}

async function writeStore(data) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

async function readJsonBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  return "application/octet-stream";
}

async function serveStatic(req, res) {
  const urlPath = req.url === "/" ? "/index.html" : req.url;
  const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(ROOT, safePath);

  if (!filePath.startsWith(ROOT)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  try {
    const content = await fs.readFile(filePath);
    res.writeHead(200, { "Content-Type": getContentType(filePath) });
    res.end(content);
  } catch {
    sendText(res, 404, "Not found");
  }
}

function validateProduct(payload) {
  if (
    !payload.name ||
    !payload.category ||
    !Number.isFinite(payload.price) ||
    payload.price <= 0 ||
    !Number.isFinite(payload.quantity) ||
    payload.quantity < 0 ||
    !Number.isFinite(payload.threshold) ||
    payload.threshold <= 0
  ) {
    return "Provide valid product details.";
  }

  return "";
}

function validateSale(payload) {
  if (!payload.productId || !Number.isFinite(payload.quantity) || payload.quantity <= 0 || !payload.customer) {
    return "Provide a valid product, quantity, and customer name.";
  }

  return "";
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/api/dashboard") {
    const store = await readStore();
    sendJson(res, 200, store);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/products") {
    const payload = await readJsonBody(req);
    const error = validateProduct(payload);
    if (error) {
      sendJson(res, 400, { message: error });
      return;
    }

    const store = await readStore();
    store.products.unshift({
      id: randomUUID(),
      name: payload.name.trim(),
      category: payload.category.trim(),
      price: Number(payload.price),
      quantity: Number(payload.quantity),
      threshold: Number(payload.threshold),
    });
    await writeStore(store);
    sendJson(res, 201, { message: "Product added." });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/sales") {
    const payload = await readJsonBody(req);
    const error = validateSale(payload);
    if (error) {
      sendJson(res, 400, { message: error });
      return;
    }

    const store = await readStore();
    const product = store.products.find((item) => item.id === payload.productId);

    if (!product) {
      sendJson(res, 404, { message: "Selected product was not found." });
      return;
    }

    if (payload.quantity > product.quantity) {
      sendJson(res, 400, { message: "Sale quantity exceeds available stock." });
      return;
    }

    product.quantity -= Number(payload.quantity);
    store.sales.unshift({
      id: randomUUID(),
      productId: product.id,
      productName: product.name,
      quantity: Number(payload.quantity),
      customer: payload.customer.trim(),
      amount: product.price * Number(payload.quantity),
      createdAt: new Date().toISOString(),
    });

    await writeStore(store);
    sendJson(res, 201, { message: "Sale recorded." });
    return;
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/products/")) {
    const productId = url.pathname.split("/").pop();
    const store = await readStore();
    const target = store.products.find((item) => item.id === productId);

    if (!target) {
      sendJson(res, 404, { message: "Product not found." });
      return;
    }

    store.products = store.products.filter((item) => item.id !== productId);
    store.sales = store.sales.filter((sale) => sale.productId !== productId);
    await writeStore(store);
    sendJson(res, 200, { message: "Product deleted." });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/reset") {
    await writeStore(createSeedState());
    sendJson(res, 200, { message: "Demo data restored." });
    return;
  }

  sendJson(res, 404, { message: "API route not found." });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith("/api/")) {
      await handleApi(req, res);
      return;
    }

    await serveStatic(req, res);
  } catch (error) {
    sendJson(res, 500, { message: error.message || "Internal server error." });
  }
});

server.listen(PORT, async () => {
  await ensureDataFile();
  console.log(`StockPilot server running on http://localhost:${PORT}`);
});

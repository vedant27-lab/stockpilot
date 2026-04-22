const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const { readStore, writeStore, resetStore, createInviteToken, randomUUID } = require("./lib/store");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

async function readJsonBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error("Request body must be valid JSON.");
    error.statusCode = 400;
    throw error;
  }
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
  const pathname = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`).pathname;
  const urlPath = pathname === "/" ? "/index.html" : pathname;
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
    !payload.sku ||
    !payload.category ||
    !payload.supplier ||
    !Number.isFinite(payload.price) ||
    payload.price <= 0 ||
    !Number.isFinite(payload.quantity) ||
    payload.quantity < 0 ||
    !Number.isFinite(payload.threshold) ||
    payload.threshold <= 0
  ) {
    return "Provide valid inventory item details.";
  }

  return "";
}

function validateMovement(payload) {
  if (
    !payload.productId ||
    !["in", "out"].includes(payload.type) ||
    !Number.isFinite(payload.quantity) ||
    payload.quantity <= 0 ||
    !payload.note
  ) {
    return "Provide a valid movement type, item, quantity, and note.";
  }

  return "";
}

function validateShare(payload) {
  if (!payload.name || !payload.email || !["Viewer", "Editor"].includes(payload.role)) {
    return "Provide a valid teammate name, email, and access role.";
  }

  return "";
}

async function handleApi(req, res) {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const isMovementRoute = url.pathname === "/api/movements" || url.pathname === "/api/sales";

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
      sku: payload.sku.trim().toUpperCase(),
      category: payload.category.trim(),
      supplier: payload.supplier.trim(),
      price: Number(payload.price),
      quantity: Number(payload.quantity),
      threshold: Number(payload.threshold),
      updatedAt: new Date().toISOString(),
    });
    await writeStore(store);
    sendJson(res, 201, { message: "Inventory item added." });
    return;
  }

  if (req.method === "POST" && isMovementRoute) {
    const payload = await readJsonBody(req);
    const error = validateMovement(payload);
    if (error) {
      sendJson(res, 400, { message: error });
      return;
    }

    const store = await readStore();
    const product = store.products.find((item) => item.id === payload.productId);

    if (!product) {
      sendJson(res, 404, { message: "Selected inventory item was not found." });
      return;
    }

    const quantity = Number(payload.quantity);

    if (payload.type === "out" && quantity > product.quantity) {
      sendJson(res, 400, { message: "Outgoing quantity exceeds available stock." });
      return;
    }

    product.quantity += payload.type === "in" ? quantity : -quantity;
    product.updatedAt = new Date().toISOString();

    store.movements.unshift({
      id: randomUUID(),
      type: payload.type,
      productId: product.id,
      productName: product.name,
      quantity,
      note: payload.note.trim(),
      amount: product.price * quantity,
      createdAt: new Date().toISOString(),
    });

    await writeStore(store);
    sendJson(res, 201, { message: "Inventory movement recorded." });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/shares") {
    const payload = await readJsonBody(req);
    const error = validateShare(payload);
    if (error) {
      sendJson(res, 400, { message: error });
      return;
    }

    const store = await readStore();
    store.shares.unshift({
      id: randomUUID(),
      name: payload.name.trim(),
      email: payload.email.trim().toLowerCase(),
      role: payload.role,
      token: createInviteToken(),
      status: "Active",
      createdAt: new Date().toISOString(),
    });
    await writeStore(store);
    sendJson(res, 201, { message: "Access invite created." });
    return;
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/products/")) {
    const productId = url.pathname.split("/").pop();
    const store = await readStore();
    const target = store.products.find((item) => item.id === productId);

    if (!target) {
      sendJson(res, 404, { message: "Inventory item not found." });
      return;
    }

    store.products = store.products.filter((item) => item.id !== productId);
    store.movements = store.movements.filter((entry) => entry.productId !== productId);
    await writeStore(store);
    sendJson(res, 200, { message: "Inventory item deleted." });
    return;
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/shares/")) {
    const shareId = url.pathname.split("/").pop();
    const store = await readStore();
    const target = store.shares.find((item) => item.id === shareId);

    if (!target) {
      sendJson(res, 404, { message: "Shared access record not found." });
      return;
    }

    store.shares = store.shares.filter((item) => item.id !== shareId);
    await writeStore(store);
    sendJson(res, 200, { message: "Shared access revoked." });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/reset") {
    await resetStore();
    sendJson(res, 200, { message: "Demo data restored." });
    return;
  }

  sendJson(res, 404, { message: "API route not found." });
}

const server = http.createServer(async (req, res) => {
  try {
    if ((req.url || "").startsWith("/api/")) {
      await handleApi(req, res);
      return;
    }

    await serveStatic(req, res);
  } catch (error) {
    sendJson(res, error.statusCode || 500, {
      message: error.message || "Internal server error.",
    });
  }
});

server.listen(PORT, async () => {
  console.log(`StockPilot server running on http://localhost:${PORT}`);
});

const { readStore, writeStore, resetStore, createInviteToken, randomUUID } = require("../lib/store");

function sendJson(res, statusCode, payload) {
  res.status(statusCode).json(payload);
}

function getRequestBody(req) {
  if (!req.body) {
    return {};
  }

  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      const error = new Error("Request body must be valid JSON.");
      error.statusCode = 400;
      throw error;
    }
  }

  return req.body;
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

module.exports = async (req, res) => {
  try {
    const pathname = new URL(req.url || "/", "http://localhost").pathname;
    const isMovementRoute = pathname === "/api/movements" || pathname === "/api/sales";

    if (req.method === "GET" && pathname === "/api/dashboard") {
      const store = await readStore();
      sendJson(res, 200, store);
      return;
    }

    if (req.method === "POST" && pathname === "/api/products") {
      const payload = getRequestBody(req);
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
      const payload = getRequestBody(req);
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

    if (req.method === "POST" && pathname === "/api/shares") {
      const payload = getRequestBody(req);
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

    if (req.method === "DELETE" && pathname.startsWith("/api/products/")) {
      const productId = pathname.split("/").pop();
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

    if (req.method === "DELETE" && pathname.startsWith("/api/shares/")) {
      const shareId = pathname.split("/").pop();
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

    if (req.method === "POST" && pathname === "/api/reset") {
      await resetStore();
      sendJson(res, 200, { message: "Demo data restored." });
      return;
    }

    sendJson(res, 404, { message: "API route not found." });
  } catch (error) {
    sendJson(res, error.statusCode || 500, {
      message: error.message || "Internal server error.",
    });
  }
};

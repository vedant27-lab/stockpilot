require("dotenv").config();

const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const path = require("path");
const { connectDB } = require("./lib/db");

const User = require("./lib/models/User");
const Product = require("./lib/models/Product");
const Movement = require("./lib/models/Movement");
const Request = require("./lib/models/Request");
const Share = require("./lib/models/Share");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "stockpilot-fallback-secret";
const COOKIE_NAME = "stockpilot_token";

/* ─── Middleware ─────────────────────────────────────────── */

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

function signToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function authMiddleware(req, res, next) {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return res.status(401).json({ message: "Not authenticated." });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== "admin")
    return res.status(403).json({ message: "Admin access required." });
  next();
}

function customerOnly(req, res, next) {
  if (req.user.role !== "customer")
    return res.status(403).json({ message: "Customer access required." });
  next();
}

/* ─── Auth Routes ────────────────────────────────────────── */

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res
        .status(400)
        .json({ message: "Name, email, and password are required." });

    if (password.length < 6)
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters." });

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing)
      return res
        .status(400)
        .json({ message: "An account with this email already exists." });

    const user = await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      role: "customer",
    });

    const token = signToken(user);
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: "lax",
    });

    res.status(201).json({
      message: "Account created successfully.",
      user: user.toSafeJSON(),
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Registration failed." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res
        .status(400)
        .json({ message: "Email and password are required." });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user)
      return res.status(401).json({ message: "Invalid email or password." });

    if (user.status === "suspended")
      return res
        .status(403)
        .json({ message: "Account suspended. Contact admin." });

    const valid = await user.comparePassword(password);
    if (!valid)
      return res.status(401).json({ message: "Invalid email or password." });

    const token = signToken(user);
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: "lax",
    });

    res.json({ message: "Login successful.", user: user.toSafeJSON() });
  } catch (err) {
    res.status(500).json({ message: err.message || "Login failed." });
  }
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ message: "Logged out." });
});

app.get("/api/auth/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found." });
    res.json({ user: user.toSafeJSON() });
  } catch (err) {
    res.status(500).json({ message: "Could not fetch user." });
  }
});

/* ─── Admin Routes ───────────────────────────────────────── */

app.get(
  "/api/admin/dashboard",
  authMiddleware,
  adminOnly,
  async (req, res) => {
    try {
      const [products, movements, shares, pendingRequests, users] =
        await Promise.all([
          Product.find().sort({ updatedAt: -1 }),
          Movement.find().sort({ createdAt: -1 }),
          Share.find().sort({ createdAt: -1 }),
          Request.find({ status: "pending" }).sort({ createdAt: -1 }),
          User.find({ role: "customer" })
            .select("-password -__v")
            .sort({ createdAt: -1 }),
        ]);

      res.json({ products, movements, shares, pendingRequests, users });
    } catch (err) {
      res.status(500).json({ message: "Could not load dashboard." });
    }
  }
);

app.post(
  "/api/admin/products",
  authMiddleware,
  adminOnly,
  async (req, res) => {
    try {
      const { name, sku, category, supplier, price, quantity, location, barcode } =
        req.body;
      const err = validateProduct(req.body);
      if (err) return res.status(400).json({ message: err });

      const product = await Product.create({
        name: name.trim(),
        sku: sku.trim().toUpperCase(),
        category: normalizeCategory(category),
        supplier: supplier.trim(),
        price: Number(price),
        quantity: Number(quantity),
        location: location ? location.trim() : "Unassigned",
        barcode: barcode ? barcode.trim() : "",
        createdBy: req.user.id,
      });

      res.status(201).json({ message: "Product added.", product });
    } catch (err) {
      console.error("Add product error:", err);
      res
        .status(500)
        .json({ message: err.message || "Could not add product." });
    }
  }
);

app.post(
  "/api/admin/movements",
  authMiddleware,
  adminOnly,
  async (req, res) => {
    try {
      const err = validateMovement(req.body);
      if (err) return res.status(400).json({ message: err });

      const product = await Product.findById(req.body.productId);
      if (!product)
        return res.status(404).json({ message: "Product not found." });

      const qty = Number(req.body.quantity);
      if (req.body.type === "out" && qty > product.quantity)
        return res
          .status(400)
          .json({ message: "Outgoing quantity exceeds available stock." });

      product.quantity += req.body.type === "in" ? qty : -qty;
      await product.save();

      const movement = await Movement.create({
        type: req.body.type,
        productId: product._id,
        productName: product.name,
        quantity: qty,
        note: req.body.note.trim(),
        amount: product.price * qty,
        createdBy: req.user.id,
      });

      res.status(201).json({ message: "Movement recorded.", movement });
    } catch (err) {
      res
        .status(500)
        .json({ message: err.message || "Could not record movement." });
    }
  }
);

app.put(
  "/api/admin/products/:id",
  authMiddleware,
  adminOnly,
  async (req, res) => {
    try {
      const product = await Product.findById(req.params.id);
      if (!product) return res.status(404).json({ message: "Product not found." });

      const err = validateProduct(req.body);
      if (err) return res.status(400).json({ message: err });

      Object.assign(product, {
        name: req.body.name,
        sku: req.body.sku,
        category: normalizeCategory(req.body.category),
        supplier: req.body.supplier,
        price: req.body.price,
        quantity: req.body.quantity,
        location: req.body.location,
        barcode: req.body.barcode,
        updatedAt: new Date()
      });

      await product.save();
      res.json({ message: "Product updated.", product });
    } catch (err) {
      res.status(500).json({ message: err.message || "Could not update product." });
    }
  }
);

app.delete(
  "/api/admin/products/:id",
  authMiddleware,
  adminOnly,
  async (req, res) => {
    try {
      const product = await Product.findById(req.params.id);
      if (!product)
        return res.status(404).json({ message: "Product not found." });

      await Movement.deleteMany({ productId: product._id });
      await Product.findByIdAndDelete(req.params.id);

      res.json({ message: "Product deleted." });
    } catch (err) {
      res
        .status(500)
        .json({ message: err.message || "Could not delete product." });
    }
  }
);

app.get(
  "/api/admin/requests",
  authMiddleware,
  adminOnly,
  async (req, res) => {
    try {
      const filter = {};
      if (req.query.status) filter.status = req.query.status;
      const requests = await Request.find(filter).sort({ createdAt: -1 });
      res.json({ requests });
    } catch (err) {
      res
        .status(500)
        .json({ message: "Could not load requests." });
    }
  }
);

app.post(
  "/api/admin/requests/:id/approve",
  authMiddleware,
  adminOnly,
  async (req, res) => {
    try {
      const changeReq = await Request.findById(req.params.id);
      if (!changeReq)
        return res.status(404).json({ message: "Request not found." });
      if (changeReq.status !== "pending")
        return res
          .status(400)
          .json({ message: "Request already processed." });

      changeReq.status = "approved";
      changeReq.reviewedBy = req.user.id;
      changeReq.reviewNote = req.body.note || "Approved";
      changeReq.reviewedAt = new Date();
      await changeReq.save();

      /* Execute the change */
      if (changeReq.type === "add_product") {
        const p = changeReq.payload;
        await Product.create({
          name: p.name,
          sku: p.sku,
          category: normalizeCategory(p.category),
          supplier: p.supplier,
          price: p.price,
          quantity: p.quantity,
          location: p.location,
          barcode: p.barcode,
          createdBy: changeReq.requestedBy,
        });
      } else if (changeReq.type === "record_movement") {
        const p = changeReq.payload;
        const product = await Product.findById(p.productId);
        if (product) {
          const qty = Number(p.quantity);
          product.quantity += p.type === "in" ? qty : -qty;
          if (product.quantity < 0) product.quantity = 0;
          await product.save();
          await Movement.create({
            type: p.type,
            productId: product._id,
            productName: product.name,
            quantity: qty,
            note: p.note || "",
            amount: product.price * qty,
            createdBy: changeReq.requestedBy,
          });
        }
      } else if (changeReq.type === "delete_product") {
        const p = changeReq.payload;
        await Movement.deleteMany({ productId: p.productId });
        await Product.findByIdAndDelete(p.productId);
      }

      res.json({ message: "Request approved and executed." });
    } catch (err) {
      res
        .status(500)
        .json({ message: err.message || "Could not approve request." });
    }
  }
);

app.post(
  "/api/admin/requests/:id/reject",
  authMiddleware,
  adminOnly,
  async (req, res) => {
    try {
      const changeReq = await Request.findById(req.params.id);
      if (!changeReq)
        return res.status(404).json({ message: "Request not found." });
      if (changeReq.status !== "pending")
        return res
          .status(400)
          .json({ message: "Request already processed." });

      changeReq.status = "rejected";
      changeReq.reviewedBy = req.user.id;
      changeReq.reviewNote = req.body.note || "Rejected";
      changeReq.reviewedAt = new Date();
      await changeReq.save();

      res.json({ message: "Request rejected." });
    } catch (err) {
      res
        .status(500)
        .json({ message: err.message || "Could not reject request." });
    }
  }
);

app.get("/api/admin/users", authMiddleware, adminOnly, async (req, res) => {
  try {
    const users = await User.find({ role: "customer" })
      .select("-password -__v")
      .sort({ createdAt: -1 });
    res.json({ users });
  } catch (err) {
    res.status(500).json({ message: "Could not load users." });
  }
});

app.post(
  "/api/admin/users/:id/toggle-status",
  authMiddleware,
  adminOnly,
  async (req, res) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ message: "User not found." });
      user.status = user.status === "active" ? "suspended" : "active";
      await user.save();
      res.json({
        message: `User ${user.status === "active" ? "activated" : "suspended"}.`,
        user: user.toSafeJSON(),
      });
    } catch (err) {
      res.status(500).json({ message: "Could not update user status." });
    }
  }
);

app.post("/api/admin/shares", authMiddleware, adminOnly, async (req, res) => {
  try {
    const err = validateShare(req.body);
    if (err) return res.status(400).json({ message: err });

    const share = await Share.create({
      name: req.body.name.trim(),
      email: req.body.email.trim().toLowerCase(),
      role: req.body.role,
      token:
        "INV-" +
        require("crypto").randomUUID().slice(0, 8).toUpperCase(),
      createdBy: req.user.id,
    });

    res.status(201).json({ message: "Share access created.", share });
  } catch (err) {
    res
      .status(500)
      .json({ message: err.message || "Could not create share access." });
  }
});

app.delete(
  "/api/admin/shares/:id",
  authMiddleware,
  adminOnly,
  async (req, res) => {
    try {
      const share = await Share.findByIdAndDelete(req.params.id);
      if (!share)
        return res.status(404).json({ message: "Share record not found." });
      res.json({ message: "Share access revoked." });
    } catch (err) {
      res.status(500).json({ message: "Could not revoke share access." });
    }
  }
);

app.post("/api/admin/reset", authMiddleware, adminOnly, async (req, res) => {
  try {
    await Product.deleteMany({});
    await Movement.deleteMany({});
    await Share.deleteMany({});
    await Request.deleteMany({});
    await seedProducts();
    res.json({ message: "Demo data restored." });
  } catch (err) {
    res.status(500).json({ message: "Could not reset data." });
  }
});

/* ─── Rate Limiter (System Design) ───────────────────────── */
const insightsRateLimit = new Map();
function insightsRateLimiter(req, res, next) {
  const userId = req.user.id;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const maxRequests = 5; // max 5 requests per minute per user

  if (!insightsRateLimit.has(userId)) {
    insightsRateLimit.set(userId, { count: 1, firstRequest: now });
    return next();
  }

  const record = insightsRateLimit.get(userId);
  if (now - record.firstRequest > windowMs) {
    insightsRateLimit.set(userId, { count: 1, firstRequest: now });
    return next();
  }

  if (record.count >= maxRequests) {
    return res.status(429).json({ message: "Too many requests. Please wait a minute to avoid API abuse." });
  }

  record.count++;
  next();
}

/* ─── Insights Route ─────────────────────────────────────── */

app.post(
  "/api/insights",
  authMiddleware,
  insightsRateLimiter,
  async (req, res) => {
    try {
      const { query } = req.body;
      if (!query) return res.status(400).json({ message: "Query is required." });

      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: "Groq API key not found. Please add GROQ_API_KEY to your .env file." });
      }

      // Fetch all products to give context to the LLM
      const products = await Product.find().select("name sku category price quantity location");
      
      const safeData = products.map(p => {
        if (req.user.role === "admin") return p;
        return {
          name: p.name,
          category: p.category,
          price: p.price,
          quantity: p.quantity
        };
      });

      const roleInstructions = req.user.role === "admin"
        ? "You are talking to an ADMIN. You have full access to share SKUs, exact storage locations, and detailed data."
        : "You are talking to a CUSTOMER. Only provide general availability, category, and pricing. Do NOT reveal SKUs, exact stock storage locations, or sensitive business details.";

      const systemPrompt = `You are a highly capable, professional, and helpful Inventory Insights Assistant for StockPilot. 

Below is the current inventory data for your reference:
${JSON.stringify(safeData)}

IMPORTANT INSTRUCTIONS:
1. ALWAYS format your responses in clear, readable Markdown.
2. Use bullet points, bold text, or Markdown tables when listing products or details.
3. NEVER output raw JSON data to the user. Always convert data into natural, human-friendly language.
4. If the user asks you to add products or perform actions, inform them that you are just an insights assistant and cannot modify the database directly. Tell them to use the forms in the dashboard.
5. If asked for graphs/charts, use \`\`\`mermaid code blocks. STRICT RULES:
   - ONLY use 'pie' or 'xychart-beta'. NO scatter plots or other types.
   - You MUST place each part of the chart on a NEW LINE.
   - Example Pie Chart:
     pie title Stock Distribution
     "Electronics" : 40
     "Stationery" : 60
   - Example Bar Chart:
     xychart-beta
     title "Stock by Category"
     x-axis ["Electronics", "Stationery"]
     y-axis "Quantity"
     bar [40, 60]
6. Keep your tone helpful, concise, and easy to read.
7. ${roleInstructions}`;

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: query }
          ],
          temperature: 0.7,
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Groq API Error:", errorText);
        throw new Error("Failed to fetch insights from Groq API.");
      }

      const data = await response.json();
      const reply = data.choices[0].message.content;

      res.json({ reply });
    } catch (err) {
      res.status(500).json({ message: err.message || "Could not load insights." });
    }
  }
);

/* ─── Customer Routes ────────────────────────────────────── */

app.get(
  "/api/customer/dashboard",
  authMiddleware,
  customerOnly,
  async (req, res) => {
    try {
      const [products, movements, myRequests] = await Promise.all([
        Product.find().sort({ updatedAt: -1 }),
        Movement.find().sort({ createdAt: -1 }),
        Request.find({ requestedBy: req.user.id }).sort({ createdAt: -1 }),
      ]);
      res.json({ products, movements, myRequests });
    } catch (err) {
      res.status(500).json({ message: "Could not load dashboard." });
    }
  }
);

app.post(
  "/api/customer/requests",
  authMiddleware,
  customerOnly,
  async (req, res) => {
    try {
      const { type, payload } = req.body;
      if (
        !type ||
        !["add_product", "record_movement", "delete_product", "send_message"].includes(type)
      )
        return res.status(400).json({ message: "Invalid request type." });

      if (!payload)
        return res.status(400).json({ message: "Payload is required." });

      if (type === "add_product") {
        const err = validateProduct(payload);
        if (err) return res.status(400).json({ message: err });
      }

      if (type === "record_movement") {
        const err = validateMovement(payload);
        if (err) return res.status(400).json({ message: err });
      }

      const user = await User.findById(req.user.id);
      const changeReq = await Request.create({
        type,
        payload,
        requestedBy: req.user.id,
        requestedByName: user ? user.name : "Unknown",
      });

      res.status(201).json({
        message: "Change request submitted for admin review.",
        request: changeReq,
      });
    } catch (err) {
      res
        .status(500)
        .json({ message: err.message || "Could not submit request." });
    }
  }
);

app.get(
  "/api/customer/requests",
  authMiddleware,
  customerOnly,
  async (req, res) => {
    try {
      const requests = await Request.find({ requestedBy: req.user.id }).sort({
        createdAt: -1,
      });
      res.json({ requests });
    } catch (err) {
      res.status(500).json({ message: "Could not load requests." });
    }
  }
);

app.delete(
  "/api/customer/requests/:id",
  authMiddleware,
  customerOnly,
  async (req, res) => {
    try {
      const changeReq = await Request.findOne({
        _id: req.params.id,
        requestedBy: req.user.id,
      });
      if (!changeReq)
        return res.status(404).json({ message: "Request not found." });
      if (changeReq.status !== "pending")
        return res
          .status(400)
          .json({ message: "Only pending requests can be cancelled." });

      await Request.findByIdAndDelete(req.params.id);
      res.json({ message: "Request cancelled." });
    } catch (err) {
      res.status(500).json({ message: "Could not cancel request." });
    }
  }
);

/* ─── Page Routes ────────────────────────────────────────── */

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/admin", authMiddleware, adminOnly, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get("/customer", authMiddleware, customerOnly, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "customer.html"));
});

/* ─── Validation & Helpers ─────────────────────────────────── */

function normalizeCategory(cat) {
  if (!cat) return "";
  return cat.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

function validateProduct(p) {
  if (
    !p.name ||
    !p.sku ||
    !p.category ||
    !p.supplier ||
    !Number.isFinite(Number(p.price)) ||
    Number(p.price) <= 0 ||
    !Number.isFinite(Number(p.quantity)) ||
    Number(p.quantity) < 0
  )
    return "Provide valid inventory item details (location is optional).";
  return "";
}

function validateMovement(p) {
  if (
    !p.productId ||
    !["in", "out"].includes(p.type) ||
    !Number.isFinite(Number(p.quantity)) ||
    Number(p.quantity) <= 0 ||
    !p.note
  )
    return "Provide a valid movement type, item, quantity, and note.";
  return "";
}

function validateShare(p) {
  if (
    !p.name ||
    !p.email ||
    !["Viewer", "Editor"].includes(p.role)
  )
    return "Provide a valid name, email, and role.";
  return "";
}

/* ─── Seed Data ──────────────────────────────────────────── */

async function seedProducts() {
  const seedData = [
    ["Premium Notebook", "STK-101", "Stationery", "Campus Paper Co.", 299, 34, "Aisle 1, Shelf A", "8901234567890"],
    ["Wireless Mouse", "ELE-220", "Electronics", "Pixel Devices", 799, 7, "Aisle 3, Shelf C", "8901234567891"],
    ["Ceramic Coffee Mug", "HOM-045", "Home Goods", "Daily Living", 249, 18, "Aisle 2, Shelf B", "8901234567892"],
    ["Desk Study Lamp", "LGT-310", "Lighting", "BrightNest", 1299, 12, "Aisle 3, Shelf D", "8901234567893"],
    ["Steel Water Bottle", "LIF-125", "Lifestyle", "Urban Carry", 499, 29, "Aisle 2, Shelf A", "8901234567894"],
    ["Portable Bluetooth Speaker", "ELE-415", "Electronics", "SoundMint", 1899, 5, "Aisle 3, Shelf C", "8901234567895"],
    ["Document File Folder", "STK-145", "Stationery", "Campus Paper Co.", 149, 42, "Aisle 1, Shelf B", "8901234567896"],
    ["Mini Desk Planter", "DEC-212", "Decor", "LeafLine Studio", 349, 9, "Aisle 4, Shelf A", "8901234567897"],
    ["Wireless Keyboard", "ELE-305", "Electronics", "Pixel Devices", 1499, 14, "Aisle 3, Shelf C", "8901234567898"],
    ["Whiteboard Marker Pack", "STK-188", "Stationery", "WriteRight Supply", 219, 48, "Aisle 1, Shelf A", "8901234567899"],
    ["USB Flash Drive 64GB", "ELE-640", "Electronics", "ByteKart", 649, 19, "Aisle 3, Shelf B", "8901234567900"],
    ["Wireless Earbuds", "ELE-710", "Electronics", "SoundMint", 2199, 11, "Aisle 3, Shelf A", "8901234567901"],
    ["LED Night Lamp", "LGT-160", "Lighting", "BrightNest", 699, 20, "Aisle 4, Shelf B", "8901234567902"],
    ["Canvas Tote Bag", "LIF-220", "Lifestyle", "Urban Carry", 599, 15, "Aisle 2, Shelf C", "8901234567903"],
    ["Photo Frame", "DEC-260", "Decor", "LeafLine Studio", 459, 18, "Aisle 4, Shelf A", "8901234567904"],
    ["Scented Candle", "DEC-270", "Decor", "LeafLine Studio", 349, 27, "Aisle 4, Shelf C", "8901234567905"],
  ];

  const products = [];
  for (const [name, sku, category, supplier, price, quantity, location, barcode] of seedData) {
    products.push({
      name, sku, category, supplier, price, quantity, location, barcode
    });
  }
  await Product.insertMany(products);
}

async function seedAdmin() {
  const exists = await User.findOne({ role: "admin" });
  if (!exists) {
    await User.create({
      name: "Admin",
      email: "admin@stockpilot.com",
      password: "admin123",
      role: "admin",
    });
    console.log("Default admin created: admin@stockpilot.com / admin123");
  }
}

async function ensureSeedData() {
  const count = await Product.countDocuments();
  if (count === 0) {
    await seedProducts();
    console.log("Seed products inserted.");
  }
}

/* ─── Start ──────────────────────────────────────────────── */

(async () => {
  await connectDB();
  await seedAdmin();
  await ensureSeedData();
  app.listen(PORT, () => {
    console.log(`StockPilot server running on http://localhost:${PORT}`);
  });
})();

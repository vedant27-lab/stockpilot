require("dotenv").config();

const express = require("express");
const cookieParser = require("cookie-parser");
const path = require("path");
const { connectDB } = require("./lib/db");

const authRoutes = require("./lib/routes/auth");
const groupRoutes = require("./lib/routes/groups/index"); // Use new modular index
const inviteRoutes = require("./lib/routes/invites");
const personalRoutes = require("./lib/routes/personal");

const Product = require("./lib/models/Product");

const { authMiddleware } = require("./lib/middleware/auth"); // Use new extracted middleware

const app = express();
const PORT = process.env.PORT || 3000;

/* ─── Middleware ─────────────────────────────────────────── */

app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

/* ─── Route Mounting ─────────────────────────────────────── */

// Auth routes: register/login/logout are public; me/profile need auth
app.use("/api/auth", (req, res, next) => {
  const publicPaths = ["/register", "/login", "/logout"];
  if (publicPaths.includes(req.path)) return next();
  authMiddleware(req, res, next);
}, authRoutes);

// Group routes (all require auth)
app.use("/api/groups", authMiddleware, groupRoutes);

// Invite routes (all require auth)
app.use("/api/invites", authMiddleware, inviteRoutes);

// Personal inventory routes (all require auth)
app.use("/api/personal", authMiddleware, personalRoutes);

/* ─── Rate Limiter ───────────────────────────────────────── */
const insightsRateLimit = new Map();
function insightsRateLimiter(req, res, next) {
  const userId = req.user.id;
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 5;
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
    return res.status(429).json({ message: "Too many requests. Please wait." });
  }
  record.count++;
  next();
}

/* ─── Insights Route ─────────────────────────────────────── */

app.post("/api/insights", authMiddleware, insightsRateLimiter, async (req, res) => {
  try {
    const { query, groupId } = req.body;
    if (!query) return res.status(400).json({ message: "Query is required." });
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return res.status(500).json({ message: "Groq API key not configured." });

    if (groupId) {
      const GroupMember = require("./lib/models/GroupMember");
      const mem = await GroupMember.findOne({ groupId, userId: req.user.id });
      if (!mem) return res.status(403).json({ message: "Not a member of this group." });
      products = await Product.find({ groupId }).select("name sku category price quantity location imageMeta");
    } else {
      products = await Product.find({ groupId: null, ownerId: req.user.id }).select("name sku category price quantity location imageMeta");
    }

    const systemPrompt = `You are a helpful Inventory Insights Assistant for StockPilot.
Below is the current inventory data (some products have imageMeta containing location and timestamp of image):
${JSON.stringify(products)}

INSTRUCTIONS:
1. Format responses in clear Markdown with bullet points and tables.
2. Never output raw JSON. Use natural language.
3. If asked to modify data, say you're insights-only and suggest using the dashboard.
4. For charts, use mermaid code blocks (pie or xychart-beta only).
5. IMPORTANT: If the user asks to download images or get images for a specific location or date, filter the matching products and output EXACTLY the following tag in your response: <DOWNLOAD_IMAGES ids="id1,id2,id3" /> (replace id1,id2 with actual product _ids). Do not put this tag inside a code block. Provide a helpful message along with the tag.`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: query }],
        temperature: 0.7,
      }),
    });

    if (!response.ok) throw new Error("Failed to fetch from Groq API.");
    const data = await response.json();
    res.json({ reply: data.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ message: err.message || "Could not load insights." });
  }
});

/* ─── Page Routes ────────────────────────────────────────── */

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/dashboard", authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});


/* ─── Start ──────────────────────────────────────────────── */

(async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`StockPilot server running on http://localhost:${PORT}`);
  });
})();


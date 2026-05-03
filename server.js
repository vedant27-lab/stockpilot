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
    return res.status(429).json({ message: "Model limit reached. Please wait before asking the AI again." });
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
3. If the user asks to modify data (add, edit, delete products), use the available tools to perform those actions. You have full access to manage inventory.
4. For charts, use mermaid code blocks (pie or xychart-beta only).
5. IMPORTANT: If the user asks to download images or get images for a specific location or date, filter the matching products and output EXACTLY the following tag in your response: <DOWNLOAD_IMAGES ids="id1,id2,id3" /> (replace id1,id2 with actual product _ids). Do not put this tag inside a code block. Provide a helpful message along with the tag.`;

    const tools = [
      {
        type: "function",
        function: {
          name: "add_product",
          description: "Add a new product to the inventory",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string" },
              sku: { type: "string" },
              category: { type: "string" },
              supplier: { type: "string" },
              price: { type: "number" },
              quantity: { type: "number" },
              location: { type: "string" }
            },
            required: ["name", "sku", "category", "supplier", "price", "quantity"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "delete_product",
          description: "Delete a product from the inventory by its SKU",
          parameters: {
            type: "object",
            properties: {
              sku: { type: "string", description: "The SKU of the product to delete" }
            },
            required: ["sku"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "edit_product",
          description: "Edit an existing product in the inventory by its SKU",
          parameters: {
            type: "object",
            properties: {
              sku: { type: "string", description: "The SKU of the product to edit" },
              updates: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  category: { type: "string" },
                  supplier: { type: "string" },
                  price: { type: "number" },
                  quantity: { type: "number" },
                  location: { type: "string" }
                }
              }
            },
            required: ["sku", "updates"]
          }
        }
      }
    ];

    let messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: query }
    ];

    let response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: messages,
        temperature: 0.7,
        tools: tools,
        tool_choice: "auto"
      }),
    });

    if (!response.ok) throw new Error("Failed to fetch from Groq API.");
    let data = await response.json();
    let responseMessage = data.choices[0].message;

    // Handle tool calls
    if (responseMessage.tool_calls) {
      messages.push(responseMessage); // Add the assistant's tool calls to messages

      for (const toolCall of responseMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);
        let functionResult = "";

        try {
          if (functionName === "add_product") {
            const newProduct = new Product({
              ...functionArgs,
              groupId: groupId || null,
              ownerId: req.user.id,
              createdBy: req.user.id
            });
            await newProduct.save();
            functionResult = "Product added successfully.";
          } else if (functionName === "delete_product") {
            const result = await Product.deleteOne({ sku: functionArgs.sku.toUpperCase(), groupId: groupId || null });
            functionResult = result.deletedCount > 0 ? "Product deleted successfully." : "Product not found.";
          } else if (functionName === "edit_product") {
            const result = await Product.findOneAndUpdate(
              { sku: functionArgs.sku.toUpperCase(), groupId: groupId || null },
              { $set: functionArgs.updates },
              { new: true }
            );
            functionResult = result ? "Product updated successfully." : "Product not found.";
          }
        } catch (err) {
          functionResult = "Error executing action: " + err.message;
        }

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          name: functionName,
          content: functionResult
        });
      }

      // Second call to get the final response from AI
      response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: messages,
          temperature: 0.7
        }),
      });

      if (!response.ok) throw new Error("Failed to fetch from Groq API during tool resolution.");
      data = await response.json();
      responseMessage = data.choices[0].message;
    }

    res.json({ reply: responseMessage.content });
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


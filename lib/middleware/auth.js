/**
 * JWT authentication middleware for StockPilot.
 * Verifies the token from the cookie and attaches `req.user`.
 */
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "stockpilot-fallback-secret";
const COOKIE_NAME = "stockpilot_token";

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

module.exports = { authMiddleware, JWT_SECRET, COOKIE_NAME };

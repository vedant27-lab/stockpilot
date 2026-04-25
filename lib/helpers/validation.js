/**
 * Shared validation & normalization helpers for StockPilot.
 * Used by both group and personal inventory routes.
 */

/**
 * Normalize a category string to Title Case.
 * @param {string} cat - Raw category input
 * @returns {string} Normalized category
 */
function normalizeCategory(cat) {
  if (!cat) return "";
  return cat
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Validate a product payload.
 * @param {object} p - Product data to validate
 * @returns {string} Error message or empty string if valid
 */
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
  ) {
    return "Provide valid inventory item details.";
  }
  return "";
}

/**
 * Validate a movement payload.
 * @param {object} m - Movement data to validate
 * @returns {string} Error message or empty string if valid
 */
function validateMovement(m) {
  if (
    !m.productId ||
    !["in", "out"].includes(m.type) ||
    !Number.isFinite(Number(m.quantity)) ||
    Number(m.quantity) <= 0 ||
    !m.note
  ) {
    return "Provide valid movement details.";
  }
  return "";
}

module.exports = { normalizeCategory, validateProduct, validateMovement };

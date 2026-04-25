/**
 * Group-scoped product CRUD — add, update, delete products within a group.
 */
const express = require("express");
const router = express.Router();
const Product = require("../../models/Product");
const Movement = require("../../models/Movement");
const { groupAccess, groupAdminOnly } = require("../../middleware/groupAuth");
const { normalizeCategory, validateProduct } = require("../../helpers/validation");
const { log } = require("../../helpers/logger");

/* ── Add product ─────────────────────────────────────── */
router.post("/:id/products", groupAccess, groupAdminOnly, async (req, res) => {
  try {
    const err = validateProduct(req.body);
    if (err) return res.status(400).json({ message: err });
    const { name, sku, category, supplier, price, quantity, location, barcode, image, locationLog } = req.body;
    const product = await Product.create({
      name: name.trim(),
      sku: sku.trim().toUpperCase(),
      category: normalizeCategory(category),
      supplier: supplier.trim(),
      price: Number(price),
      quantity: Number(quantity),
      location: location ? location.trim() : "Unassigned",
      barcode: barcode ? barcode.trim() : "",
      imageUrl: image || "",
      imageMeta: (image && locationLog) ? { location: locationLog, timestamp: new Date() } : undefined,
      groupId: req.groupId,
      ownerId: req.user.id,
      createdBy: req.user.id,
    });
    let logDetail = name.trim();
    if (image && locationLog) {
      logDetail += ` [Image added from ${locationLog}]`;
    }
    await log(req.groupId, req.user.id, "Added product", logDetail, "product", product._id);
    res.status(201).json({ message: "Product added.", product });
  } catch (err) {
    res.status(500).json({ message: err.message || "Could not add product." });
  }
});

/* ── Update product ──────────────────────────────────── */
router.put("/:id/products/:pid", groupAccess, groupAdminOnly, async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.pid, groupId: req.groupId });
    if (!product) return res.status(404).json({ message: "Product not found in this group." });
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
      updatedAt: new Date(),
    });
    if (req.body.image !== undefined) {
      product.imageUrl = req.body.image;
      if (req.body.image && req.body.locationLog) {
        product.imageMeta = { location: req.body.locationLog, timestamp: new Date() };
      } else if (!req.body.image) {
        product.imageMeta = undefined;
      }
    }
    await product.save();
    
    let logDetail = product.name;
    if (req.body.image && req.body.locationLog) {
      logDetail += ` [Image updated from ${req.body.locationLog}]`;
    }
    await log(req.groupId, req.user.id, "Updated product", logDetail, "product", product._id);
    res.json({ message: "Product updated.", product });
  } catch (err) {
    res.status(500).json({ message: err.message || "Could not update product." });
  }
});

/* ── Delete product ──────────────────────────────────── */
router.delete("/:id/products/:pid", groupAccess, groupAdminOnly, async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.pid, groupId: req.groupId });
    if (!product) return res.status(404).json({ message: "Product not found in this group." });
    await Movement.deleteMany({ productId: product._id });
    await Product.findByIdAndDelete(req.params.pid);
    await log(req.groupId, req.user.id, "Deleted product", product.name, "product", product._id);
    res.json({ message: "Product deleted." });
  } catch (err) {
    res.status(500).json({ message: err.message || "Could not delete product." });
  }
});

module.exports = router;

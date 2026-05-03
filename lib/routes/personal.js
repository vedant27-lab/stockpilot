const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const Movement = require("../models/Movement");
const { normalizeCategory, validateProduct, validateMovement } = require("../helpers/validation");
const { logPersonal } = require("../helpers/logger");

// List personal products
router.get("/products", async (req, res) => {
  try {
    const products = await Product.find({ groupId: null, ownerId: req.user.id }).sort({ updatedAt: -1 });
    res.json({ products });
  } catch (err) {
    res.status(500).json({ message: "Could not load products." });
  }
});

// Add personal product
router.post("/products", async (req, res) => {
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
      imageMeta: (image && (locationLog || req.body.imageTimestamp)) ? { location: locationLog || "", timestamp: req.body.imageTimestamp ? new Date(req.body.imageTimestamp) : new Date() } : undefined,
      groupId: null,
      ownerId: req.user.id,
      createdBy: req.user.id,
    });
    let logDetail = name.trim();
    if (image && locationLog) {
      logDetail += ` [Image added from ${locationLog}]`;
    }
    await logPersonal(req.user.id, "Added personal product", logDetail, "product", product._id);
    res.status(201).json({ message: "Product added.", product });
  } catch (err) {
    res.status(500).json({ message: err.message || "Could not add product." });
  }
});

// Update personal product
router.put("/products/:pid", async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.pid, groupId: null, ownerId: req.user.id });
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
      updatedAt: new Date(),
    });
    if (req.body.image !== undefined) {
      product.imageUrl = req.body.image;
      if (req.body.image && (req.body.locationLog || req.body.imageTimestamp)) {
        product.imageMeta = { location: req.body.locationLog || "", timestamp: req.body.imageTimestamp ? new Date(req.body.imageTimestamp) : new Date() };
      } else if (!req.body.image) {
        product.imageMeta = undefined;
      }
    }
    await product.save();
    
    let logDetail = product.name;
    if (req.body.image && req.body.locationLog) {
      logDetail += ` [Image updated from ${req.body.locationLog}]`;
    }
    await logPersonal(req.user.id, "Updated personal product", logDetail, "product", product._id);
    res.json({ message: "Product updated.", product });
  } catch (err) {
    res.status(500).json({ message: err.message || "Could not update." });
  }
});

// Delete personal product
router.delete("/products/:pid", async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.pid, groupId: null, ownerId: req.user.id });
    if (!product) return res.status(404).json({ message: "Product not found." });
    await Movement.deleteMany({ productId: product._id });
    await Product.findByIdAndDelete(req.params.pid);
    await logPersonal(req.user.id, "Deleted personal product", product.name, "product", product._id);
    res.json({ message: "Product deleted." });
  } catch (err) {
    res.status(500).json({ message: err.message || "Could not delete." });
  }
});

// Personal movements
router.get("/movements", async (req, res) => {
  try {
    const movements = await Movement.find({ groupId: null, createdBy: req.user.id }).sort({ createdAt: -1 });
    res.json({ movements });
  } catch (err) {
    res.status(500).json({ message: "Could not load movements." });
  }
});

router.post("/movements", async (req, res) => {
  try {
    const err = validateMovement(req.body);
    if (err) return res.status(400).json({ message: err });
    const { productId, type, quantity, note } = req.body;
    const product = await Product.findOne({ _id: productId, groupId: null, ownerId: req.user.id });
    if (!product) return res.status(404).json({ message: "Product not found." });
    const qty = Number(quantity);
    if (type === "out" && qty > product.quantity)
      return res.status(400).json({ message: "Outgoing quantity exceeds stock." });
    product.quantity += type === "in" ? qty : -qty;
    await product.save();
    const movement = await Movement.create({
      type,
      productId: product._id,
      productName: product.name,
      quantity: qty,
      note: note.trim(),
      amount: product.price * qty,
      groupId: null,
      createdBy: req.user.id,
    });
    await logPersonal(req.user.id, `${type === "in" ? "Stock In" : "Stock Out"} ${qty} units`, product.name, "movement", movement._id);
    res.status(201).json({ message: "Movement recorded.", movement });
  } catch (err) {
    res.status(500).json({ message: err.message || "Could not record movement." });
  }
});

// Personal activity logs
router.get("/logs", async (req, res) => {
  try {
    const { entityType, limit = 100 } = req.query;
    const filter = { groupId: null, userId: req.user.id };
    if (entityType) filter.entityType = entityType;

    const logs = await ActivityLog.find(filter).sort({ createdAt: -1 }).limit(Number(limit));
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ message: "Could not load logs." });
  }
});

module.exports = router;


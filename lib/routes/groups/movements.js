/**
 * Group-scoped stock movements — record in/out movements.
 */
const express = require("express");
const router = express.Router();
const Product = require("../../models/Product");
const Movement = require("../../models/Movement");
const { groupAccess, groupAdminOnly } = require("../../middleware/groupAuth");
const { validateMovement } = require("../../helpers/validation");
const { log } = require("../../helpers/logger");

/* ── Record movement ─────────────────────────────────── */
router.post("/:id/movements", groupAccess, groupAdminOnly, async (req, res) => {
  try {
    const err = validateMovement(req.body);
    if (err) return res.status(400).json({ message: err });
    const { productId, type, quantity, note } = req.body;
    const product = await Product.findOne({ _id: productId, groupId: req.groupId });
    if (!product) return res.status(404).json({ message: "Product not found in this group." });
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
      groupId: req.groupId,
      createdBy: req.user.id,
    });
    await log(
      req.groupId,
      req.user.id,
      `${type === "in" ? "Stock In" : "Stock Out"} ${qty} units`,
      product.name,
      "movement",
      movement._id
    );
    res.status(201).json({ message: "Movement recorded.", movement });
  } catch (err) {
    res.status(500).json({ message: err.message || "Could not record movement." });
  }
});

module.exports = router;

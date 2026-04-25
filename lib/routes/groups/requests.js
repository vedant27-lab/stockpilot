/**
 * Group-scoped change requests — member submissions + admin review/approval.
 */
const express = require("express");
const router = express.Router();
const Product = require("../../models/Product");
const Movement = require("../../models/Movement");
const Request = require("../../models/Request");
const User = require("../../models/User");
const { groupAccess, groupAdminOnly } = require("../../middleware/groupAuth");
const { normalizeCategory } = require("../../helpers/validation");
const { log } = require("../../helpers/logger");

/* ── Submit a request (any member) ───────────────────── */
router.post("/:id/requests", groupAccess, async (req, res) => {
  try {
    const { type, payload } = req.body;
    if (!type || !["add_product", "record_movement", "delete_product", "send_message"].includes(type))
      return res.status(400).json({ message: "Invalid request type." });
    if (!payload) return res.status(400).json({ message: "Payload is required." });
    const user = await User.findById(req.user.id);
    const changeReq = await Request.create({
      type,
      payload,
      groupId: req.groupId,
      requestedBy: req.user.id,
      requestedByName: user ? user.name : "Unknown",
    });
    await log(req.groupId, req.user.id, `Submitted ${type} request`, "", "request", changeReq._id);
    res.status(201).json({ message: "Request submitted.", request: changeReq });
  } catch (err) {
    res.status(500).json({ message: err.message || "Could not submit request." });
  }
});

/* ── List requests (admins see all, members see own) ── */
router.get("/:id/requests", groupAccess, async (req, res) => {
  try {
    const filter = { groupId: req.groupId };
    if (req.groupRole === "member") filter.requestedBy = req.user.id;
    if (req.query.status) filter.status = req.query.status;
    const requests = await Request.find(filter)
      .populate("requestedBy", "name email")
      .populate("reviewedBy", "name email")
      .sort({ createdAt: -1 });
    res.json({ requests });
  } catch (err) {
    res.status(500).json({ message: "Could not load requests." });
  }
});

/* ── Approve request (admin+) ────────────────────────── */
router.post("/:id/requests/:rid/approve", groupAccess, groupAdminOnly, async (req, res) => {
  try {
    const changeReq = await Request.findOne({ _id: req.params.rid, groupId: req.groupId });
    if (!changeReq) return res.status(404).json({ message: "Request not found." });
    if (changeReq.status !== "pending") return res.status(400).json({ message: "Already processed." });
    changeReq.status = "approved";
    changeReq.reviewedBy = req.user.id;
    changeReq.reviewNote = req.body.note || "Approved";
    changeReq.reviewedAt = new Date();
    await changeReq.save();

    // Execute the approved action
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
        groupId: req.groupId,
        ownerId: changeReq.requestedBy,
        createdBy: changeReq.requestedBy,
      });
    } else if (changeReq.type === "record_movement") {
      const p = changeReq.payload;
      const product = await Product.findOne({ _id: p.productId, groupId: req.groupId });
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
          groupId: req.groupId,
          createdBy: changeReq.requestedBy,
        });
      }
    } else if (changeReq.type === "delete_product") {
      const p = changeReq.payload;
      await Movement.deleteMany({ productId: p.productId });
      await Product.findOneAndDelete({ _id: p.productId, groupId: req.groupId });
    }

    await log(req.groupId, req.user.id, "Approved request", changeReq.type, "request", changeReq._id);
    res.json({ message: "Request approved and executed." });
  } catch (err) {
    res.status(500).json({ message: err.message || "Could not approve." });
  }
});

/* ── Reject request (admin+) ─────────────────────────── */
router.post("/:id/requests/:rid/reject", groupAccess, groupAdminOnly, async (req, res) => {
  try {
    const changeReq = await Request.findOne({ _id: req.params.rid, groupId: req.groupId });
    if (!changeReq) return res.status(404).json({ message: "Request not found." });
    if (changeReq.status !== "pending") return res.status(400).json({ message: "Already processed." });
    changeReq.status = "rejected";
    changeReq.reviewedBy = req.user.id;
    changeReq.reviewNote = req.body.note || "Rejected";
    changeReq.reviewedAt = new Date();
    await changeReq.save();
    await log(req.groupId, req.user.id, "Rejected request", changeReq.type, "request", changeReq._id);
    res.json({ message: "Request rejected." });
  } catch (err) {
    res.status(500).json({ message: err.message || "Could not reject." });
  }
});

module.exports = router;

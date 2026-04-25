/**
 * Group CRUD operations — create, list, get, update, delete.
 */
const express = require("express");
const router = express.Router();
const Group = require("../../models/Group");
const GroupMember = require("../../models/GroupMember");
const GroupInvite = require("../../models/GroupInvite");
const Product = require("../../models/Product");
const Movement = require("../../models/Movement");
const Request = require("../../models/Request");
const ActivityLog = require("../../models/ActivityLog");
const { groupAccess, groupAdminOnly, groupOwnerOnly } = require("../../middleware/groupAuth");
const { log } = require("../../helpers/logger");

/* ── Create a new group ──────────────────────────────── */
router.post("/", async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: "Group name is required." });
    const group = await Group.create({
      name: name.trim(),
      description: (description || "").trim(),
      owner: req.user.id,
    });
    await GroupMember.create({ groupId: group._id, userId: req.user.id, role: "owner" });
    await log(group._id, req.user.id, "Created group", name.trim(), "group", group._id);
    res.status(201).json({ message: "Group created.", group });
  } catch (err) {
    res.status(500).json({ message: err.message || "Could not create group." });
  }
});

/* ── List my groups ──────────────────────────────────── */
router.get("/", async (req, res) => {
  try {
    const memberships = await GroupMember.find({ userId: req.user.id });
    const groupIds = memberships.map((m) => m.groupId);
    const groups = await Group.find({ _id: { $in: groupIds } }).sort({ updatedAt: -1 });
    const result = groups.map((g) => {
      const mem = memberships.find((m) => m.groupId.toString() === g._id.toString());
      return { ...g.toObject(), myRole: mem ? mem.role : null };
    });
    res.json({ groups: result });
  } catch (err) {
    res.status(500).json({ message: "Could not load groups." });
  }
});

/* ── Get single group with full data ─────────────────── */
router.get("/:id", groupAccess, async (req, res) => {
  try {
    const group = await Group.findById(req.groupId);
    if (!group) return res.status(404).json({ message: "Group not found." });
    const [products, movements, members, pendingRequests] = await Promise.all([
      Product.find({ groupId: req.groupId }).sort({ updatedAt: -1 }),
      Movement.find({ groupId: req.groupId }).sort({ createdAt: -1 }),
      GroupMember.find({ groupId: req.groupId }).populate("userId", "name email bio"),
      Request.find({ groupId: req.groupId, status: "pending" }).sort({ createdAt: -1 }),
    ]);
    res.json({
      group: { ...group.toObject(), myRole: req.groupRole },
      products,
      movements,
      members,
      pendingRequests,
    });
  } catch (err) {
    res.status(500).json({ message: "Could not load group." });
  }
});

/* ── Update group settings ───────────────────────────── */
router.put("/:id", groupAccess, groupAdminOnly, async (req, res) => {
  try {
    const group = await Group.findById(req.groupId);
    if (!group) return res.status(404).json({ message: "Group not found." });
    if (req.body.name) group.name = req.body.name.trim();
    if (req.body.description !== undefined) group.description = req.body.description.trim();
    await group.save();
    await log(req.groupId, req.user.id, "Updated group settings", group.name, "group", group._id);
    res.json({ message: "Group updated.", group });
  } catch (err) {
    res.status(500).json({ message: "Could not update group." });
  }
});

/* ── Delete group (owner only) ───────────────────────── */
router.delete("/:id", groupAccess, groupOwnerOnly, async (req, res) => {
  try {
    await Promise.all([
      Product.deleteMany({ groupId: req.groupId }),
      Movement.deleteMany({ groupId: req.groupId }),
      Request.deleteMany({ groupId: req.groupId }),
      GroupMember.deleteMany({ groupId: req.groupId }),
      GroupInvite.deleteMany({ groupId: req.groupId }),
      ActivityLog.deleteMany({ groupId: req.groupId }),
      Group.findByIdAndDelete(req.groupId),
    ]);
    res.json({ message: "Group deleted." });
  } catch (err) {
    res.status(500).json({ message: "Could not delete group." });
  }
});

module.exports = router;

/**
 * Group member management — list, promote, demote, remove, leave, transfer ownership.
 */
const express = require("express");
const router = express.Router();
const Group = require("../../models/Group");
const GroupMember = require("../../models/GroupMember");
const User = require("../../models/User");
const { groupAccess, groupAdminOnly, groupOwnerOnly } = require("../../middleware/groupAuth");
const { log } = require("../../helpers/logger");

/* ── List members ────────────────────────────────────── */
router.get("/:id/members", groupAccess, async (req, res) => {
  try {
    const members = await GroupMember.find({ groupId: req.groupId }).populate("userId", "name email bio");
    res.json({ members, myRole: req.groupRole });
  } catch (err) {
    res.status(500).json({ message: "Could not load members." });
  }
});

/* ── Promote member to admin (owner only) ────────────── */
router.post("/:id/members/:userId/promote", groupAccess, groupOwnerOnly, async (req, res) => {
  try {
    const mem = await GroupMember.findOne({ groupId: req.groupId, userId: req.params.userId });
    if (!mem) return res.status(404).json({ message: "User is not a member." });
    if (mem.role === "owner") return res.status(400).json({ message: "Cannot change owner role." });
    mem.role = "admin";
    await mem.save();
    const targetUser = await User.findById(req.params.userId).select("name");
    await log(req.groupId, req.user.id, "Promoted member to admin", targetUser?.name || req.params.userId, "member", mem._id);
    res.json({ message: "User promoted to admin." });
  } catch (err) {
    res.status(500).json({ message: "Could not promote user." });
  }
});

/* ── Demote admin to member (owner only) ─────────────── */
router.post("/:id/members/:userId/demote", groupAccess, groupOwnerOnly, async (req, res) => {
  try {
    const mem = await GroupMember.findOne({ groupId: req.groupId, userId: req.params.userId });
    if (!mem) return res.status(404).json({ message: "User is not a member." });
    if (mem.role === "owner") return res.status(400).json({ message: "Cannot demote the owner." });
    mem.role = "member";
    await mem.save();
    const targetUser = await User.findById(req.params.userId).select("name");
    await log(req.groupId, req.user.id, "Demoted member", targetUser?.name || req.params.userId, "member", mem._id);
    res.json({ message: "User demoted to member." });
  } catch (err) {
    res.status(500).json({ message: "Could not demote user." });
  }
});

/* ── Remove member (admin+, owner can remove admins) ─── */
router.delete("/:id/members/:userId", groupAccess, groupAdminOnly, async (req, res) => {
  try {
    if (req.params.userId === req.user.id) return res.status(400).json({ message: "Cannot remove yourself." });
    const mem = await GroupMember.findOne({ groupId: req.groupId, userId: req.params.userId });
    if (!mem) return res.status(404).json({ message: "User is not a member." });
    if (mem.role === "owner") return res.status(400).json({ message: "Cannot remove the owner." });
    if (mem.role === "admin" && req.groupRole !== "owner")
      return res.status(403).json({ message: "Only the owner can remove admins." });
    const targetUser = await User.findById(req.params.userId).select("name");
    await GroupMember.findByIdAndDelete(mem._id);
    await log(req.groupId, req.user.id, "Removed member", targetUser?.name || req.params.userId, "member", mem._id);
    res.json({ message: "Member removed." });
  } catch (err) {
    res.status(500).json({ message: "Could not remove member." });
  }
});

/* ── Leave group (self) ──────────────────────────────── */
router.post("/:id/leave", groupAccess, async (req, res) => {
  try {
    if (req.groupRole === "owner")
      return res.status(400).json({ message: "Owner cannot leave. Transfer ownership or delete the group." });
    await GroupMember.findByIdAndDelete(req.groupMembership._id);
    await log(req.groupId, req.user.id, "Left group", "", "member");
    res.json({ message: "You left the group." });
  } catch (err) {
    res.status(500).json({ message: "Could not leave group." });
  }
});

/* ── Transfer ownership (owner only) ─────────────────── */
router.post("/:id/members/:userId/transfer", groupAccess, groupOwnerOnly, async (req, res) => {
  try {
    if (req.params.userId === req.user.id)
      return res.status(400).json({ message: "You are already the owner." });

    const targetMem = await GroupMember.findOne({ groupId: req.groupId, userId: req.params.userId });
    if (!targetMem) return res.status(404).json({ message: "User is not a member." });

    // Demote current owner to admin
    const currentOwnerMem = await GroupMember.findOne({ groupId: req.groupId, userId: req.user.id });
    currentOwnerMem.role = "admin";
    await currentOwnerMem.save();

    // Promote target to owner
    targetMem.role = "owner";
    await targetMem.save();

    // Update group owner field
    const group = await Group.findById(req.groupId);
    group.owner = req.params.userId;
    await group.save();

    const targetUser = await User.findById(req.params.userId).select("name");
    await log(req.groupId, req.user.id, "Transferred ownership", `to ${targetUser?.name || req.params.userId}`, "group", group._id);
    res.json({ message: "Ownership transferred." });
  } catch (err) {
    res.status(500).json({ message: err.message || "Could not transfer ownership." });
  }
});

module.exports = router;

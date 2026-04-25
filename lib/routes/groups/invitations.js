/**
 * Group-scoped invitation management — send and list invites for a group.
 */
const express = require("express");
const router = express.Router();
const GroupMember = require("../../models/GroupMember");
const GroupInvite = require("../../models/GroupInvite");
const User = require("../../models/User");
const { groupAccess, groupAdminOnly } = require("../../middleware/groupAuth");
const { log } = require("../../helpers/logger");

/* ── Send invite ─────────────────────────────────────── */
router.post("/:id/invites", groupAccess, groupAdminOnly, async (req, res) => {
  try {
    const { email, message } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required." });
    const targetUser = await User.findOne({ email: email.toLowerCase() });
    if (!targetUser) return res.status(404).json({ message: "No user found with that email." });
    const existing = await GroupMember.findOne({ groupId: req.groupId, userId: targetUser._id });
    if (existing) return res.status(400).json({ message: "User is already a member." });
    const pendingInvite = await GroupInvite.findOne({
      groupId: req.groupId,
      invitedUserId: targetUser._id,
      status: "pending",
    });
    if (pendingInvite) return res.status(400).json({ message: "Invite already pending for this user." });
    const invite = await GroupInvite.create({
      groupId: req.groupId,
      invitedUserId: targetUser._id,
      invitedBy: req.user.id,
      message: (message || "").trim(),
    });
    await log(req.groupId, req.user.id, "Sent invite", email, "invite", invite._id);
    res.status(201).json({ message: "Invite sent.", invite });
  } catch (err) {
    res.status(500).json({ message: err.message || "Could not send invite." });
  }
});

/* ── List sent invites for this group ────────────────── */
router.get("/:id/invites", groupAccess, groupAdminOnly, async (req, res) => {
  try {
    const invites = await GroupInvite.find({ groupId: req.groupId })
      .populate("invitedUserId", "name email")
      .populate("invitedBy", "name email")
      .sort({ createdAt: -1 });
    res.json({ invites });
  } catch (err) {
    res.status(500).json({ message: "Could not load invites." });
  }
});

module.exports = router;

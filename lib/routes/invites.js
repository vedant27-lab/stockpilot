const express = require("express");
const router = express.Router();
const GroupInvite = require("../models/GroupInvite");
const GroupMember = require("../models/GroupMember");
const Group = require("../models/Group");
const ActivityLog = require("../models/ActivityLog");

// Get my pending invites
router.get("/", async (req, res) => {
  try {
    const invites = await GroupInvite.find({ invitedUserId: req.user.id, status: "pending" })
      .populate("groupId", "name description")
      .populate("invitedBy", "name email")
      .sort({ createdAt: -1 });
    res.json({ invites });
  } catch (err) {
    res.status(500).json({ message: "Could not load invites." });
  }
});

// Accept invite
router.post("/:inviteId/accept", async (req, res) => {
  try {
    const invite = await GroupInvite.findOne({ _id: req.params.inviteId, invitedUserId: req.user.id, status: "pending" });
    if (!invite) return res.status(404).json({ message: "Invite not found." });
    
    const existing = await GroupMember.findOne({ groupId: invite.groupId, userId: req.user.id });
    if (existing) {
      invite.status = "accepted";
      invite.respondedAt = new Date();
      await invite.save();
      return res.json({ message: "You are already a member." });
    }

    await GroupMember.create({ groupId: invite.groupId, userId: req.user.id, role: "member" });
    invite.status = "accepted";
    invite.respondedAt = new Date();
    await invite.save();
    
    await ActivityLog.create({ groupId: invite.groupId, userId: req.user.id, action: "Accepted invite and joined", entityType: "invite", entityId: invite._id }).catch(() => {});
    res.json({ message: "Invite accepted. You are now a member." });
  } catch (err) {
    res.status(500).json({ message: "Could not accept invite." });
  }
});

// Decline invite
router.post("/:inviteId/decline", async (req, res) => {
  try {
    const invite = await GroupInvite.findOne({ _id: req.params.inviteId, invitedUserId: req.user.id, status: "pending" });
    if (!invite) return res.status(404).json({ message: "Invite not found." });
    invite.status = "declined";
    invite.respondedAt = new Date();
    await invite.save();
    res.json({ message: "Invite declined." });
  } catch (err) {
    res.status(500).json({ message: "Could not decline invite." });
  }
});

module.exports = router;

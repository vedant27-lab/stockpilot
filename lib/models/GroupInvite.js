const mongoose = require("mongoose");

const groupInviteSchema = new mongoose.Schema({
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Group",
    required: true,
  },
  invitedUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "declined"],
    default: "pending",
  },
  message: { type: String, default: "", trim: true },
  createdAt: { type: Date, default: Date.now },
  respondedAt: { type: Date },
});

// Prevent duplicate pending invites for the same user in the same group
groupInviteSchema.index({ groupId: 1, invitedUserId: 1, status: 1 });

module.exports = mongoose.model("GroupInvite", groupInviteSchema);

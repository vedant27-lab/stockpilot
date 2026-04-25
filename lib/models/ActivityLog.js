const mongoose = require("mongoose");

const activityLogSchema = new mongoose.Schema({
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Group",
    default: null, // null = personal activity
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  action: { type: String, required: true, trim: true },
  details: { type: String, default: "", trim: true },
  entityType: {
    type: String,
    enum: ["product", "movement", "member", "invite", "group", "request", "other"],
    default: "other",
  },
  entityId: { type: mongoose.Schema.Types.ObjectId },
  createdAt: { type: Date, default: Date.now },
});

activityLogSchema.index({ groupId: 1, createdAt: -1 });
activityLogSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("ActivityLog", activityLogSchema);

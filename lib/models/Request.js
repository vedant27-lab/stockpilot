const mongoose = require("mongoose");

const requestSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["add_product", "record_movement", "delete_product", "edit_product", "send_message"],
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Group",
    required: true,
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  requestedByName: { type: String, default: "" },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  reviewNote: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
  reviewedAt: { type: Date },
});

requestSchema.index({ groupId: 1, status: 1 });

module.exports = mongoose.model("Request", requestSchema);

const mongoose = require("mongoose");

const requestSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["add_product", "record_movement", "delete_product", "edit_product"],
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
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

module.exports = mongoose.model("Request", requestSchema);

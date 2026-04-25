const mongoose = require("mongoose");

const movementSchema = new mongoose.Schema({
  type: { type: String, enum: ["in", "out"], required: true },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  productName: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  note: { type: String, trim: true, default: "" },
  amount: { type: Number, default: 0 },
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Group",
    default: null, // null = personal movement
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});

movementSchema.index({ groupId: 1, createdAt: -1 });

module.exports = mongoose.model("Movement", movementSchema);

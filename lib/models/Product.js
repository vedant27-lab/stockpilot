const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  sku: { type: String, required: true, trim: true, uppercase: true },
  category: { type: String, required: true, trim: true },
  supplier: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 0 },
  location: { type: String, default: "Unassigned" },
  barcode: { type: String, default: "" },
  imageUrl: { type: String, default: "" },
  imageMeta: {
    location: { type: String, default: "" },
    timestamp: { type: Date }
  },
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Group",
    default: null, // null = personal inventory
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true, // always set: creator of the product
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  updatedAt: { type: Date, default: Date.now },
});

productSchema.pre("save", function () {
  this.updatedAt = new Date();
});

productSchema.index({ groupId: 1 });
productSchema.index({ ownerId: 1, groupId: 1 });

module.exports = mongoose.model("Product", productSchema);

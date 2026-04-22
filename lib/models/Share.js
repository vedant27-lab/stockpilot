const mongoose = require("mongoose");

const shareSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  role: { type: String, enum: ["Viewer", "Editor"], default: "Viewer" },
  token: { type: String, required: true },
  status: { type: String, enum: ["Active", "Revoked"], default: "Active" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Share", shareSchema);

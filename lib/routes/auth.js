const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET || "stockpilot-fallback-secret";
const COOKIE_NAME = "stockpilot_token";

function signToken(user) {
  return jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
}

router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: "Name, email, and password are required." });
    if (password.length < 6)
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing)
      return res.status(400).json({ message: "An account with this email already exists." });
    const user = await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
    });
    const token = signToken(user);
    res.cookie(COOKIE_NAME, token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: "lax" });
    res.status(201).json({ message: "Account created successfully.", user: user.toSafeJSON() });
  } catch (err) {
    res.status(500).json({ message: err.message || "Registration failed." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email and password are required." });
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ message: "Invalid email or password." });
    if (user.status === "suspended")
      return res.status(403).json({ message: "Account suspended." });
    const valid = await user.comparePassword(password);
    if (!valid) return res.status(401).json({ message: "Invalid email or password." });
    const token = signToken(user);
    res.cookie(COOKIE_NAME, token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: "lax" });
    res.json({ message: "Login successful.", user: user.toSafeJSON() });
  } catch (err) {
    res.status(500).json({ message: err.message || "Login failed." });
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ message: "Logged out." });
});

router.get("/me", async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found." });
    res.json({ user: user.toSafeJSON() });
  } catch (err) {
    res.status(500).json({ message: "Could not fetch user." });
  }
});

router.put("/profile", async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found." });
    if (req.body.name) user.name = req.body.name.trim();
    if (req.body.bio !== undefined) user.bio = req.body.bio.trim();
    await user.save();
    res.json({ message: "Profile updated.", user: user.toSafeJSON() });
  } catch (err) {
    res.status(500).json({ message: "Could not update profile." });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) return res.status(400).json({ message: "Email and new password are required." });
    if (newPassword.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters." });
    
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ message: "Account not found." });
    
    user.password = newPassword;
    await user.save();
    res.json({ message: "Password reset successful. You can now login." });
  } catch (err) {
    res.status(500).json({ message: "Could not reset password." });
  }
});
router.delete("/profile", async (req, res) => {
  try {
    const userId = req.user.id;
    const Product = require("../models/Product");
    const Group = require("../models/Group");
    const GroupMember = require("../models/GroupMember");
    const ActivityLog = require("../models/ActivityLog");
    const Movement = require("../models/Movement");
    
    // Delete personal products & movements
    const personalProducts = await Product.find({ ownerId: userId, groupId: null });
    const pIds = personalProducts.map(p => p._id);
    await Movement.deleteMany({ productId: { $in: pIds } });
    await Product.deleteMany({ ownerId: userId, groupId: null });
    
    // Find groups owned by user and delete them
    const ownedGroups = await Group.find({ owner: userId });
    for (const g of ownedGroups) {
      await Product.deleteMany({ groupId: g._id });
      await GroupMember.deleteMany({ groupId: g._id });
      await ActivityLog.deleteMany({ groupId: g._id });
      await g.deleteOne();
    }
    
    // Remove from other groups
    await GroupMember.deleteMany({ userId });
    
    // Delete the user
    await User.findByIdAndDelete(userId);
    
    res.clearCookie("token");
    res.json({ message: "Profile deleted successfully." });
  } catch (err) {
    res.status(500).json({ message: "Could not delete profile." });
  }
});

module.exports = router;

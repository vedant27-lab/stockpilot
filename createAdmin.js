require("dotenv").config();
const { connectDB } = require("./lib/db");
const User = require("./lib/models/User");

async function createAdmin() {
  await connectDB();
  const existing = await User.findOne({ email: "admin@test.com" });
  if (!existing) {
    await User.create({
      name: "Admin User",
      email: "admin@test.com",
      password: "password",
      role: "admin",
    });
    console.log("Admin created.");
  } else {
    console.log("Admin already exists.");
  }
  process.exit();
}

createAdmin();

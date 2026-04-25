const express = require("express");
const router = express.Router();

const crudRoutes = require("./crud");
const memberRoutes = require("./members");
const inviteRoutes = require("./invitations");
const productRoutes = require("./products");
const movementRoutes = require("./movements");
const requestRoutes = require("./requests");
const logRoutes = require("./logs");

// Order matters: specific sub-routes first, then generic /:id routes
router.use("/", memberRoutes);
router.use("/", inviteRoutes);
router.use("/", productRoutes);
router.use("/", movementRoutes);
router.use("/", requestRoutes);
router.use("/", logRoutes);
router.use("/", crudRoutes); // Generic CRUD like /:id should be last

module.exports = router;

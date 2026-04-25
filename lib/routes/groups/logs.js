/**
 * Group-scoped activity logs — view audit trail for a group.
 */
const express = require("express");
const router = express.Router();
const ActivityLog = require("../../models/ActivityLog");
const { groupAccess } = require("../../middleware/groupAuth");

/* ── Get activity logs for the group ─────────────────── */
router.get("/:id/logs", groupAccess, async (req, res) => {
  try {
    const { userId, entityType, limit = 100 } = req.query;
    
    const filter = { groupId: req.groupId };
    if (userId) filter.userId = userId;
    if (entityType) filter.entityType = entityType;

    const logs = await ActivityLog.find(filter)
      .populate("userId", "name email")
      .sort({ createdAt: -1 })
      .limit(Number(limit));
      
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ message: "Could not load logs." });
  }
});

/* ── Export group logs as CSV (Simple implementation) ── */
router.get("/:id/logs/export", groupAccess, async (req, res) => {
  try {
    const logs = await ActivityLog.find({ groupId: req.groupId })
      .populate("userId", "name email")
      .sort({ createdAt: -1 });

    let csv = "Timestamp,User,Action,Details,Entity Type\n";
    logs.forEach((l) => {
      csv += `"${l.createdAt.toISOString()}","${l.userId?.name || "System"}","${l.action}","${(l.details || "").replace(/"/g, '""')}","${l.entityType}"\n`;
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=group-logs-${req.groupId}.csv`);
    res.status(200).send(csv);
  } catch (err) {
    res.status(500).json({ message: "Could not export logs." });
  }
});

module.exports = router;

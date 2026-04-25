/**
 * Shared activity logging helper for StockPilot.
 * Provides a consistent interface for recording group and personal activity.
 */
const ActivityLog = require("../models/ActivityLog");

/**
 * Log an activity for a group.
 * @param {string} groupId - The group context (null for personal)
 * @param {string} userId - The user performing the action
 * @param {string} action - Human-readable action description
 * @param {string} [details=""] - Additional detail string
 * @param {string} [entityType="other"] - Entity type enum value
 * @param {string} [entityId] - Associated entity ObjectId
 * @returns {Promise} Resolves after log is created (failures are swallowed)
 */
function log(groupId, userId, action, details = "", entityType = "other", entityId = undefined) {
  return ActivityLog.create({
    groupId,
    userId,
    action,
    details,
    entityType,
    entityId,
  }).catch(() => {});
}

/**
 * Log a personal (non-group) activity.
 */
function logPersonal(userId, action, details = "", entityType = "other", entityId = undefined) {
  return log(null, userId, action, details, entityType, entityId);
}

module.exports = { log, logPersonal };

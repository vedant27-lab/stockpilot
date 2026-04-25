const GroupMember = require("../models/GroupMember");

/**
 * Middleware that loads the user's role in the group specified by :groupId.
 * Attaches req.groupRole (owner/admin/member) and req.groupMembership.
 * Returns 403 if user is not a member of the group.
 */
function groupAccess(req, res, next) {
  const groupId = req.params.groupId || req.params.id;
  if (!groupId) {
    return res.status(400).json({ message: "Group ID is required." });
  }

  GroupMember.findOne({ groupId, userId: req.user.id })
    .then((membership) => {
      if (!membership) {
        return res
          .status(403)
          .json({ message: "You are not a member of this group." });
      }
      req.groupRole = membership.role;
      req.groupMembership = membership;
      req.groupId = groupId;
      next();
    })
    .catch((err) => {
      res.status(500).json({ message: "Could not verify group access." });
    });
}

/**
 * Requires the user to be an admin or owner of the group.
 * Must be used AFTER groupAccess middleware.
 */
function groupAdminOnly(req, res, next) {
  if (req.groupRole !== "admin" && req.groupRole !== "owner") {
    return res
      .status(403)
      .json({ message: "Group admin access required." });
  }
  next();
}

/**
 * Requires the user to be the owner of the group.
 * Must be used AFTER groupAccess middleware.
 */
function groupOwnerOnly(req, res, next) {
  if (req.groupRole !== "owner") {
    return res
      .status(403)
      .json({ message: "Only the group owner can perform this action." });
  }
  next();
}

module.exports = { groupAccess, groupAdminOnly, groupOwnerOnly };

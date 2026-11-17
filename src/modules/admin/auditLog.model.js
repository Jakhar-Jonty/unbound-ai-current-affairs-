'use strict';
const mongoose = require('mongoose');

/** Who did what to which item. Written for every editorial and admin action. */
const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId },
    details: mongoose.Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

function audit(req, action, entityType, entityId, details) {
  return AuditLog.create({ actor: req.user._id, action, entityType, entityId, details });
}

module.exports = { AuditLog, audit };

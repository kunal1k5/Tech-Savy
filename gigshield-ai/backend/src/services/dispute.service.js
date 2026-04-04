const Joi = require("joi");

const DISPUTE_STATUSES = Object.freeze({
  INITIATED: "INITIATED",
  RECEIVED: "RECEIVED",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
});

const startDisputeSchema = Joi.object({
  userId: Joi.string().trim().required(),
  reason: Joi.string().trim().min(5).required(),
});

const disputes = new Map();
let disputeSequence = 1001;

function nowIso() {
  return new Date().toISOString();
}

function createDisputeId() {
  const disputeId = `D${disputeSequence}`;
  disputeSequence += 1;
  return disputeId;
}

function startDispute({ userId, reason }) {
  const disputeId = createDisputeId();
  const record = {
    disputeId,
    dispute: true,
    userId: String(userId).trim(),
    reason: String(reason).trim(),
    status: DISPUTE_STATUSES.INITIATED,
    createdAt: nowIso(),
    proof: null,
  };

  disputes.set(disputeId, record);

  return {
    disputeId: record.disputeId,
    status: record.status,
  };
}

function getDisputeById(disputeId) {
  return disputes.get(disputeId) || null;
}

function attachProofUpload(disputeId, proof) {
  const record = disputes.get(disputeId);
  if (!record) {
    return null;
  }

  const updatedRecord = {
    ...record,
    status: DISPUTE_STATUSES.RECEIVED,
    proof: {
      ...proof,
      status: DISPUTE_STATUSES.RECEIVED,
      receivedAt: nowIso(),
    },
  };

  disputes.set(disputeId, updatedRecord);
  return updatedRecord;
}

function attachReverificationResult(disputeId, verification) {
  const record = disputes.get(disputeId);
  if (!record) {
    return null;
  }

  const updatedRecord = {
    ...record,
    status: verification.finalStatus,
    verification: {
      ...verification,
      reviewedAt: nowIso(),
    },
  };

  disputes.set(disputeId, updatedRecord);
  return updatedRecord;
}

function resetDisputeStore() {
  disputes.clear();
  disputeSequence = 1001;
}

module.exports = {
  attachProofUpload,
  attachReverificationResult,
  DISPUTE_STATUSES,
  getDisputeById,
  resetDisputeStore,
  startDispute,
  startDisputeSchema,
};

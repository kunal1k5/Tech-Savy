import React from "react";
import { MapPin, Phone, UserRound } from "lucide-react";
import StatusBadge from "../ui/StatusBadge";

function getInitials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function ProfileCard({
  fullName,
  mobileNumber,
  city,
  workType,
  verificationStatus,
  trustLevel,
  trustScore,
}) {
  const displayName = fullName || "Complete your profile";
  const normalizedTrustLevel = String(trustLevel || "medium");
  const trustLevelLabel = `${normalizedTrustLevel[0].toUpperCase()}${normalizedTrustLevel.slice(1)}`;
  const normalizedTrustScore = Math.max(0, Math.min(100, Number(trustScore || 0)));

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md">
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-lg font-semibold text-white">
            {getInitials(displayName)}
          </div>

          <div>
            <p className="text-sm font-medium text-slate-500">Trust &amp; Identity Center</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
              {displayName}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Your identity, verification status, and trust score determine claim approvals and fraud risk.
            </p>
            <div className="mt-3 flex flex-col gap-2 text-sm text-slate-600 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
              <span className="inline-flex items-center gap-2">
                <Phone size={16} className="text-slate-400" />
                {mobileNumber || "Add mobile number"}
              </span>
              <span className="inline-flex items-center gap-2">
                <MapPin size={16} className="text-slate-400" />
                {city || "Add city"}
              </span>
              <span className="inline-flex items-center gap-2">
                <UserRound size={16} className="text-slate-400" />
                {workType || "Add work type"}
              </span>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">Trust Score: {Math.round(normalizedTrustScore)}%</p>
                <p className="text-sm font-semibold text-slate-700">Trust Level: {trustLevelLabel}</p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-500"
                  style={{ width: `${normalizedTrustScore}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <StatusBadge status={verificationStatus} label="Verification Live" />
          <StatusBadge status={trustLevel} label={`Trust Level: ${trustLevelLabel}`} />
        </div>
      </div>
    </section>
  );
}

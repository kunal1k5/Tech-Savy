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
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md">
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-lg font-semibold text-white">
            {getInitials(fullName)}
          </div>

          <div>
            <p className="text-sm font-medium text-slate-500">Profile</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
              {fullName}
            </h2>
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
                {workType}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <StatusBadge status={verificationStatus} />
          <StatusBadge status={trustLevel} label={`Trust Level: ${trustLevel[0].toUpperCase()}${trustLevel.slice(1)}`} />
        </div>
      </div>
    </section>
  );
}

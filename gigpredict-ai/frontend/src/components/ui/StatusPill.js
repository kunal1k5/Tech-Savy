import React from "react";
import Badge from "./Badge";

export default function StatusPill({ children, tone = "default", className = "", pulse = false }) {
  return (
    <Badge tone={tone} className={className} pulse={pulse}>
      {children}
    </Badge>
  );
}

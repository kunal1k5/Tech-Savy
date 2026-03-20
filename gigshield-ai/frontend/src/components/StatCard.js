import React from "react";

/**
 * StatCard — Dashboard analytics card with icon and value.
 */
function StatCard({ title, value, subtitle, color = "bg-primary-500" }) {
  return (
    <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
          {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`w-12 h-12 ${color} rounded-lg flex items-center justify-center`}>
          <span className="text-white text-xl">📊</span>
        </div>
      </div>
    </div>
  );
}

export default StatCard;

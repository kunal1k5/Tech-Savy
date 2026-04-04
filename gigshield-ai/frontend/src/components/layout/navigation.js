import {
  FileText,
  LayoutDashboard,
  Map,
  Shield,
  UserRound,
} from "lucide-react";

export const NAV_ITEMS = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
    matches: (pathname) => pathname === "/dashboard",
  },
  {
    label: "Decision Studio",
    path: "/policy",
    icon: Shield,
    matches: (pathname) => pathname === "/policy" || pathname === "/insurance",
  },
  {
    label: "Claims",
    path: "/claims",
    icon: FileText,
    matches: (pathname) => pathname.startsWith("/claims"),
  },
  {
    label: "Risk Map",
    path: "/risk-map",
    icon: Map,
    matches: (pathname) => pathname.startsWith("/risk-map"),
  },
  {
    label: "Profile",
    path: "/profile",
    icon: UserRound,
    matches: (pathname) => pathname.startsWith("/profile"),
  },
];

const PAGE_TITLES = {
  "/dashboard": "Dashboard",
  "/policy": "Decision Studio",
  "/insurance": "Decision Studio",
  "/claims": "Claims",
  "/risk-map": "Risk Map",
  "/profile": "Profile",
  "/location-predictor": "Location Predictor",
};

export function getPageTitle(pathname) {
  if (PAGE_TITLES[pathname]) {
    return PAGE_TITLES[pathname];
  }

  const matchingItem = NAV_ITEMS.find((item) => item.matches(pathname));
  return matchingItem?.label || "GigPredict AI";
}

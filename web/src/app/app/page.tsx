import type { Metadata } from "next";
import { DashboardScreen } from "@/components/screens/dashboard";

export const metadata: Metadata = { title: "Today" };

// Dashboard renders behind the client-only AuthGuard, so instant-prerender validation
// can't reach it. Removed once auth moves server-side.
export const instant = false;

export default function DashboardPage() {
  return <DashboardScreen />;
}

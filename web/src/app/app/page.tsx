import type { Metadata } from "next";
import { DashboardScreen } from "@/components/screens/dashboard";

export const metadata: Metadata = { title: "Today" };

export default function DashboardPage() {
  return <DashboardScreen />;
}

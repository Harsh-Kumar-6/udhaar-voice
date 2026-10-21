import type { Metadata } from "next";
import { RemindersScreen } from "@/components/screens/reminders";

export const metadata: Metadata = { title: "Reminders" };

export default function RemindersPage() {
  return <RemindersScreen />;
}

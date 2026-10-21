import type { Metadata } from "next";
import { ReportScreen } from "@/components/screens/report";

export const metadata: Metadata = { title: "Today's report" };

export default function Page() {
  return <ReportScreen />;
}

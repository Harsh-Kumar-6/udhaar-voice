import type { Metadata } from "next";
import { KhataScreen } from "@/components/screens/khata";

export const metadata: Metadata = { title: "Snap khata" };

export default function KhataPage() {
  return <KhataScreen />;
}

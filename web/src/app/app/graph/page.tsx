import type { Metadata } from "next";
import { GraphScreen } from "@/components/screens/graph";

export const metadata: Metadata = { title: "Knowledge graph" };

export default function Page() {
  return <GraphScreen />;
}

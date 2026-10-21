import type { Metadata } from "next";
import { AskScreen } from "@/components/screens/ask";

export const metadata: Metadata = { title: "Ask your khata" };

export default function Page() {
  return <AskScreen />;
}

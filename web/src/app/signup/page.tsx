import type { Metadata } from "next";
import { SignupScreen } from "@/components/screens/signup";

export const metadata: Metadata = { title: "Create your khata" };

export default function SignupPage() {
  return <SignupScreen />;
}

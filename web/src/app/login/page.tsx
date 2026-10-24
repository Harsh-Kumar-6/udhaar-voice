import type { Metadata } from "next";
import { LoginScreen } from "@/components/screens/login";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return <LoginScreen />;
}

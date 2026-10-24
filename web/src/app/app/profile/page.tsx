import type { Metadata } from "next";
import { ProfileScreen } from "@/components/screens/profile";

export const metadata: Metadata = { title: "Profile" };

export default function Page() {
  return <ProfileScreen />;
}

import type { Metadata } from "next";
import { AppShell } from "@/components/app/app-shell";
import { AuthGuard } from "@/components/app/auth-guard";

export const metadata: Metadata = {
  title: { default: "Shop", template: "%s · Udhaar Voice" },
};

export default function ShopLayout({ children }: LayoutProps<"/app">) {
  return (
    <AuthGuard>
      <AppShell>
        {children}
      </AppShell>
    </AuthGuard>
  );
}

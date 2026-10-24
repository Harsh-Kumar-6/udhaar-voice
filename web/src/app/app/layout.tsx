import type { Metadata } from "next";
import { AppShell } from "@/components/app/app-shell";
import { AuthGuard } from "@/components/app/auth-guard";
import { PrototypeBanner } from "@/components/app/prototype-banner";
import { SimulatorRunner } from "@/components/app/simulator-runner";

export const metadata: Metadata = {
  title: { default: "Shop", template: "%s · Udhaar Voice" },
};

export default function ShopLayout({ children }: LayoutProps<"/app">) {
  return (
    <AuthGuard>
      <AppShell banner={<PrototypeBanner />}>
        <SimulatorRunner />
        {children}
      </AppShell>
    </AuthGuard>
  );
}

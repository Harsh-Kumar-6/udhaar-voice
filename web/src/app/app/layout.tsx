import type { Metadata } from "next";
import { AppShell } from "@/components/app/app-shell";
import { PrototypeBanner } from "@/components/app/prototype-banner";
import { SimulatorRunner } from "@/components/app/simulator-runner";

export const metadata: Metadata = {
  title: { default: "Shop", template: "%s · Udhaar Voice" },
};

export default function ShopLayout({ children }: LayoutProps<"/app">) {
  return (
    <AppShell banner={<PrototypeBanner />}>
      <SimulatorRunner />
      {children}
    </AppShell>
  );
}

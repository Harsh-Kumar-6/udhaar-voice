import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingBlock } from "@/components/app/bits";
import { CustomerDetailScreen } from "@/components/screens/customer-detail";

export const metadata: Metadata = { title: "Customer" };

// The customer id is only known at request time, so the client screen reads it inside Suspense.
export default function CustomerPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <CustomerDetailScreen />
    </Suspense>
  );
}

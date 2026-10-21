import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingBlock } from "@/components/app/bits";
import { CallDetailScreen } from "@/components/screens/call-detail";

export const metadata: Metadata = { title: "Call" };

// The call id is only known at request time, so the client screen reads it inside Suspense.
export default function CallPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <CallDetailScreen />
    </Suspense>
  );
}

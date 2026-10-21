import type { GraphNodeType } from "@/lib/api/contract";

export const graph = {
  title: "Knowledge graph",
  description: "Everything the calls have learned: who owes, who promised, who disputed, what they asked for, and who pays for whom.",
  show: "Show",
  types: {
    shop: "Shop",
    customer: "Customers",
    promise: "Promises",
    dispute: "Disputes",
    note: "Notes",
    product: "Product requests",
  } satisfies Record<GraphNodeType, string>,
  hidePaid: "Hide paid-up customers",
  legend: "Colours",
  relayout: "Re-arrange",
  details: "Details",
  pickNode: "Tap a circle to see what the khata knows about it.",
  openCustomer: "Open customer",
  owes: "Owes",
  asked: (n: number) => `Asked by ${n} ${n === 1 ? "customer" : "customers"}`,
  edgeKinds: { owes: "owes", promised: "promised", disputed: "disputed", said: "said", asked_for: "asked for", pays_through: "pays through" },
};

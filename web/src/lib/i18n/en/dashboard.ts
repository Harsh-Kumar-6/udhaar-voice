import type { AttentionItem } from "@/lib/api/contract";

export const dashboard = {
  greeting: (firstName: string) => `Namaskar, ${firstName}`,
  description: "Who owes what, who promised to pay, and what needs you today.",
  actions: { snap: "Snap khata", schedule: "Schedule reminders" },
  stats: {
    pending: "Pending",
    pendingHint: (n: number) => `${n} customers owe`,
    promised: "Promised this week",
    promisedHint: (n: number) => `${n} ${n === 1 ? "promise" : "promises"} due in 7 days`,
    collected: "Collected this week",
    collectedHint: (today: string) => `${today} today`,
    disputes: "Open disputes",
    disputesHint: "Check before calling again",
  },
  live: {
    title: (done: number, total: number) => `Calling customers: ${done} of ${total} done`,
    waiting: (n: number) => `${n} waiting`,
    watch: "Watch",
  },
  attention: {
    title: "Needs you",
    empty: "Nothing needs you right now.",
    kinds: {
      overdue: "Missed promise",
      dispute: "Dispute",
      callback: "Call back",
      wrong_number: "Wrong number",
      refused: "Refused",
      low_confidence: "Check promise",
    } satisfies Record<AttentionItem["kind"], string>,
    actions: {
      open: "Open",
      review: "Review",
      scheduleCallback: "Schedule call back",
      updateNumber: "Update number",
      checkCall: "Check call",
    },
    callbackScheduled: (name: string) => `Call back to ${name} scheduled`,
  },
  upcoming: { title: "Coming up", empty: "No promises due in the next few days.", today: "Today", tomorrow: "Tomorrow" },
  chart: { title: "Last 7 days", description: "Rupees collected and promised each day", collected: "Collected", promised: "Promised" },
  recent: { title: "Recent calls", empty: "No calls yet. Schedule reminders to start.", all: "All calls" },
};

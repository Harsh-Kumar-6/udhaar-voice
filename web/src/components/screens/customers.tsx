"use client";

import { format, parseISO } from "date-fns";
import { Camera, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  CallStatusPill,
  CustomerName,
  EmptyState,
  ErrorBlock,
  LanguageTag,
  LoadingBlock,
  Money,
  OutcomeBadge,
  PageHeader,
  StatusChip,
  TimeAgo,
} from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CustomerSummary } from "@/lib/api/contract";
import { useCustomers } from "@/lib/api/hooks";
import type { CustomerStatus } from "@/lib/domain/types";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const FILTERS: CustomerStatus[] = ["overdue", "disputed", "due", "promised", "opted_out", "paid"];

export function CustomersScreen() {
  const t = useT();
  const c = t.customers;
  const q = useCustomers();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CustomerStatus | "all">("all");

  const all = q.data ?? [];
  const needle = query.trim().toLowerCase();
  const visible = all.filter(
    (s) =>
      (filter === "all" || s.status === filter) &&
      (!needle || s.customer.name.toLowerCase().includes(needle) || (s.customer.nameNative ?? "").includes(query.trim())),
  );
  const count = (status: CustomerStatus) => all.filter((s) => s.status === status).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title={c.title}
        description={c.description}
        actions={
          <Button asChild variant="outline" size="lg">
            <Link href="/app/khata">
              <Camera /> {c.addFromKhata}
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-3">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="customer-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={c.search} className="h-10 pl-9" aria-label={c.search} />
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filter by status">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label={c.filterAll} count={all.length} />
          {FILTERS.map((s) => (
            <FilterChip key={s} active={filter === s} onClick={() => setFilter(s)} label={t.common.status[s]} count={count(s)} />
          ))}
        </div>
      </div>

      {q.isPending ? (
        <LoadingBlock />
      ) : q.isError ? (
        <ErrorBlock onRetry={() => q.refetch()} />
      ) : visible.length === 0 ? (
        <EmptyState title={c.empty} />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="hidden grid-cols-[minmax(0,2.2fr)_1fr_1fr_1.2fr_1.3fr] gap-4 border-b bg-muted/40 px-4 py-2.5 text-xs font-medium text-muted-foreground md:grid">
            <span>{c.columns.customer}</span>
            <span className="text-right">{c.columns.balance}</span>
            <span>{c.columns.status}</span>
            <span>{c.columns.next}</span>
            <span>{c.columns.lastCall}</span>
          </div>
          <ul className="divide-y">
            {visible.map((s) => (
              <CustomerRow key={s.customer.id} s={s} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
      )}
    >
      {label}
      <span className={cn("tabular text-xs", active ? "text-primary-foreground/80" : "text-muted-foreground")}>{count}</span>
    </button>
  );
}

function CustomerRow({ s }: { s: CustomerSummary }) {
  const t = useT();
  const c = t.customers;
  const { customer } = s;
  return (
    <li>
      <Link
        href={`/app/customers/${customer.id}`}
        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-muted/40 md:grid-cols-[minmax(0,2.2fr)_1fr_1fr_1.2fr_1.3fr]"
      >
        <span className="flex min-w-0 items-center gap-3">
          <Initial name={customer.name} status={s.status} />
          <CustomerName name={customer.name} nativeName={customer.nameNative} language={customer.language} />
          <LanguageTag language={customer.language} />
        </span>
        <Money amount={s.balance} className={cn("text-right font-semibold", s.balance === 0 && "text-muted-foreground")} />
        <span className="col-span-2 flex flex-wrap items-center gap-2 md:col-span-1">
          <StatusChip status={s.status} />
          <span className="text-xs text-muted-foreground md:hidden">
            {s.nextPromise ? `${format(parseISO(s.nextPromise.dueDate), "EEE d MMM")} · ` : ""}
            {s.lastCall ? <TimeAgo iso={s.lastCall.at} /> : c.neverCalled}
          </span>
        </span>
        <span className="hidden text-sm md:block">
          {s.nextPromise ? (
            <span className="flex flex-col">
              <Money amount={s.nextPromise.amount} />
              <span className="text-xs text-muted-foreground">{format(parseISO(s.nextPromise.dueDate), "EEE d MMM")}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">{c.noPromise}</span>
          )}
        </span>
        <span className="hidden min-w-0 items-center gap-2 text-sm md:flex">
          {s.lastCall ? (
            <>
              {s.lastCall.outcome && s.lastCall.status !== "no_answer" ? <OutcomeBadge outcome={s.lastCall.outcome} /> : <CallStatusPill status={s.lastCall.status} />}
              <TimeAgo iso={s.lastCall.at} className="truncate text-xs text-muted-foreground" />
            </>
          ) : (
            <span className="text-muted-foreground">{c.neverCalled}</span>
          )}
        </span>
      </Link>
    </li>
  );
}

const INITIAL_TONE: Record<CustomerStatus, string> = {
  due: "bg-due-soft text-due",
  overdue: "bg-overdue-soft text-overdue",
  promised: "bg-promised-soft text-promised",
  disputed: "bg-disputed-soft text-disputed",
  paid: "bg-paid-soft text-paid",
  opted_out: "bg-muted text-muted-foreground",
};

export function Initial({ name, status, className }: { name: string; status: CustomerStatus; className?: string }) {
  return (
    <span className={cn("grid size-9 shrink-0 place-items-center rounded-full font-heading text-sm font-bold", INITIAL_TONE[status], className)} aria-hidden>
      {name.charAt(0)}
    </span>
  );
}

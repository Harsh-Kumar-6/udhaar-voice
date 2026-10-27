"use client";

import { LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { attempt, useApiMutation, useSession } from "@/lib/api/hooks";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

/**
 * The round profile button with Profile and Sign out. `full` (desktop sidebar) also shows the name
 * and email next to the circle; the compact form sits in the mobile header.
 */
export function ProfileMenu({ full = false }: { full?: boolean }) {
  const t = useT();
  const router = useRouter();
  const session = useSession();
  const signOut = useApiMutation(() => api.signOut());
  const user = session.data?.user;
  const name = user?.name ?? "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t.profile.menu.label}
        className={cn(
          "flex items-center gap-2.5 rounded-full text-left outline-none focus-visible:ring-2 focus-visible:ring-ring",
          full && "min-w-0 flex-1 rounded-lg p-1.5 hover:bg-sidebar-accent/60",
        )}
      >
        <Avatar className="size-9 border">
          <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">{initials(name) || <UserRound className="size-4" />}</AvatarFallback>
        </Avatar>
        {full ? (
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-medium">{name || "…"}</span>
            <span className="truncate text-xs text-muted-foreground">{user?.email ?? user?.phone}</span>
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={full ? "start" : "end"} side={full ? "top" : "bottom"} className="w-56">
        {user ? (
          <>
            <DropdownMenuLabel className="flex flex-col">
              <span className="truncate">{name}</span>
              <span className="truncate text-xs font-normal text-muted-foreground">{user.email ?? user.phone}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem asChild>
          <Link href="/app/profile">
            <UserRound /> {t.profile.menu.profile}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={signOut.isPending}
          onSelect={async () => {
            if (!(await attempt(signOut.mutateAsync(undefined)))) return;
            toast.success(t.auth.signedOut);
            router.replace("/login");
          }}
        >
          <LogOut /> {t.auth.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

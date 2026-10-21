"use client";

import type { Core, ElementDefinition, StylesheetJson } from "cytoscape";
import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { ErrorBlock, LoadingBlock, Money, PageHeader } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import type { GraphData, GraphNode, GraphNodeType } from "@/lib/api/contract";
import { useGraph } from "@/lib/api/hooks";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const TOGGLEABLE: GraphNodeType[] = ["promise", "dispute", "note", "product"];

/**
 * Cytoscape can't parse oklch(), which our theme uses. Painting the colour on a 1×1 canvas
 * and reading the pixel back gives an rgb() value it understands.
 */
function cssVarToRgb(name: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx || !value) return "#888888";
  ctx.fillStyle = value;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `rgb(${r}, ${g}, ${b})`;
}

function palette() {
  const v = (n: string) => cssVarToRgb(`--${n}`);
  return {
    // Canvas text can't resolve CSS variables, so use the font list the page actually resolved.
    font: getComputedStyle(document.body).fontFamily || "sans-serif",
    fg: v("foreground"),
    muted: v("muted-foreground"),
    border: v("border"),
    card: v("card"),
    primary: v("primary"),
    onPrimary: v("primary-foreground"),
    due: v("due"),
    overdue: v("overdue"),
    promised: v("promised"),
    disputed: v("disputed"),
    paid: v("paid"),
    callback: v("callback"),
  };
}

function stylesheet(c: ReturnType<typeof palette>): StylesheetJson {
  const stateColor: Record<string, string> = {
    due: c.due,
    overdue: c.overdue,
    promised: c.promised,
    disputed: c.disputed,
    paid: c.paid,
    opted_out: c.muted,
    open: c.promised,
    kept: c.paid,
    broken: c.overdue,
  };
  return [
    {
      selector: "node",
      style: {
        label: "data(label)",
        color: c.fg,
        "font-size": 10,
        "font-family": c.font,
        "text-valign": "bottom",
        "text-margin-y": 4,
        "text-wrap": "ellipsis",
        "text-max-width": "120px",
        "background-color": c.muted,
        "border-width": 2,
        "border-color": c.card,
      },
    },
    { selector: "node[type = 'shop']", style: { "background-color": c.primary, width: 54, height: 54, "font-size": 12, "font-weight": "bold", shape: "round-rectangle" } },
    ...Object.entries(stateColor).map(([state, color]) => ({ selector: `node[state = '${state}']`, style: { "background-color": color } })),
    { selector: "node[type = 'customer']", style: { width: "mapData(amount, 0, 2400, 22, 50)", height: "mapData(amount, 0, 2400, 22, 50)", "font-size": 11 } },
    { selector: "node[type = 'promise']", style: { shape: "round-tag", width: 18, height: 18, "font-size": 9, color: c.muted } },
    { selector: "node[type = 'dispute']", style: { shape: "diamond", width: 22, height: 22, "background-color": c.disputed, "font-size": 9 } },
    { selector: "node[type = 'note']", style: { shape: "round-rectangle", width: 14, height: 14, "background-color": c.muted, "font-size": 8, color: c.muted } },
    { selector: "node[type = 'product']", style: { shape: "hexagon", width: "mapData(amount, 1, 5, 22, 36)", height: "mapData(amount, 1, 5, 22, 36)", "background-color": c.callback, "font-size": 10 } },
    { selector: "node:selected", style: { "border-color": c.fg, "border-width": 3 } },
    { selector: "edge", style: { width: 1.2, "line-color": c.border, "curve-style": "bezier", "target-arrow-shape": "none" } },
    { selector: "edge[kind = 'pays_through']", style: { "line-color": c.primary, width: 2, "line-style": "dashed", "target-arrow-shape": "triangle", "target-arrow-color": c.primary } },
    { selector: "edge[kind = 'owes']", style: { "line-color": c.border, opacity: 0.6 } },
  ];
}

export function GraphScreen() {
  const t = useT().graph;
  const q = useGraph();
  const [visible, setVisible] = useState<Set<GraphNodeType>>(new Set(TOGGLEABLE));
  const [hidePaid, setHidePaid] = useState(false);
  const [selected, setSelected] = useState<GraphNode | null>(null);

  return (
    <div className="space-y-5">
      <PageHeader title={t.title} description={t.description} />
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl border bg-card px-4 py-3">
        <span className="text-sm font-medium">{t.show}</span>
        {TOGGLEABLE.map((type) => (
          <label key={type} className="flex items-center gap-2 text-sm">
            <Switch
              id={`show-${type}`}
              checked={visible.has(type)}
              onCheckedChange={(on) =>
                setVisible((s) => {
                  const next = new Set(s);
                  if (on) next.add(type);
                  else next.delete(type);
                  return next;
                })
              }
            />
            {t.types[type]}
          </label>
        ))}
        <label className="flex items-center gap-2 text-sm">
          <Switch id="hide-paid" checked={hidePaid} onCheckedChange={setHidePaid} />
          {t.hidePaid}
        </label>
      </div>

      {q.isPending ? (
        <LoadingBlock />
      ) : q.isError ? (
        <ErrorBlock onRetry={() => q.refetch()} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <GraphCanvas data={q.data} visible={visible} hidePaid={hidePaid} onSelect={setSelected} />
          <div className="space-y-5">
            <Details node={selected} data={q.data} />
            <Legend />
          </div>
        </div>
      )}
    </div>
  );
}

function GraphCanvas({ data, visible, hidePaid, onSelect }: { data: GraphData; visible: Set<GraphNodeType>; hidePaid: boolean; onSelect: (n: GraphNode | null) => void }) {
  const t = useT().graph;
  const container = useRef<HTMLDivElement>(null);
  const cy = useRef<Core | null>(null);
  const { resolvedTheme } = useTheme();
  const [layoutTick, setLayoutTick] = useState(0);

  // Build the elements the current filters allow.
  const paid = new Set(data.nodes.filter((n) => n.type === "customer" && n.state === "paid").map((n) => n.id));
  const nodes = data.nodes.filter((n) => (n.type === "shop" || n.type === "customer" || visible.has(n.type)) && !(hidePaid && paid.has(n.id)));
  const ids = new Set(nodes.map((n) => n.id));
  const edges = data.edges.filter((e) => ids.has(e.source) && ids.has(e.target));
  const elements: ElementDefinition[] = [
    ...nodes.map((n) => ({ data: { ...n } })),
    ...edges.map((e) => ({ data: { id: e.id, source: e.source, target: e.target, kind: e.kind } })),
  ];
  const signature = elements.map((e) => e.data.id).join("|");

  useEffect(() => {
    let disposed = false;
    let instance: Core | null = null;
    void import("cytoscape").then(({ default: cytoscape }) => {
      if (disposed || !container.current) return;
      instance = cytoscape({
        container: container.current,
        elements,
        style: stylesheet(palette()),
        layout: { name: "cose", animate: false, padding: 24, nodeRepulsion: () => 9000, idealEdgeLength: () => 70 },
        wheelSensitivity: 0.25,
        minZoom: 0.3,
        maxZoom: 2.5,
      });
      instance.on("tap", "node", (e) => onSelect(e.target.data() as GraphNode));
      instance.on("tap", (e) => {
        if (e.target === instance) onSelect(null);
      });
      cy.current = instance;
    });
    return () => {
      disposed = true;
      instance?.destroy();
      cy.current = null;
    };
    // Rebuild only when the set of elements or the layout request changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, layoutTick]);

  // Recolour when the theme changes, without re-running the layout.
  useEffect(() => {
    const id = window.setTimeout(() => cy.current?.style(stylesheet(palette())), 50);
    return () => window.clearTimeout(id);
  }, [resolvedTheme]);

  return (
    <Card className="overflow-hidden p-0">
      <div className="relative">
        <div ref={container} className="h-[30rem] w-full bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:18px_18px] sm:h-[36rem]" />
        <Button variant="outline" size="sm" className="absolute top-3 right-3 bg-card" onClick={() => setLayoutTick((n) => n + 1)}>
          <RefreshCw /> {t.relayout}
        </Button>
      </div>
    </Card>
  );
}

function Details({ node, data }: { node: GraphNode | null; data: GraphData }) {
  const t = useT();
  const g = t.graph;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{g.details}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!node ? (
          <p className="text-muted-foreground">{g.pickNode}</p>
        ) : (
          <>
            <div>
              <div className="text-xs font-medium text-muted-foreground">{g.types[node.type]}</div>
              <div className="font-heading text-lg font-bold">{node.label}</div>
              {node.type === "customer" && node.detail ? <div className="text-muted-foreground">{node.detail}</div> : null}
            </div>
            {node.type === "customer" && node.amount !== undefined ? (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{g.owes}</span>
                <Money amount={node.amount} className="font-semibold" />
              </div>
            ) : null}
            {node.type === "product" && node.amount ? <p>{g.asked(node.amount)}</p> : null}
            {node.type !== "customer" && node.detail ? <p>{node.detail}</p> : null}
            <ConnectedCount node={node} data={data} />
            {node.customerId ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/app/customers/${node.customerId}`}>{g.openCustomer}</Link>
              </Button>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ConnectedCount({ node, data }: { node: GraphNode; data: GraphData }) {
  const g = useT().graph;
  const edges = data.edges.filter((e) => e.source === node.id || e.target === node.id);
  if (!edges.length) return null;
  const kinds = [...new Set(edges.map((e) => g.edgeKinds[e.kind]))];
  return <p className="text-xs text-muted-foreground">{edges.length} links: {kinds.join(", ")}</p>;
}

function Legend() {
  const t = useT();
  const items: [string, string][] = [
    [t.common.status.due, "bg-due"],
    [t.common.status.overdue, "bg-overdue"],
    [t.common.status.promised, "bg-promised"],
    [t.common.status.disputed, "bg-disputed"],
    [t.common.status.paid, "bg-paid"],
    [t.graph.types.product, "bg-callback"],
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t.graph.legend}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="grid grid-cols-2 gap-2 text-sm">
          {items.map(([label, tone]) => (
            <li key={label} className="flex items-center gap-2">
              <span className={cn("size-3 rounded-full", tone)} /> {label}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

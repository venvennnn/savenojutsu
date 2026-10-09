"use client";

import { useMemo, useState } from "react";
import { labelFor, TOPICS, CONTENT_TYPES } from "@/lib/taxonomy";
import { useSession } from "@/state/session";
import type { TopicId, ContentTypeId } from "@/lib/types";

interface Node {
  id: string;
  kind: "topic" | "creator" | "contentType";
  label: string;
  value: string;
  count: number;
  x: number;
  y: number;
}

export function InterestMap() {
  const { results, setMapFilter, analytics } = useSession();
  const [focus, setFocus] = useState<"top" | "all">("top");
  const classified = results.filter((r) => r.status === "classified" && r.labels);

  const { nodes, edges, table } = useMemo(() => {
    const topicCounts = new Map<string, number>();
    const creatorCounts = new Map<string, number>();
    const typeCounts = new Map<string, number>();
    const edgeMap = new Map<string, { from: string; to: string; n: number; fromKind: Node["kind"]; toKind: Node["kind"] }>();

    for (const r of classified) {
      const topic = r.labels!.topic.label;
      const type = r.labels!.contentType.label;
      topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
      typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
      if (r.creator) creatorCounts.set(r.creator, (creatorCounts.get(r.creator) ?? 0) + 1);
      const bump = (from: string, to: string, fromKind: Node["kind"], toKind: Node["kind"]) => {
        const key = `${from}->${to}`;
        const cur = edgeMap.get(key) ?? { from, to, n: 0, fromKind, toKind };
        cur.n += 1;
        edgeMap.set(key, cur);
      };
      if (r.creator) bump(`topic:${topic}`, `creator:${r.creator}`, "topic", "creator");
      bump(`topic:${topic}`, `type:${type}`, "topic", "contentType");
    }

    const limit = focus === "top" ? 8 : 16;
    const topics = [...topicCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
    const creators = [...creatorCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
    const types = [...typeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

    const nodes: Node[] = [
      ...topics.map(([id, count], i) => ({
        id: `topic:${id}`,
        kind: "topic" as const,
        label: labelFor(TOPICS, id as TopicId),
        value: id,
        count,
        x: 140,
        y: 40 + i * 48,
      })),
      ...types.map(([id, count], i) => ({
        id: `type:${id}`,
        kind: "contentType" as const,
        label: labelFor(CONTENT_TYPES, id as ContentTypeId),
        value: id,
        count,
        x: 500,
        y: 80 + i * 52,
      })),
      ...creators.map(([id, count], i) => ({
        id: `creator:${id}`,
        kind: "creator" as const,
        label: id,
        value: id,
        count,
        x: 860,
        y: 36 + i * 44,
      })),
    ];
    const allowed = new Set(nodes.map((n) => n.id));
    const edges = [...edgeMap.values()].filter((e) => allowed.has(e.from) && allowed.has(e.to));
    const table = edges
      .sort((a, b) => b.n - a.n)
      .slice(0, 50)
      .map((e) => ({
        from: nodes.find((n) => n.id === e.from)?.label ?? e.from,
        to: nodes.find((n) => n.id === e.to)?.label ?? e.to,
        n: e.n,
        fromValue: e.from,
        toValue: e.to,
      }));
    return { nodes, edges, table };
  }, [classified, focus]);

  if (!classified.length) {
    return (
      <p className="text-sm text-muted">
        The interest map needs classified captions. Items without usable text are not guessed.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <button type="button" className="rounded-full border border-line px-3 py-1" onClick={() => setFocus("top")}>
          Top nodes
        </button>
        <button type="button" className="rounded-full border border-line px-3 py-1" onClick={() => setFocus("all")}>
          Expand
        </button>
        <span className="text-muted">
          Green = topics · Orange = creators · Leaf = content type. Click a node to filter the library.
        </span>
      </div>
      <svg viewBox="0 0 1000 420" className="h-[420px] w-full rounded-2xl border border-line bg-cream" role="img" aria-label="Interest map">
        {edges.map((e) => {
          const a = nodes.find((n) => n.id === e.from);
          const b = nodes.find((n) => n.id === e.to);
          if (!a || !b) return null;
          return (
            <line
              key={`${e.from}-${e.to}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="#8BBF62"
              strokeOpacity="0.45"
              strokeWidth={1 + Math.min(7, e.n)}
            />
          );
        })}
        {nodes.map((n) => (
          <g
            key={n.id}
            className="cursor-pointer"
            onClick={() => setMapFilter({ kind: n.kind, value: n.value })}
          >
            <circle
              cx={n.x}
              cy={n.y}
              r={7 + Math.min(16, n.count)}
              fill={n.kind === "topic" ? "#234D3C" : n.kind === "creator" ? "#E78945" : "#8BBF62"}
            />
            <text
              x={n.kind === "creator" ? n.x - 18 : n.x + 18}
              y={n.y + 4}
              fontSize="11"
              fill="#202923"
              textAnchor={n.kind === "creator" ? "end" : "start"}
            >
              {n.label} ({n.count})
            </text>
          </g>
        ))}
      </svg>
      <h3 className="mt-6 font-serif text-lg text-forest">Accessible edge list</h3>
      <table className="mt-2 w-full text-left text-sm">
        <thead>
          <tr className="text-muted">
            <th className="py-2">From</th>
            <th>To</th>
            <th>Shared saves</th>
          </tr>
        </thead>
        <tbody>
          {table.map((row) => (
            <tr key={`${row.from}-${row.to}`} className="border-t border-line">
              <td className="py-2">{row.from}</td>
              <td>{row.to}</td>
              <td>{row.n}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {analytics?.mostCommonTopic ? (
        <p className="mt-4 text-sm text-muted">
          Scope: classified saves only ({classified.length} of {results.length} analyzed).
        </p>
      ) : null}
    </div>
  );
}

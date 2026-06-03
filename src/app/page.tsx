"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type ResourceItem = {
  title: string;
  source: string;
  url: string;
};

type LearningPath = {
  skills: string[];
  steps: string[];
  resources: ResourceItem[];
};

type FutureRole = {
  title: string;
  description: string;
  fit: "High Fit" | "Medium Fit";
  learningPath?: LearningPath;
};

type RoleConnection = {
  current: {
    title: string;
    department: string;
  };
  future: FutureRole;
};

type CurrentRoleNode = {
  id: string;
  label: string;
  type: "current";
  department: string;
};

type FutureRoleNode = {
  id: string;
  label: string;
  type: "future";
  description: string;
  fit: "High Fit" | "Medium Fit";
  learningPath?: LearningPath;
};

type RoleMapNode = CurrentRoleNode | FutureRoleNode;

type RoleMapEdge = {
  from: string;
  to: string;
};

type RoleMap = {
  nodes: RoleMapNode[];
  edges: RoleMapEdge[];
};

type ApiResponse = {
  answer?: string;
  companyId?: string;
  companyName?: string;
  reportUrl?: string;
  roleConnections?: RoleConnection[];
  roleMap?: RoleMap;
  source?: "live" | "mock";
  error?: string;
  needsFollowUp?: boolean;
  followUpQuestion?: string;
};

type AnswerBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "ordered"; items: string[] }
  | { type: "unordered"; items: string[] };

type ChipValue = {
  value: string;
  tentative: boolean;
};

type CareerContext = {
  current_role?: ChipValue;
  company?: ChipValue;
  intent?: ChipValue;
};

type CareerContextKey = keyof CareerContext;

type EditableChipProps = {
  chipKey: CareerContextKey;
  label: string;
  chip: ChipValue;
  editingKey: CareerContextKey | null;
  editingValue: string;
  accentClass: string;
  onStartEdit: (key: CareerContextKey, value: string) => void;
  onChangeValue: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onRemove: (key: CareerContextKey) => void;
};

type CareerTemplateValues = {
  currentRole: string;
  goal: string;
  company: string;
  pathA: string;
  pathB: string;
  priority: string;
  strength: string;
  constraint: string;
};

const knownCompanies = ["Figma", "Accenture", "McKinsey", "Goldman Sachs", "Deloitte", "Infosys", "Tata 1MG"];
const roleMatchers: Array<{ label: string; matcher: RegExp; tentative?: boolean }> = [
  { label: "UX Researcher", matcher: /\bux researcher\b/i },
  { label: "Design Leader", matcher: /\bdesign leader\b/i },
  { label: "Product Manager", matcher: /\bproduct manager\b/i },
  { label: "Product Manager", matcher: /\bi'?m a pm\b|\bpm\b/i, tentative: true },
  { label: "Designer", matcher: /\bdesigner\b/i, tentative: true },
  { label: "Researcher", matcher: /\bresearcher\b/i, tentative: true },
  { label: "Engineer", matcher: /\bengineer\b/i, tentative: true },
];
const careerIntentMatchers: Array<{ label: string; matcher: RegExp; tentative?: boolean }> = [
  { label: "Growth path", matcher: /career paths?|grow|what'?s next|where can/i },
  { label: "Best-fit roles", matcher: /fit me|best fit|what roles/i },
  { label: "Non-engineering options", matcher: /non-engineering|don'?t want to become an engineer/i },
  { label: "Skills to build", matcher: /skills|build next|learn/i, tentative: true },
  { label: "Company role trends", matcher: /building toward|company building/i },
];
const fallbackConnections: RoleConnection[] = [
  {
    current: { title: "Design Leader", department: "Design" },
    future: {
      title: "AI Experience Strategy Lead",
      description: "Shapes human-centered AI workflows without requiring a move into engineering.",
      fit: "High Fit",
      learningPath: {
        skills: ["Workflow design", "Prompt systems", "Evaluation frameworks"],
        steps: [
          "Document the decisions in your current role that still need strong human judgment.",
          "Prototype one AI-assisted workflow with clear review gates and escalation points.",
          "Build a rubric for quality, trust, and time saved before scaling the new motion.",
        ],
        resources: [
          {
            title: "AI Workflow Design Fundamentals",
            source: "EvolutionOS Library",
            url: "https://orgos-supriya.vercel.app/",
          },
        ],
      },
    },
  },
  {
    current: { title: "Product Manager", department: "Product" },
    future: {
      title: "AI Product Operations Partner",
      description: "Turns product strategy into systems, rituals, and AI-enabled execution patterns.",
      fit: "Medium Fit",
      learningPath: {
        skills: ["Decision ops", "Experiment design", "Cross-functional orchestration"],
        steps: [
          "Identify one recurring coordination bottleneck that AI can help structure but not own.",
          "Create a weekly insight loop that translates product signals into leadership actions.",
          "Define ownership rules for where AI assists, where humans approve, and where agents escalate.",
        ],
        resources: [
          {
            title: "AI Product Operating Model",
            source: "EvolutionOS Library",
            url: "https://orgos-supriya.vercel.app/",
          },
        ],
      },
    },
  },
  {
    current: { title: "UX Researcher", department: "Research" },
    future: {
      title: "AI Insight Translator",
      description: "Converts behavior signals and qualitative evidence into decision-ready guidance.",
      fit: "High Fit",
      learningPath: {
        skills: ["Insight synthesis", "Narrative framing", "Signal clustering"],
        steps: [
          "Turn your current research outputs into a reusable operating brief for product and leadership teams.",
          "Pair AI-assisted clustering with researcher-led recommendation writing on one live project.",
          "Build a repeatable template for communicating confidence, tradeoffs, and action priority.",
        ],
        resources: [
          {
            title: "Decision Storytelling for AI Teams",
            source: "EvolutionOS Library",
            url: "https://orgos-supriya.vercel.app/",
          },
        ],
      },
    },
  },
];
const departmentBorderColors: Record<string, string> = {
  Design: "#B85C2C",
  Engineering: "#2D6A4F",
  Growth: "#92400E",
  Research: "#5B21B6",
  Product: "#B85C2C",
  Default: "#6B6660",
};

function normalizeLookup(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function detectCompany(message: string): ChipValue | undefined {
  const normalized = normalizeLookup(message);
  if (!normalized) {
    return undefined;
  }

  for (const company of knownCompanies) {
    const normalizedCompany = normalizeLookup(company);
    const exactPattern = new RegExp(`(^|\\b)${normalizedCompany.replace(/\s+/g, "\\s+")}(\\b|$)`, "i");
    if (exactPattern.test(message)) {
      return { value: company, tentative: false };
    }
    if (normalized.includes(normalizedCompany)) {
      return { value: company, tentative: true };
    }
  }

  return undefined;
}

function detectRole(message: string): ChipValue | undefined {
  for (const role of roleMatchers) {
    if (role.matcher.test(message)) {
      return { value: role.label, tentative: !!role.tentative };
    }
  }

  const match = message.match(/career paths for ([a-z][a-z\s]+)/i);
  if (match) {
    return { value: match[1].trim().replace(/\b\w/g, (letter) => letter.toUpperCase()), tentative: true };
  }

  return undefined;
}

function detectCareerIntent(message: string): ChipValue | undefined {
  for (const intent of careerIntentMatchers) {
    if (intent.matcher.test(message)) {
      return { value: intent.label, tentative: !!intent.tentative };
    }
  }

  return undefined;
}

function extractCareerContext(message: string): CareerContext {
  return {
    current_role: detectRole(message),
    company: detectCompany(message),
    intent: detectCareerIntent(message),
  };
}

function serializeContext(context: CareerContext) {
  return {
    ...(context.current_role?.value ? { current_role: context.current_role.value } : {}),
    ...(context.company?.value ? { company: context.company.value } : {}),
    ...(context.intent?.value ? { intent: context.intent.value } : {}),
  };
}

function cleanAnswerText(answer: string) {
  return answer
    .split("\n")
    .map((line) => line.replace(/\*\*(.*?)\*\*/g, "$1").trimEnd())
    .filter((line) => !/^ROUTE:/i.test(line.trim()))
    .join("\n")
    .trim();
}

function parseIntent(answer: string) {
  const firstLine = answer.split("\n").map((line) => line.trim()).find(Boolean);
  if (!firstLine) {
    return { intent: undefined, body: answer };
  }

  const match = firstLine.match(/^Intent:\s*(.+)$/i);
  if (!match) {
    return { intent: undefined, body: answer };
  }

  return {
    intent: match[1].trim(),
    body: answer.replace(firstLine, "").trim(),
  };
}

function parseAnswerBlocks(answer: string): { intent?: string; blocks: AnswerBlock[] } {
  const { intent, body } = parseIntent(answer);
  const lines = body.split("\n").map((line) => line.trim());
  const blocks: AnswerBlock[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) {
      continue;
    }

    if (/^[A-Z][A-Z\s/&-]+:$/.test(line)) {
      blocks.push({ type: "heading", text: line.slice(0, -1) });
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      let cursor = index;
      while (cursor < lines.length && /^\d+\.\s+/.test(lines[cursor])) {
        items.push(lines[cursor].replace(/^\d+\.\s+/, ""));
        cursor += 1;
      }
      blocks.push({ type: "ordered", items });
      index = cursor - 1;
      continue;
    }

    if (/^[-•]\s+/.test(line)) {
      const items: string[] = [];
      let cursor = index;
      while (cursor < lines.length && /^[-•]\s+/.test(lines[cursor])) {
        items.push(lines[cursor].replace(/^[-•]\s+/, ""));
        cursor += 1;
      }
      blocks.push({ type: "unordered", items });
      index = cursor - 1;
      continue;
    }

    const paragraphLines = [line];
    let cursor = index + 1;
    while (
      cursor < lines.length &&
      lines[cursor] &&
      !/^[A-Z][A-Z\s/&-]+:$/.test(lines[cursor]) &&
      !/^\d+\.\s+/.test(lines[cursor]) &&
      !/^[-•]\s+/.test(lines[cursor])
    ) {
      paragraphLines.push(lines[cursor]);
      cursor += 1;
    }

    blocks.push({ type: "paragraph", text: paragraphLines.join(" ") });
    index = cursor - 1;
  }

  return { intent, blocks };
}

function parseRoleConnections(answer: string): RoleConnection[] {
  const lines = answer
    .split("\n")
    .map((line) => line.replace(/->/g, " -> ").trim())
    .filter(Boolean);

  const parsed = lines.flatMap((line) => {
    if (!line.includes("->")) {
      return [];
    }

    const [left, right] = line.split("->");
    if (!left || !right) {
      return [];
    }

    const currentTitle = left.replace(/^current role:?/i, "").trim();
    const pieces = right.split("|").map((piece) => piece.trim()).filter(Boolean);
    const futureTitle = pieces[0] || right.trim();
    const fit: FutureRole["fit"] = /high fit/i.test(pieces[1] || "") ? "High Fit" : "Medium Fit";
    const description = pieces[2] || "Full learning path available in your CareerOS report.";

    return [
      {
        current: {
          title: currentTitle,
          department: currentTitle.toLowerCase().includes("research")
            ? "Research"
            : currentTitle.toLowerCase().includes("design")
              ? "Design"
              : currentTitle.toLowerCase().includes("product") || currentTitle.toLowerCase().includes("pm")
                ? "Product"
                : "Default",
        },
        future: {
          title: futureTitle,
          fit,
          description,
          learningPath: fallbackConnections.find((connection) => connection.future.title === futureTitle)?.future.learningPath,
        },
      },
    ];
  });

  if (parsed.length > 0) {
    return parsed;
  }

  if (/(career path|future path|what's next|what comes next|->)/i.test(answer)) {
    return fallbackConnections;
  }

  return [];
}

function buildRoleMap(connections: RoleConnection[]): RoleMap {
  const currentNodes: CurrentRoleNode[] = [];
  const futureNodes: FutureRoleNode[] = [];
  const edges: RoleMapEdge[] = [];
  const currentNodeIds = new Map<string, string>();
  const futureNodeIds = new Map<string, string>();

  connections.forEach((connection) => {
    const currentKey = `${connection.current.title}::${connection.current.department}`;
    let currentId = currentNodeIds.get(currentKey);
    if (!currentId) {
      currentId = `current-${currentNodeIds.size + 1}`;
      currentNodeIds.set(currentKey, currentId);
      currentNodes.push({
        id: currentId,
        label: connection.current.title,
        type: "current",
        department: connection.current.department,
      });
    }

    const futureKey = connection.future.title;
    let futureId = futureNodeIds.get(futureKey);
    if (!futureId) {
      futureId = `future-${futureNodeIds.size + 1}`;
      futureNodeIds.set(futureKey, futureId);
      futureNodes.push({
        id: futureId,
        label: connection.future.title,
        type: "future",
        description: connection.future.description,
        fit: connection.future.fit,
        learningPath: connection.future.learningPath,
      });
    }

    if (!edges.some((edge) => edge.from === currentId && edge.to === futureId)) {
      edges.push({ from: currentId, to: futureId });
    }
  });

  return { nodes: [...currentNodes, ...futureNodes], edges };
}

function getCurrentNodes(roleMap: RoleMap) {
  return roleMap.nodes.filter((node): node is CurrentRoleNode => node.type === "current");
}

function getFutureNodes(roleMap: RoleMap) {
  return roleMap.nodes.filter((node): node is FutureRoleNode => node.type === "future");
}

function getSelectedFutureRole(roleMap: RoleMap, selectedRoleId: string | null) {
  if (!selectedRoleId) {
    return null;
  }

  return getFutureNodes(roleMap).find((node) => node.id === selectedRoleId) || null;
}

function AnswerContent({ answer }: { answer: string }) {
  const { intent, blocks } = useMemo(() => parseAnswerBlocks(cleanAnswerText(answer)), [answer]);

  return (
    <div>
      {intent ? (
        <span className="mb-4 inline-block rounded-full bg-[rgba(184,92,44,0.08)] px-2.5 py-1 text-[12px] font-medium text-primary">
          {intent}
        </span>
      ) : null}

      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return (
            <h3 key={`${block.type}-${index}`} className="font-display mt-6 mb-2 text-[18px] text-text first:mt-0">
              {block.text}
            </h3>
          );
        }

        if (block.type === "ordered") {
          return (
            <ol key={`${block.type}-${index}`} className="mb-4 grid gap-3 p-0 md:grid-cols-2">
              {block.items.map((item, itemIndex) => (
                <li key={item} className="rounded-[10px] border border-border bg-[rgba(184,92,44,0.04)] px-4 py-3 text-[15px] leading-7 text-text">
                  <span className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[12px] font-semibold text-white">
                    {itemIndex + 1}
                  </span>
                  <div>{item}</div>
                </li>
              ))}
            </ol>
          );
        }

        if (block.type === "unordered") {
          return (
            <ul key={`${block.type}-${index}`} className="mb-4 list-none p-0">
              {block.items.map((item) => (
                <li key={item} className="mb-2.5 rounded-[10px] border border-border px-4 py-3 text-[15px] leading-7 text-text last:mb-0">
                  <span className="mr-2.5 inline-block h-2 w-2 rounded-full bg-primary align-middle" />
                  <span className="align-middle">{item}</span>
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={`${block.type}-${index}`} className="mb-4 text-[15px] leading-7 text-text last:mb-0">
            {block.text}
          </p>
        );
      })}
    </div>
  );
}

function EditableChip({
  chipKey,
  label,
  chip,
  editingKey,
  editingValue,
  accentClass,
  onStartEdit,
  onChangeValue,
  onSave,
  onCancel,
  onRemove,
}: EditableChipProps) {
  if (editingKey === chipKey) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-full border border-border bg-surface px-3 py-2">
        <span className="text-[12px] font-medium text-muted">{label}</span>
        <input
          autoFocus
          value={editingValue}
          onChange={(event) => onChangeValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onSave();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              onCancel();
            }
          }}
          className="min-w-[140px] bg-transparent text-[13px] text-text outline-none"
        />
        <button type="button" onClick={onSave} className="text-[12px] font-medium text-primary">
          Save
        </button>
        <button type="button" onClick={onCancel} className="text-[12px] text-muted">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 ${accentClass}`}>
      <button type="button" onClick={() => onStartEdit(chipKey, chip.value)} className="flex items-center gap-2 text-left">
        <span className="text-[12px] font-medium text-muted">{label}</span>
        <span className="text-[13px] font-medium text-text">{chip.value}{chip.tentative ? "?" : ""}</span>
      </button>
      <button type="button" onClick={() => onRemove(chipKey)} className="text-[12px] text-muted transition hover:text-primary">
        x
      </button>
    </div>
  );
}

function LearningPathPanel({ role, onClose }: { role: FutureRoleNode; onClose: () => void }) {
  return (
    <section className="fade-in mt-6 overflow-hidden rounded-[6px] border border-border border-t-[3px] border-t-primary bg-surface px-8 py-7 shadow-[0_1px_3px_rgba(28,25,23,0.08)]">
      <div className="mb-6 flex items-start justify-between gap-4">
        <h3 className="font-display text-[22px] text-text">Your path to {role.label}</h3>
        <button type="button" onClick={onClose} className="text-[20px] text-muted transition hover:text-primary">
          x
        </button>
      </div>

      {role.learningPath ? (
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <p className="mb-3 text-[11px] uppercase tracking-[0.1em] text-muted">Skills to build</p>
            <div>
              {role.learningPath.skills.map((skill) => (
                <span
                  key={skill}
                  className="mr-1 mt-1 inline-block rounded-full border border-primary bg-[rgba(184,92,44,0.04)] px-3 py-1.5 text-[13px] text-primary"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-3 text-[11px] uppercase tracking-[0.1em] text-muted">Where to begin</p>
            <div>
              {role.learningPath.steps.map((step, index) => (
                <div key={step} className="mb-3.5 flex items-start gap-3 last:mb-0">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[12px] font-semibold text-white">
                    {index + 1}
                  </span>
                  <p className="text-[14px] leading-6 text-text">{step}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.1em] text-muted">
              <span className="inline-block h-2 w-2 rounded-full bg-accent" />
              Learn now
            </p>
            <div>
              {role.learningPath.resources.map((resource) => (
                <article key={resource.title} className="mb-2 rounded-[6px] border border-border px-3.5 py-3 last:mb-0">
                  <p className="text-[14px] font-medium text-text">{resource.title}</p>
                  <p className="mt-0.5 text-[12px] text-muted">{resource.source}</p>
                  <a href={resource.url} target="_blank" rel="noreferrer" className="mt-1.5 block text-[13px] text-primary hover:underline">
                    {"Open ->"}
                  </a>
                </article>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <p className="text-[14px] italic text-muted">Full learning path available in your CareerOS report.</p>
      )}
    </section>
  );
}

function CareerEvolutionMap({
  roleMap,
  selectedRoleId,
  onSelectRole,
}: {
  roleMap: RoleMap;
  selectedRoleId: string | null;
  onSelectRole: (roleId: string) => void;
}) {
  const currentNodes = getCurrentNodes(roleMap);
  const futureNodes = getFutureNodes(roleMap);
  const rowCount = Math.max(currentNodes.length, futureNodes.length, 1);
  const svgHeight = Math.max(rowCount * 88 + 20, 120);
  const currentY = new Map(currentNodes.map((node, index) => [node.id, 34 + index * 88]));
  const futureY = new Map(futureNodes.map((node, index) => [node.id, 34 + index * 88]));

  return (
    <section className="mt-12">
      <h2 className="font-display mb-2 text-[24px] text-text">Your Career Evolution Map</h2>
      <p className="mb-8 text-[14px] text-muted">Where your strengths can take you</p>

      <div className="grid grid-cols-[1fr_80px_1fr] gap-0 max-md:grid-cols-1 max-md:gap-4">
        <div>
          {currentNodes.map((node) => {
            const borderColor = departmentBorderColors[node.department] || departmentBorderColors.Default;
            return (
              <article
                key={node.id}
                className="mb-3 rounded-[6px] border border-border bg-surface px-4 py-3 shadow-[0_1px_3px_rgba(28,25,23,0.08)]"
                style={{ borderLeft: `3px solid ${borderColor}` }}
              >
                <p className="text-[14px] font-semibold text-text">{node.label}</p>
                <p className="mt-0.5 text-[12px] text-muted">{node.department}</p>
              </article>
            );
          })}
        </div>

        <div className="flex items-stretch justify-center max-md:hidden">
          <svg width="80" height={svgHeight} viewBox={`0 0 80 ${svgHeight}`} fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <marker id="careeros-arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
                <path d="M0,0 L0,6 L9,3 z" fill="var(--color-primary)" />
              </marker>
            </defs>
            {roleMap.edges.map((edge, index) => {
              const startY = currentY.get(edge.from);
              const endY = futureY.get(edge.to);
              if (!startY || !endY) {
                return null;
              }

              return (
                <path
                  key={`${edge.from}-${edge.to}`}
                  className="role-line"
                  d={`M8 ${startY} C 28 ${startY}, 52 ${endY}, 72 ${endY}`}
                  stroke="var(--color-primary)"
                  strokeWidth="1.5"
                  opacity="0.4"
                  markerEnd="url(#careeros-arrow)"
                  style={{ animationDelay: `${index * 120}ms` }}
                />
              );
            })}
          </svg>
        </div>

        <div>
          {futureNodes.map((node) => {
            const active = selectedRoleId === node.id;
            return (
              <button
                key={node.id}
                type="button"
                onClick={() => onSelectRole(node.id)}
                className={`mb-3 w-full rounded-[6px] bg-primary px-4 py-3 text-left text-white shadow-[0_1px_3px_rgba(28,25,23,0.08)] transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-[0_4px_12px_rgba(184,92,44,0.25)] ${active ? "ring-2 ring-[rgba(255,255,255,0.45)]" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[14px] font-semibold text-white">{node.label}</p>
                    <p className="mt-0.5 text-[12px] text-white/80">{node.description}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] text-white ${node.fit === "High Fit" ? "bg-white/20" : "bg-white/12"}`}>
                    {node.fit}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const resizeFrameRef = useRef<number | null>(null);
  const debounceRef = useRef<number | null>(null);
  const [userId, setUserId] = useState("");
  const [message, setMessage] = useState("");
  const [context, setContext] = useState<CareerContext>({});
  const [answer, setAnswer] = useState("");
  const [reportUrl, setReportUrl] = useState("");
  const [source, setSource] = useState<"live" | "mock" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [roleMap, setRoleMap] = useState<RoleMap | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [activeCompanyName, setActiveCompanyName] = useState("");
  const [editingKey, setEditingKey] = useState<CareerContextKey | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [needsFollowUp, setNeedsFollowUp] = useState(false);
  const [followUpQuestion, setFollowUpQuestion] = useState("");
  const [templateValues, setTemplateValues] = useState<CareerTemplateValues>({
    currentRole: "UX Researcher",
    goal: "stay close to product decisions",
    company: "Figma",
    pathA: "AI strategy",
    pathB: "product insights",
    priority: "judgment and growth",
    strength: "research synthesis",
    constraint: "becoming an engineer",
  });

  const derivedRoleMap = useMemo(() => {
    if (roleMap) {
      return roleMap;
    }

    return buildRoleMap(parseRoleConnections(answer));
  }, [answer, roleMap]);
  const selectedRole = getSelectedFutureRole(derivedRoleMap, selectedRoleId);
  const futureNodes = getFutureNodes(derivedRoleMap);

  useEffect(() => {
    let id = window.localStorage.getItem("evo_user_id");
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem("evo_user_id", id);
    }
    setUserId(id);
  }, []);

  useEffect(() => {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
    }

    debounceRef.current = window.setTimeout(() => {
      setContext(extractCareerContext(message));
    }, 220);

    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, [message]);

  function scheduleTextareaResize(element: HTMLTextAreaElement) {
    if (resizeFrameRef.current !== null) {
      cancelAnimationFrame(resizeFrameRef.current);
    }

    resizeFrameRef.current = requestAnimationFrame(() => {
      element.style.height = "auto";
      element.style.height = `${Math.max(element.scrollHeight, 140)}px`;
      resizeFrameRef.current = null;
    });
  }

  function handleSuggestionClick(chip: string) {
    setMessage(chip);
    setNeedsFollowUp(false);
    setFollowUpQuestion("");
    setError("");
    if (textareaRef.current) {
      textareaRef.current.value = chip;
      scheduleTextareaResize(textareaRef.current);
    }
  }

  function applyTemplate(prompt: string) {
    setMessage(prompt);
    setContext(extractCareerContext(prompt));
    setNeedsFollowUp(false);
    setFollowUpQuestion("");
    setError("");
    if (textareaRef.current) {
      textareaRef.current.value = prompt;
      scheduleTextareaResize(textareaRef.current);
    }
  }

  function handleStartEdit(key: CareerContextKey, value: string) {
    setEditingKey(key);
    setEditingValue(value);
  }

  function handleSaveEdit() {
    if (!editingKey) {
      return;
    }

    const nextValue = editingValue.trim();
    setContext((current) => {
      const nextContext = { ...current };
      if (!nextValue) {
        delete nextContext[editingKey];
      } else {
        nextContext[editingKey] = { value: nextValue, tentative: false };
      }
      return nextContext;
    });
    setEditingKey(null);
    setEditingValue("");
  }

  function handleRemoveChip(key: CareerContextKey) {
    setContext((current) => {
      const nextContext = { ...current };
      delete nextContext[key];
      return nextContext;
    });
    if (editingKey === key) {
      setEditingKey(null);
      setEditingValue("");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!message.trim() || loading) {
      return;
    }

    setLoading(true);
    setError("");
    setNeedsFollowUp(false);
    setFollowUpQuestion("");
    setActiveCompanyName(context.company?.value || "this company");

    try {
      const response = await fetch("/api/careeros", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          mode: "career",
          user_id: userId,
          context: serializeContext(context),
        }),
      });

      const data = (await response.json()) as ApiResponse;
      if (!response.ok) {
        throw new Error(data.error || "Unable to reach CareerOS.");
      }

      const nextAnswer = (data.answer || "").trim();
      const nextRoleMap = data.roleMap || buildRoleMap(data.roleConnections?.length ? data.roleConnections : parseRoleConnections(nextAnswer));
      const nextFutureNodes = getFutureNodes(nextRoleMap);
      const nextSelectedRoleId = nextFutureNodes.find((node) => node.learningPath)?.id || nextFutureNodes[0]?.id || null;

      setAnswer(nextAnswer);
      setReportUrl(data.reportUrl || "");
      setSource(data.source || "live");
      setNeedsFollowUp(Boolean(data.needsFollowUp));
      setFollowUpQuestion(data.followUpQuestion || "");
      setRoleMap(nextRoleMap);
      setSelectedRoleId(nextSelectedRoleId);
    } catch (submitError) {
      const nextMessage = submitError instanceof Error ? submitError.message : "Something went wrong.";
      setError(nextMessage);
      setAnswer("");
      setReportUrl("");
      setSource(null);
      setRoleMap(null);
      setSelectedRoleId(null);
      setNeedsFollowUp(false);
      setFollowUpQuestion("");
    } finally {
      setLoading(false);
    }
  }

  const chips: Array<{ key: CareerContextKey; label: string; chip?: ChipValue; accentClass: string }> = [
    { key: "current_role", label: "Role", chip: context.current_role, accentClass: "border-[rgba(184,92,44,0.18)] bg-[rgba(184,92,44,0.05)]" },
    { key: "company", label: "Company", chip: context.company, accentClass: "border-border bg-surface" },
    { key: "intent", label: "Intent", chip: context.intent, accentClass: "border-border bg-surface" },
  ];

  return (
    <main className="bg-bg text-text">
      <nav className="h-14 border-b border-border bg-surface">
        <div className="mx-auto flex h-full max-w-[860px] items-center justify-between px-6">
          <span className="font-display text-[20px] text-primary">CareerOS</span>
          <a href="https://orgos-supriya.vercel.app/" target="_blank" rel="noreferrer" className="text-[14px] text-muted transition hover:text-primary">
            {"<- OrgOS"}
          </a>
        </div>
      </nav>

      <div className="mx-auto max-w-[860px] px-6 pb-16">
        <section className="pb-12 pt-16">
          <p className="mb-3 text-[11px] uppercase tracking-[0.12em] text-muted">CAREEROS - CAREER INTELLIGENCE</p>
          <h1 className="font-display max-w-[680px] text-[48px] leading-[1.15] text-text max-md:text-[40px]">
            Find where you belong
            <br />
            in <span className="text-primary">what comes next.</span>
          </h1>
          <p className="mt-5 max-w-[520px] text-[17px] leading-[1.7] text-muted">
            Map your strengths to the roles organizations are actually building. No fear. Just a clear path forward.
          </p>

          <form onSubmit={handleSubmit} className="mt-10">
            <div>
              <label htmlFor="message" className="mb-2 block text-[13px] text-muted">
                Describe where you are and where you want to go
              </label>
              <textarea
                id="message"
                ref={textareaRef}
                value={message}
                onChange={(event) => {
                  setMessage(event.target.value);
                  setNeedsFollowUp(false);
                  setFollowUpQuestion("");
                  setError("");
                  scheduleTextareaResize(event.target);
                }}
                placeholder="e.g. Where can a UX researcher grow at Figma? I'm a PM. What's next for me in AI-era teams? I don't want to become an engineer. What roles fit me at Accenture?"
                className="min-h-[140px] w-full resize-none rounded-[12px] border border-border bg-surface px-5 py-4 text-[16px] text-text outline-none transition focus:border-primary focus:shadow-[0_0_0_3px_rgba(184,92,44,0.1)]"
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {chips.some((item) => item.chip) ? <p className="w-full text-[12px] uppercase tracking-[0.08em] text-muted">Detected context</p> : null}
              {chips.map((item) =>
                item.chip ? (
                  <EditableChip
                    key={item.key}
                    chipKey={item.key}
                    label={item.label}
                    chip={item.chip}
                    editingKey={editingKey}
                    editingValue={editingValue}
                    accentClass={item.accentClass}
                    onStartEdit={handleStartEdit}
                    onChangeValue={setEditingValue}
                    onSave={handleSaveEdit}
                    onCancel={() => {
                      setEditingKey(null);
                      setEditingValue("");
                    }}
                    onRemove={handleRemoveChip}
                  />
                ) : null,
              )}
            </div>

            <div className="mt-5">
              <p className="mb-3 text-[12px] uppercase tracking-[0.08em] text-muted">Try a fill-in-the-blank prompt</p>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-[12px] border border-border bg-surface p-4">
                  <p className="mb-3 text-[13px] font-medium text-text">Best-fit path</p>
                  <div className="space-y-2 text-[13px] leading-6 text-muted">
                    <span>I am a</span>
                    <input
                      value={templateValues.currentRole}
                      onChange={(event) => setTemplateValues((current) => ({ ...current, currentRole: event.target.value }))}
                      className="w-full rounded-[8px] border border-border bg-bg px-3 py-2 text-text outline-none"
                    />
                    <span>who wants to</span>
                    <input
                      value={templateValues.goal}
                      onChange={(event) => setTemplateValues((current) => ({ ...current, goal: event.target.value }))}
                      className="w-full rounded-[8px] border border-border bg-bg px-3 py-2 text-text outline-none"
                    />
                    <span>What paths fit me at</span>
                    <input
                      value={templateValues.company}
                      onChange={(event) => setTemplateValues((current) => ({ ...current, company: event.target.value }))}
                      className="w-full rounded-[8px] border border-border bg-bg px-3 py-2 text-text outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      applyTemplate(`I am a ${templateValues.currentRole} who wants to ${templateValues.goal}. What paths fit me at ${templateValues.company}?`)
                    }
                    className="mt-4 text-[13px] font-medium text-primary"
                  >
                    Use template
                  </button>
                </div>

                <div className="rounded-[12px] border border-border bg-surface p-4">
                  <p className="mb-3 text-[13px] font-medium text-text">Compare directions</p>
                  <div className="space-y-2 text-[13px] leading-6 text-muted">
                    <span>At</span>
                    <input
                      value={templateValues.company}
                      onChange={(event) => setTemplateValues((current) => ({ ...current, company: event.target.value }))}
                      className="w-full rounded-[8px] border border-border bg-bg px-3 py-2 text-text outline-none"
                    />
                    <span>should I move toward</span>
                    <input
                      value={templateValues.pathA}
                      onChange={(event) => setTemplateValues((current) => ({ ...current, pathA: event.target.value }))}
                      className="w-full rounded-[8px] border border-border bg-bg px-3 py-2 text-text outline-none"
                    />
                    <span>or</span>
                    <input
                      value={templateValues.pathB}
                      onChange={(event) => setTemplateValues((current) => ({ ...current, pathB: event.target.value }))}
                      className="w-full rounded-[8px] border border-border bg-bg px-3 py-2 text-text outline-none"
                    />
                    <span>if I care about</span>
                    <input
                      value={templateValues.priority}
                      onChange={(event) => setTemplateValues((current) => ({ ...current, priority: event.target.value }))}
                      className="w-full rounded-[8px] border border-border bg-bg px-3 py-2 text-text outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      applyTemplate(
                        `At ${templateValues.company}, should I move toward ${templateValues.pathA} or ${templateValues.pathB} if I care about ${templateValues.priority}?`,
                      )
                    }
                    className="mt-4 text-[13px] font-medium text-primary"
                  >
                    Use template
                  </button>
                </div>

                <div className="rounded-[12px] border border-border bg-surface p-4">
                  <p className="mb-3 text-[13px] font-medium text-text">Constraint-aware path</p>
                  <div className="space-y-2 text-[13px] leading-6 text-muted">
                    <span>I enjoy</span>
                    <input
                      value={templateValues.strength}
                      onChange={(event) => setTemplateValues((current) => ({ ...current, strength: event.target.value }))}
                      className="w-full rounded-[8px] border border-border bg-bg px-3 py-2 text-text outline-none"
                    />
                    <span>and want to avoid</span>
                    <input
                      value={templateValues.constraint}
                      onChange={(event) => setTemplateValues((current) => ({ ...current, constraint: event.target.value }))}
                      className="w-full rounded-[8px] border border-border bg-bg px-3 py-2 text-text outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => applyTemplate(`I enjoy ${templateValues.strength} and want to avoid ${templateValues.constraint}. What should I aim for?`)}
                    className="mt-4 text-[13px] font-medium text-primary"
                  >
                    Use template
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-5 inline-flex rounded-[6px] border-none bg-primary px-7 py-3 text-[15px] font-medium text-white transition duration-150 ease-out hover:-translate-y-px hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70"
            >
              Map My Path
            </button>
          </form>

          {error ? <p className="mt-4 text-[14px] text-primary">{error}</p> : null}

          {loading ? (
            <section className="fade-in mt-8 rounded-[6px] border border-border border-l-[3px] border-l-primary bg-surface px-8 py-7 shadow-[0_1px_3px_rgba(28,25,23,0.08)]">
              <div className="mb-3 flex items-center gap-1.5">
                {[0, 1, 2].map((dot) => (
                  <span
                    key={dot}
                    className="loading-dot inline-block h-2 w-2 rounded-full bg-primary"
                    style={{ animationDelay: `${dot * 400}ms` }}
                  />
                ))}
              </div>
              <p className="text-[14px] italic text-muted">CareerOS is mapping your path{activeCompanyName && activeCompanyName !== "this company" ? ` for ${activeCompanyName}` : ""}...</p>
            </section>
          ) : null}

          {!loading && answer ? (
            <section className="fade-in mt-8 rounded-[6px] border border-border border-l-[3px] border-l-primary bg-surface px-8 py-7 shadow-[0_1px_3px_rgba(28,25,23,0.08)]">
              <AnswerContent answer={answer} />
              <div className="my-6 border-t border-border" />
              {reportUrl ? (
                <a
                  href={reportUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-[6px] border border-primary bg-transparent px-5 py-2.5 text-[14px] text-primary transition hover:bg-[rgba(184,92,44,0.05)]"
                >
                  Get Full Pathway Report
                </a>
              ) : (
                <button
                  type="button"
                  className="inline-flex rounded-[6px] border border-primary bg-transparent px-5 py-2.5 text-[14px] text-primary transition hover:bg-[rgba(184,92,44,0.05)]"
                >
                  Get Full Pathway Report
                </button>
              )}
              {source ? <p className="mt-3 text-[12px] text-muted">Source: {source === "live" ? "Live intelligence" : "Sample fallback"}</p> : null}
            </section>
          ) : null}

          {!loading && followUpQuestion ? (
            <section className="fade-in mt-6 rounded-[6px] border border-border bg-surface px-6 py-5 shadow-[0_1px_3px_rgba(28,25,23,0.08)]">
              <p className="text-[12px] font-medium uppercase tracking-[0.1em] text-muted">Follow-up</p>
              <p className="mt-2 text-[15px] leading-7 text-text">{followUpQuestion}</p>
              <p className="mt-2 text-[13px] text-muted">Update the message or chips above, then ask again.</p>
            </section>
          ) : null}

          {!loading && selectedRole ? <LearningPathPanel role={selectedRole} onClose={() => setSelectedRoleId(null)} /> : null}

          {!loading && !needsFollowUp && futureNodes.length > 0 ? (
            <CareerEvolutionMap roleMap={derivedRoleMap} selectedRoleId={selectedRoleId} onSelectRole={setSelectedRoleId} />
          ) : null}
        </section>

        <footer className="mt-20 flex items-center justify-between border-t border-border py-8 text-[13px] text-muted max-sm:flex-col max-sm:items-start max-sm:gap-3">
          <span>CareerOS by EvolutionOS</span>
          <a href="https://orgos-supriya.vercel.app/" target="_blank" rel="noreferrer" className="text-primary">
            {"-> Try OrgOS"}
          </a>
        </footer>
      </div>
    </main>
  );
}

import { getMemories, saveMemory } from "@/lib/memory";
import { NextRequest, NextResponse } from "next/server";

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

type RoleConnection = {
  current: {
    title: string;
    department: string;
  };
  future: {
    title: string;
    description: string;
    fit: "High Fit" | "Medium Fit";
    learningPath?: LearningPath;
  };
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

type CareerOSApiResponse = {
  answer: string;
  companyId?: string;
  companyName?: string;
  reportUrl?: string;
  roleConnections?: RoleConnection[];
  roleMap?: RoleMap;
  source: "live" | "mock";
  needsFollowUp?: boolean;
  followUpQuestion?: string;
};

type CareerContext = {
  current_role?: string;
  company?: string;
  intent?: string;
  person_name?: string;
  current_org?: string;
  target_org?: string;
};

const knownCompanyIds: Record<string, string> = {
  figma: "ORG-FIGMA-001",
  accenture: "ORG-ACCENTURE-001",
  mckinsey: "ORG-MCKINSEY-001",
  "goldman sachs": "ORG-GOLDMAN-001",
  deloitte: "ORG-DELOITTE-001",
  infosys: "ORG-INFOSYS-001",
};

const fallbackConnections: RoleConnection[] = [
  {
    current: { title: "Design Leader", department: "Design" },
    future: {
      title: "AI Experience Strategy Lead",
      description: "Shapes human-centered AI workflows without requiring a move into engineering.",
      fit: "High Fit",
    },
  },
  {
    current: { title: "Product Manager", department: "Product" },
    future: {
      title: "AI Product Operations Partner",
      description: "Turns product strategy into systems, rituals, and AI-enabled execution patterns.",
      fit: "Medium Fit",
    },
  },
  {
    current: { title: "UX Researcher", department: "Research" },
    future: {
      title: "AI Insight Translator",
      description: "Converts behavior signals and qualitative evidence into decision-ready guidance.",
      fit: "High Fit",
    },
  },
];

const safeParseJson = (value: string): unknown | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
};

const asString = (value: unknown) => (typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined);

const normalizeLookup = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const inferCompanyId = (company: string) => knownCompanyIds[normalizeLookup(company)];

const sanitizeEntity = (value: string) =>
  value
    .replace(/^[\s,.:;-]+|[\s,.:;-]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

const collectOrganizationsFromMessage = (message: string) =>
  Array.from(
    message.matchAll(/\bat\s+([A-Z][A-Za-z0-9&.'-]*(?:\s+[A-Z0-9][A-Za-z0-9&.'-]*){0,5})(?=,|\s+and\b|\s+looking\b|\s+who\b|\s+where\b|\s+what\b|\s+for\b|[.?!]|$)/g),
  )
    .map((match) => sanitizeEntity(match[1] || ""))
    .filter(Boolean);

const inferCurrentOrgFromMessage = (message: string) => collectOrganizationsFromMessage(message)[0] || "";

const inferTargetOrgFromMessage = (message: string) => {
  const explicitTarget =
    message.match(/\blooking\s+for\b.+?\bat\s+([A-Z][A-Za-z0-9&.'-]*(?:\s+[A-Z0-9][A-Za-z0-9&.'-]*){0,5})(?=[.?!]|$)/i) ||
    message.match(/\bgrow\s+at\s+([A-Z][A-Za-z0-9&.'-]*(?:\s+[A-Z0-9][A-Za-z0-9&.'-]*){0,5})(?=[.?!]|$)/i);

  const explicitCandidate = sanitizeEntity(explicitTarget?.[1] || "");
  if (explicitCandidate) {
    return explicitCandidate;
  }

  const organizations = collectOrganizationsFromMessage(message);
  return organizations.length > 1 ? organizations[organizations.length - 1] : organizations[0] || "";
};

const inferPersonNameFromMessage = (message: string) => {
  const explicitMatch =
    message.match(/\bi am\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){1,3})\s*,/i) ||
    message.match(/\bi am\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){1,3})\s+and\b/i);

  return sanitizeEntity(explicitMatch?.[1] || "");
};

const inferRoleFromMessage = (message: string) => {
  const normalized = message.toLowerCase();

  if (/\bux researcher\b/i.test(message)) {
    return "UX Researcher";
  }
  if (/\bdesign leader\b/i.test(message)) {
    return "Design Leader";
  }
  if (/\bproduct manager\b/i.test(message) || /\bi'?m a pm\b|\bpm\b/i.test(message)) {
    return "Product Manager";
  }
  if (/\bdesigner\b/i.test(message)) {
    return "Designer";
  }
  if (/\bresearcher\b/i.test(message)) {
    return "Researcher";
  }
  if (/\bengineer\b/i.test(message)) {
    return "Engineer";
  }

  const explicitRoleMatch =
    message.match(/i am\s+[^,]+,\s*([^,.]+?)\s+at\b/i) ||
    message.match(/i am\s+(?:an?\s+)?([^,.]+?)\s+at\b/i) ||
    message.match(/career paths? for\s+([a-z][a-z\s]+)/i);

  if (explicitRoleMatch?.[1]) {
    return explicitRoleMatch[1].trim().replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  if (normalized.includes("design head")) {
    return "Design Head";
  }

  return "";
};

const departmentForRole = (role: string) => {
  const normalized = role.toLowerCase();
  if (normalized.includes("research")) {
    return "Research";
  }
  if (normalized.includes("design")) {
    return "Design";
  }
  if (normalized.includes("product") || normalized.includes("pm")) {
    return "Product";
  }
  if (normalized.includes("engineer")) {
    return "Engineering";
  }
  return "Default";
};

const buildRoleMap = (connections: RoleConnection[]): RoleMap => {
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
};

const generalCareerAnswer = (currentRole: string, intent: string) => {
  const roleLabel = currentRole.trim() || "your current role";
  const intentLabel = intent.trim() || "what comes next";

  return [
    "Intent: Career path overview",
    "",
    `${roleLabel} can move into higher-leverage AI-era work without forcing a shift into engineering. Here is a general read on ${intentLabel}.`,
    "",
    "GOOD NEXT MOVES:",
    "1. Move toward roles that reward judgment, systems thinking, and communication.",
    "2. Build one visible project that shows how you work with AI tools, not just around them.",
    "3. Choose a direction that compounds your existing strengths rather than restarting from zero.",
    "",
    "PROMISING ROLE DIRECTIONS:",
    `${roleLabel} -> AI Experience Strategy Lead | High Fit | Shapes human-centered AI workflows and service design patterns.`,
    `${roleLabel} -> AI Product Operations Partner | Medium Fit | Connects strategy, systems, and execution across AI-enabled teams.`,
    `${roleLabel} -> AI Insight Translator | High Fit | Turns signals, interviews, and research into operating guidance leaders can act on.`,
  ].join("\n");
};

const normalizeRoleConnection = (value: unknown): RoleConnection | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const currentRecord = record.current && typeof record.current === "object" && !Array.isArray(record.current) ? (record.current as Record<string, unknown>) : {};
  const futureRecord = record.future && typeof record.future === "object" && !Array.isArray(record.future) ? (record.future as Record<string, unknown>) : {};

  const currentTitle =
    asString(currentRecord.title) ||
    asString(currentRecord.role) ||
    asString(record.current_role) ||
    asString(record.currentRole) ||
    asString(record.role);
  const futureTitle =
    asString(futureRecord.title) ||
    asString(futureRecord.role) ||
    asString(record.future_role) ||
    asString(record.futureRole) ||
    asString(record.path) ||
    asString(record.targetRole);

  if (!currentTitle || !futureTitle) {
    return null;
  }

  return {
    current: {
      title: currentTitle,
      department: asString(currentRecord.department) || asString(record.department) || departmentForRole(currentTitle),
    },
    future: {
      title: futureTitle,
      description:
        asString(futureRecord.description) ||
        asString(futureRecord.summary) ||
        asString(record.description) ||
        asString(record.summary) ||
        "Future role",
      fit: /high/i.test(asString(futureRecord.fit) || asString(record.fit) || "") ? "High Fit" : "Medium Fit",
    },
  };
};

const normalizeRoleConnections = (value: unknown): RoleConnection[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const items = value.map(normalizeRoleConnection).filter((item): item is RoleConnection => item !== null);
  return items.length > 0 ? items : undefined;
};

const normalizeRoleMapNode = (value: unknown): RoleMapNode | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const type = asString(record.type)?.toLowerCase();
  const id = asString(record.id);
  const label = asString(record.label) || asString(record.title) || asString(record.name);

  if (!type || !id || !label || (type !== "current" && type !== "future")) {
    return null;
  }

  if (type === "current") {
    return {
      id,
      label,
      type,
      department: asString(record.department) || asString(record.team) || "Default",
    };
  }

  return {
    id,
    label,
    type,
    description: asString(record.description) || asString(record.summary) || "Future role",
    fit: /high/i.test(asString(record.fit) || "") ? "High Fit" : "Medium Fit",
  };
};

const normalizeRoleMapEdge = (value: unknown): RoleMapEdge | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const from = asString(record.from) || asString(record.source);
  const to = asString(record.to) || asString(record.target);
  if (!from || !to) {
    return null;
  }

  return { from, to };
};

const normalizeRoleMap = (value: unknown): RoleMap | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const nodes = (Array.isArray(record.nodes) ? record.nodes : []).map(normalizeRoleMapNode).filter((item): item is RoleMapNode => item !== null);
  const edges = (Array.isArray(record.edges) ? record.edges : []).map(normalizeRoleMapEdge).filter((item): item is RoleMapEdge => item !== null);

  if (nodes.length === 0 || edges.length === 0) {
    return undefined;
  }

  return { nodes, edges };
};

const normalizeWebhookPayload = (payload: unknown) => {
  if (typeof payload === "string") {
    return { answer: payload };
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { answer: "Webhook response was empty." };
  }

  const record = payload as Record<string, unknown>;
  const roleConnections =
    normalizeRoleConnections(record.role_connections) ||
    normalizeRoleConnections(record.roleConnections) ||
    normalizeRoleConnections(record.career_paths) ||
    normalizeRoleConnections(record.careerPaths) ||
    normalizeRoleConnections(record.paths) ||
    normalizeRoleConnections(record.pathways);

  return {
    answer:
      asString(record.answer) ||
      asString(record.text) ||
      asString(record.message) ||
      asString(record.output) ||
      asString(record.response) ||
      "Webhook returned JSON without answer text.",
    reportUrl: asString(record.report_url) || asString(record.reportUrl) || asString(record.url),
    roleConnections,
    roleMap:
      normalizeRoleMap(record.role_map) ||
      normalizeRoleMap(record.roleMap) ||
      normalizeRoleMap({ nodes: record.nodes, edges: record.edges }) ||
      (roleConnections ? buildRoleMap(roleConnections) : undefined),
    needsFollowUp: Boolean(record.needs_follow_up) || Boolean(record.needsFollowUp),
    followUpQuestion: asString(record.follow_up_question) || asString(record.followUpQuestion),
    companyId: asString(record.company_id) || asString(record.companyId) || asString(record.organization_id),
    companyName: asString(record.company) || asString(record.company_name) || asString(record.organization),
  };
};

export async function POST(req: NextRequest) {
  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const contextValue = payload.context && typeof payload.context === "object" && !Array.isArray(payload.context) ? (payload.context as CareerContext) : {};
  const message = asString(payload.message) || asString(payload.query) || asString(payload.question) || "";
  const currentRole =
    asString(contextValue.current_role) || asString(payload.current_role) || asString(payload.currentRole) || inferRoleFromMessage(message);
  const personName = asString(contextValue.person_name) || asString(payload.person_name) || inferPersonNameFromMessage(message) || undefined;
  const currentOrg = asString(contextValue.current_org) || asString(payload.current_org) || inferCurrentOrgFromMessage(message) || undefined;
  const targetOrg = asString(contextValue.target_org) || asString(payload.target_org) || inferTargetOrgFromMessage(message) || undefined;
  const company = asString(contextValue.company) || asString(payload.company) || targetOrg || currentOrg || "";
  const intent = asString(contextValue.intent) || asString(payload.intent) || "";
  const companyId = asString(payload.company_id) || inferCompanyId(company) || undefined;
  const userId = asString(payload.user_id) || asString(payload.userId) || undefined;

  if (!message) {
    return NextResponse.json({ error: "Message cannot be blank." }, { status: 400 });
  }

  const webhookUrl = (process.env.WEBHOOK_URL || process.env.MAKE_WEBHOOK_URL || "").trim();
  if (!webhookUrl) {
    const safeCurrentRole = currentRole || "your current role";
    const fallbackRoleConnections = fallbackConnections.map((connection) =>
      connection.current.title === safeCurrentRole
        ? connection
        : {
            ...connection,
            current: {
              title: safeCurrentRole,
              department: departmentForRole(safeCurrentRole),
            },
          },
    );

    return NextResponse.json({
      answer: generalCareerAnswer(safeCurrentRole, intent),
      ...(companyId ? { companyId } : {}),
      ...(company ? { companyName: company } : {}),
      roleConnections: fallbackRoleConnections,
      roleMap: buildRoleMap(fallbackRoleConnections),
      source: "mock",
    } satisfies CareerOSApiResponse);
  }

  try {
    const memoryContext = userId ? await getMemories(userId) : "";
    const webhookResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        query: message,
        ...(currentRole ? { current_role: currentRole } : {}),
        ...(company ? { company } : {}),
        ...(companyId ? { company_id: companyId } : {}),
        ...(userId ? { user_id: userId } : {}),
        ...(memoryContext ? { memory_context: memoryContext } : {}),
        ...(intent ? { intent } : {}),
        ...(personName ? { person_name: personName } : {}),
        ...(currentOrg ? { current_org: currentOrg } : {}),
        ...(targetOrg ? { target_org: targetOrg } : {}),
        mode: "career",
        context: {
          ...(currentRole ? { current_role: currentRole } : {}),
          ...(company ? { company } : {}),
          ...(intent ? { intent } : {}),
          ...(personName ? { person_name: personName } : {}),
          ...(currentOrg ? { current_org: currentOrg } : {}),
          ...(targetOrg ? { target_org: targetOrg } : {}),
        },
      }),
      signal: AbortSignal.timeout(30000),
    });

    const responseText = await webhookResponse.text();
    const parsed = safeParseJson(responseText);
    const normalized: ReturnType<typeof normalizeWebhookPayload> =
      parsed === null ? { answer: responseText.trim() || "Webhook response was empty." } : normalizeWebhookPayload(parsed);

    if (companyId && normalized.companyId && normalized.companyId !== companyId) {
      return NextResponse.json({ error: "Data mismatch - please retry" }, { status: 409 });
    }

    const safeCurrentRole = currentRole || "your current role";
    const fallbackRoleConnections = fallbackConnections.map((connection) =>
      connection.current.title === safeCurrentRole
        ? connection
        : {
            ...connection,
            current: {
              title: safeCurrentRole,
              department: departmentForRole(safeCurrentRole),
            },
          },
    );
    const asksForCurrentRole = /current role today|what'?s your current role/i.test(normalized.followUpQuestion || "");
    const shouldSuppressRoleFollowUp = Boolean(currentRole) && asksForCurrentRole;
    const answer = normalized.answer || generalCareerAnswer(safeCurrentRole, intent);
    const roleConnections = normalized.roleConnections || (normalized.needsFollowUp ? undefined : fallbackRoleConnections);
    const roleMap = normalized.roleMap || (roleConnections ? buildRoleMap(roleConnections) : undefined);

    if (userId && answer) {
      await saveMemory(userId, `${safeCurrentRole}${company ? ` at ${company}` : ""}: ${message}`, answer);
    }

    return NextResponse.json(
      {
        answer,
        ...(normalized.reportUrl ? { reportUrl: normalized.reportUrl } : {}),
        ...(roleConnections ? { roleConnections } : {}),
        ...(roleMap ? { roleMap } : {}),
        ...(!shouldSuppressRoleFollowUp && normalized.needsFollowUp ? { needsFollowUp: true } : {}),
        ...(!shouldSuppressRoleFollowUp && normalized.followUpQuestion ? { followUpQuestion: normalized.followUpQuestion } : {}),
        ...(normalized.companyId || companyId ? { companyId: normalized.companyId || companyId } : {}),
        ...(normalized.companyName || company ? { companyName: normalized.companyName || company } : {}),
        source: webhookResponse.ok ? "live" : "mock",
      } satisfies CareerOSApiResponse,
      { status: webhookResponse.ok ? 200 : 502 },
    );
  } catch {
    return NextResponse.json(
      {
        error: `Unable to retrieve role intelligence for ${company}.`,
      },
      { status: 502 },
    );
  }
}

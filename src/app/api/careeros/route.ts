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

type CompanyContext = {
  companyId: string;
  companyName: string;
};

type CareerOSApiResponse = {
  answer: string;
  companyId: string;
  companyName: string;
  reportUrl?: string;
  roleConnections?: RoleConnection[];
  roleMap?: RoleMap;
  source: "live" | "mock";
};

const companyDirectory: Array<CompanyContext & { aliases: string[] }> = [
  { companyName: "Figma", companyId: "ORG-FIGMA-001", aliases: ["figma"] },
  { companyName: "Accenture", companyId: "ORG-ACCENTURE-001", aliases: ["accenture"] },
  { companyName: "McKinsey", companyId: "ORG-MCKINSEY-001", aliases: ["mckinsey"] },
  { companyName: "Goldman Sachs", companyId: "ORG-GOLDMAN-001", aliases: ["goldman sachs", "goldman"] },
  { companyName: "Deloitte", companyId: "ORG-DELOITTE-001", aliases: ["deloitte"] },
  { companyName: "Infosys", companyId: "ORG-INFOSYS-001", aliases: ["infosys"] },
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
          {
            title: "Human-in-the-Loop Playbook",
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

const fallbackAnswer = (currentRole: string, company: string, query: string) => {
  const roleLabel = currentRole.trim() || "your current role";
  const companyLabel = company.trim() || "your target company";
  const queryLabel = query.trim() || "career paths in the AI era";

  return [
    "Intent: Career path mapping",
    "",
    `CareerOS is using a sample pathway response for ${roleLabel} at ${companyLabel}. Your prompt, \"${queryLabel}\", points toward roles that build on your existing strengths without forcing a move into engineering.`,
    "",
    "CURRENT ROLE:",
    `${roleLabel}`,
    "",
    "FUTURE PATHS:",
    `${roleLabel} -> AI Experience Strategy Lead | High Fit | Shapes human-centered AI workflows and service design patterns.`,
    `${roleLabel} -> AI Product Operations Partner | Medium Fit | Coordinates strategy, systems, and execution rituals across AI-enabled teams.`,
    `${roleLabel} -> AI Insight Translator | High Fit | Turns signals, interviews, and research into operating guidance leaders can act on.`,
    "",
    "WHY THESE PATHS FIT:",
    "- They preserve strengths in judgment, communication, and systems thinking.",
    "- They move you closer to AI-era leverage without requiring deep coding specialization.",
    "- They align with the operating roles organizations are building right now.",
    "",
    "NEXT STEPS:",
    "1. Pick one future role that feels energizing rather than merely safe.",
    "2. Build a visible project that proves you can operate in that direction now.",
    "3. Use OrgOS to understand how the company itself is reorganizing around AI.",
  ].join("\n");
};

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

const asStringArray = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
};

const normalizeLookup = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const findCompanyById = (companyId: string) =>
  companyDirectory.find((company) => normalizeLookup(company.companyId) === normalizeLookup(companyId));

const resolveCompanyContext = (...candidates: string[]): CompanyContext | null => {
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeLookup(candidate);
    if (!normalizedCandidate) {
      continue;
    }

    const directMatch = companyDirectory.find((company) =>
      company.aliases.some((alias) => normalizedCandidate === normalizeLookup(alias) || normalizedCandidate.includes(normalizeLookup(alias))),
    );

    if (directMatch) {
      return { companyId: directMatch.companyId, companyName: directMatch.companyName };
    }
  }

  return null;
};

const normalizeResources = (value: unknown): ResourceItem[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (typeof item === "string" && item.trim()) {
      return [{ title: item.trim(), source: "CareerOS resource", url: "https://orgos-supriya.vercel.app/" }];
    }

    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return [];
    }

    const record = item as Record<string, unknown>;
    const title = asString(record.title) || asString(record.name);
    if (!title) {
      return [];
    }

    return [
      {
        title,
        source: asString(record.source) || asString(record.provider) || "CareerOS resource",
        url: asString(record.url) || asString(record.link) || "https://orgos-supriya.vercel.app/",
      },
    ];
  });
};

const normalizeLearningPath = (value: unknown): LearningPath | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const skills = asStringArray(record.skills).length > 0 ? asStringArray(record.skills) : asStringArray(record.skillGaps);
  const steps = asStringArray(record.steps).length > 0 ? asStringArray(record.steps) : asStringArray(record.actions);
  const resources = normalizeResources(record.resources).length > 0 ? normalizeResources(record.resources) : normalizeResources(record.learn_now);

  if (skills.length === 0 && steps.length === 0 && resources.length === 0) {
    return undefined;
  }

  return {
    skills,
    steps,
    resources,
  };
};

const normalizeRoleConnection = (value: unknown): RoleConnection | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const currentRecord = (record.current && typeof record.current === "object" && !Array.isArray(record.current)
    ? record.current
    : {}) as Record<string, unknown>;
  const futureRecord = (record.future && typeof record.future === "object" && !Array.isArray(record.future)
    ? record.future
    : {}) as Record<string, unknown>;

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

  const fitSource = asString(futureRecord.fit) || asString(record.fit) || asString(record.match) || "Medium Fit";
  const fit = /high/i.test(fitSource) ? "High Fit" : "Medium Fit";

  return {
    current: {
      title: currentTitle,
      department: asString(currentRecord.department) || asString(currentRecord.team) || asString(record.department) || "Default",
    },
    future: {
      title: futureTitle,
      description:
        asString(futureRecord.description) ||
        asString(futureRecord.summary) ||
        asString(record.description) ||
        asString(record.summary) ||
        "Full learning path available in your CareerOS report.",
      fit,
      learningPath:
        normalizeLearningPath(futureRecord.learningPath) ||
        normalizeLearningPath(futureRecord.learning_path) ||
        normalizeLearningPath(record.learningPath) ||
        normalizeLearningPath(record.learning_path),
    },
  };
};

const normalizeRoleConnections = (value: unknown): RoleConnection[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const connections = value.map(normalizeRoleConnection).filter((item): item is RoleConnection => item !== null);
  return connections.length > 0 ? connections : undefined;
};

const normalizeRoleMapNode = (value: unknown): RoleMapNode | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const type = asString(record.type)?.toLowerCase();
  const label = asString(record.label) || asString(record.title) || asString(record.name);
  const id = asString(record.id);

  if (!label || !id || (type !== "current" && type !== "future")) {
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

  const fitSource = asString(record.fit) || asString(record.match) || "Medium Fit";
  return {
    id,
    label,
    type,
    description: asString(record.description) || asString(record.summary) || "Full learning path available in your CareerOS report.",
    fit: /high/i.test(fitSource) ? "High Fit" : "Medium Fit",
    learningPath:
      normalizeLearningPath(record.learningPath) ||
      normalizeLearningPath(record.learning_path) ||
      normalizeLearningPath(record.pathway) ||
      normalizeLearningPath(record.learning),
  };
};

const normalizeRoleMapEdge = (value: unknown): RoleMapEdge | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const from = asString(record.from) || asString(record.source) || asString(record.current_id);
  const to = asString(record.to) || asString(record.target) || asString(record.future_id);

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
  const nodesSource = Array.isArray(record.nodes) ? record.nodes : [];
  const edgesSource = Array.isArray(record.edges) ? record.edges : [];
  const nodes = nodesSource.map(normalizeRoleMapNode).filter((item): item is RoleMapNode => item !== null);
  const edges = edgesSource.map(normalizeRoleMapEdge).filter((item): item is RoleMapEdge => item !== null);

  if (nodes.length === 0 || edges.length === 0) {
    return undefined;
  }

  return { nodes, edges };
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

const normalizeWebhookPayload = (payload: unknown): Omit<CareerOSApiResponse, "source" | "companyId" | "companyName"> & {
  companyId?: string;
  companyName?: string;
} => {
  if (typeof payload === "string") {
    return { answer: payload };
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { answer: "Webhook response was empty." };
  }

  const record = payload as Record<string, unknown>;
  const answer =
    asString(record.answer) ||
    asString(record.text) ||
    asString(record.message) ||
    asString(record.output) ||
    asString(record.response) ||
    "Webhook returned JSON without answer text.";

  const roleConnections =
    normalizeRoleConnections(record.role_connections) ||
    normalizeRoleConnections(record.roleConnections) ||
    normalizeRoleConnections(record.career_paths) ||
    normalizeRoleConnections(record.careerPaths) ||
    normalizeRoleConnections(record.paths) ||
    normalizeRoleConnections(record.pathways);

  const roleMap =
    normalizeRoleMap(record.role_map) ||
    normalizeRoleMap(record.roleMap) ||
    normalizeRoleMap({ nodes: record.nodes, edges: record.edges }) ||
    (roleConnections ? buildRoleMap(roleConnections) : undefined);

  return {
    answer,
    ...(asString(record.report_url) || asString(record.reportUrl) || asString(record.url)
      ? { reportUrl: asString(record.report_url) || asString(record.reportUrl) || asString(record.url) }
      : {}),
    ...(roleConnections ? { roleConnections } : {}),
    ...(roleMap ? { roleMap } : {}),
    ...(asString(record.company_id) || asString(record.companyId) || asString(record.organization_id) || asString(record.org_id)
      ? { companyId: asString(record.company_id) || asString(record.companyId) || asString(record.organization_id) || asString(record.org_id) }
      : {}),
    ...(asString(record.company) || asString(record.company_name) || asString(record.organization)
      ? { companyName: asString(record.company) || asString(record.company_name) || asString(record.organization) }
      : {}),
  };
};

const hasNoCompanyData = (payload: unknown, normalized: ReturnType<typeof normalizeWebhookPayload>) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  const record = payload as Record<string, unknown>;
  const status = asString(record.status)?.toLowerCase();
  const error = asString(record.error)?.toLowerCase();
  const answerMissing = !normalized.answer || /^webhook (response was empty|returned json without answer text\.)$/i.test(normalized.answer);
  const mapMissing = !normalized.roleMap || normalized.roleMap.nodes.length === 0 || normalized.roleMap.edges.length === 0;
  const connectionMissing = !normalized.roleConnections || normalized.roleConnections.length === 0;

  return (
    record.has_data === false ||
    record.hasData === false ||
    record.data_available === false ||
    record.dataAvailable === false ||
    record.found === false ||
    status === "no_data" ||
    status === "not_found" ||
    error === "no_data" ||
    error === "not_found" ||
    (answerMissing && mapMissing && connectionMissing)
  );
};

const resolveResponseCompany = (
  normalized: ReturnType<typeof normalizeWebhookPayload>,
  requestedCompany: CompanyContext,
): CompanyContext => {
  const byId = normalized.companyId ? findCompanyById(normalized.companyId) : undefined;
  if (byId) {
    return { companyId: byId.companyId, companyName: byId.companyName };
  }

  const inferred = resolveCompanyContext(normalized.companyName || "", normalized.answer || "");
  return inferred || requestedCompany;
};

export async function POST(req: NextRequest) {
  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const query = asString(payload.query) || asString(payload.question) || "";
  const currentRole = asString(payload.current_role) || asString(payload.currentRole) || "";
  const company = asString(payload.company) || asString(payload.company_name) || "";
  const requestedCompany =
    (asString(payload.company_id) ? findCompanyById(asString(payload.company_id) || "") : undefined) ||
    resolveCompanyContext(company, query);
  const requestedCompanyLabel = company || requestedCompany?.companyName || "this company";

  if (!query) {
    return NextResponse.json({ error: "Query cannot be blank." }, { status: 400 });
  }

  if (!requestedCompany) {
    return NextResponse.json(
      { error: `No role intelligence available for ${requestedCompanyLabel}. Run OrgOS analysis first.` },
      { status: 404 },
    );
  }

  const webhookUrl = (process.env.WEBHOOK_URL || process.env.MAKE_WEBHOOK_URL || "").trim();
  if (!webhookUrl) {
    return NextResponse.json({
      answer: fallbackAnswer(currentRole, requestedCompany.companyName, query),
      companyId: requestedCompany.companyId,
      companyName: requestedCompany.companyName,
      roleConnections: fallbackConnections,
      roleMap: buildRoleMap(fallbackConnections),
      source: "mock",
    } satisfies CareerOSApiResponse);
  }

  try {
    const webhookResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        current_role: currentRole,
        company: requestedCompany.companyName,
        company_id: requestedCompany.companyId,
        mode: "career",
      }),
      signal: AbortSignal.timeout(30000),
    });

    const responseText = await webhookResponse.text();
    const parsed = safeParseJson(responseText);
    const normalized = parsed === null ? { answer: responseText.trim() || "Webhook response was empty." } : normalizeWebhookPayload(parsed);

    if (hasNoCompanyData(parsed, normalized)) {
      return NextResponse.json(
        { error: `No role intelligence available for ${requestedCompany.companyName}. Run OrgOS analysis first.` },
        { status: 404 },
      );
    }

    const responseCompany = resolveResponseCompany(normalized, requestedCompany);
    if (responseCompany.companyId !== requestedCompany.companyId) {
      return NextResponse.json({ error: "Data mismatch - please retry" }, { status: 409 });
    }

    return NextResponse.json(
      {
        answer: normalized.answer || fallbackAnswer(currentRole, requestedCompany.companyName, query),
        companyId: requestedCompany.companyId,
        companyName: requestedCompany.companyName,
        ...(normalized.reportUrl ? { reportUrl: normalized.reportUrl } : {}),
        ...(normalized.roleConnections ? { roleConnections: normalized.roleConnections } : {}),
        ...(normalized.roleMap ? { roleMap: normalized.roleMap } : {}),
        source: webhookResponse.ok ? "live" : "mock",
      } satisfies CareerOSApiResponse,
      { status: webhookResponse.ok ? 200 : 502 },
    );
  } catch {
    return NextResponse.json(
      { error: `Unable to retrieve role intelligence for ${requestedCompany.companyName}.` },
      { status: 502 },
    );
  }
}

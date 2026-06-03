export type CareerOSViewType = "rolemap" | "careerpath" | "change_actions" | "report";

export type CareerOSNode = {
  id: string;
  label: string;
  type: string;
};

export type CareerOSEdge = {
  from: string;
  to: string;
  label?: string;
};

export type CareerOSVisualSpec = {
  nodes: CareerOSNode[];
  edges: CareerOSEdge[];
};

export type CareerActionMap = {
  "30": string[];
  "60": string[];
  "90": string[];
};

export type CareerPath = {
  title: string;
  targetRole: string;
  skillGaps: string[];
  actions: CareerActionMap;
};

export type CareerWebhookResponse = {
  answer: string;
  view_type: CareerOSViewType;
  visual_spec?: CareerOSVisualSpec | null;
  report_url?: string;
  career_paths?: CareerPath[];
};

export const roleMapSample: CareerOSVisualSpec = {
  nodes: [
    { id: "Current: Product Designer", label: "Product Designer", type: "current_role" },
    { id: "Current: Growth Designer", label: "Growth Designer", type: "current_role" },
    { id: "Current: PM", label: "Product Manager", type: "current_role" },
    { id: "Future: AI Experience Designer", label: "AI Experience Designer", type: "future_role" },
    { id: "Future: AI Operations Lead", label: "AI Operations Lead", type: "future_role" },
    { id: "Future: People Ops Copilot", label: "People Ops Copilot", type: "future_role" },
  ],
  edges: [
    {
      from: "Current: Product Designer",
      to: "Future: AI Experience Designer",
      label: "reskilling + copilots",
    },
    {
      from: "Current: Growth Designer",
      to: "Future: AI Experience Designer",
      label: "new workflows",
    },
    {
      from: "Current: PM",
      to: "Future: AI Operations Lead",
      label: "ownership shift",
    },
    {
      from: "Future: AI Experience Designer",
      to: "Future: People Ops Copilot",
      label: "next-gen enablement",
    },
  ],
};

export const careerPathSample: CareerPath[] = [
  {
    title: "AI Product Lead",
    targetRole: "Director, AI Product Transformation",
    skillGaps: ["product systems thinking", "prompt quality governance", "AI delivery roadmap"],
    actions: {
      "30": ["Audit repetitive design tasks", "Create one AI-assisted prototype loop", "Define handoff SLAs"],
      "60": ["Stand up model evaluation rubric", "Align team scorecard", "Pilot cross-functional AI backlog"],
      "90": ["Shift from execution to orchestration", "Launch people-first AI mentoring", "Publish quarterly outcome dashboard"],
    },
  },
  {
    title: "Growth AI Strategist",
    targetRole: "Head of Growth Automation",
    skillGaps: ["analytics-to-action workflows", "experimental design", "stakeholder narratives"],
    actions: {
      "30": ["Tag all growth workflows with owners", "Introduce AI insight digest", "Create weekly decision log"],
      "60": ["Automate experiment triage", "Run coaching cadence", "Design confidence-based playbooks"],
      "90": ["Scale to multi-product pods", "Introduce escalation matrix", "Set board-ready growth scorecard"],
    },
  },
  {
    title: "AI Talent Architect",
    targetRole: "Manager, AI Workforce Design",
    skillGaps: ["workforce transition planning", "role migration", "reskilling journeys"],
    actions: {
      "30": ["Map role-level risk bands", "Identify high-leverage people", "Draft personalized learning plans"],
      "60": ["Launch micro-credential tracks", "Introduce transition office hours", "Create transition scorecards"],
      "90": ["Institutionalize review cadence", "Add capability ladders", "Publish succession readiness reports"],
    },
  },
];

export const careerPathSampleVisual: CareerOSVisualSpec = {
  nodes: [
    { id: "person", label: "Priya", type: "person" },
    { id: "career-path-1", label: "AI Product Lead", type: "career_path" },
    { id: "career-path-2", label: "Growth AI Strategist", type: "career_path" },
    { id: "career-path-3", label: "AI Talent Architect", type: "career_path" },
  ],
  edges: [
    { from: "person", to: "career-path-1", label: "Path A" },
    { from: "person", to: "career-path-2", label: "Path B" },
    { from: "person", to: "career-path-3", label: "Path C" },
  ],
};

export const changeActionsSample: CareerOSVisualSpec = {
  nodes: [
    { id: "owner", label: "Leadership", type: "current_role" },
    { id: "risk", label: "Change risks", type: "future_role" },
    { id: "mitigation", label: "Mitigations", type: "future_role" },
  ],
  edges: [
    { from: "owner", to: "risk", label: "identify" },
    { from: "risk", to: "mitigation", label: "resolve" },
  ],
};

export const demoFallback = (question: string): CareerWebhookResponse & { source: "mock" } => {
  const normalized = question.toLowerCase();
  const view_type: CareerOSViewType =
    normalized.includes("career path") || normalized.includes("priya")
      ? "careerpath"
      : normalized.includes("change")
        ? "change_actions"
        : normalized.includes("leadership")
          ? "change_actions"
          : normalized.includes("report")
            ? "report"
            : "rolemap";

  return {
    answer:
      "CareerOS received your query. Connect your Make.com webhook to unlock live outputs; currently showing curated demo insights.",
    visual_spec:
      view_type === "rolemap"
        ? roleMapSample
        : view_type === "careerpath"
          ? careerPathSampleVisual
          : view_type === "change_actions"
            ? changeActionsSample
            : null,
    report_url: view_type === "report" ? "https://example.com/careeros-report" : undefined,
    career_paths: view_type === "careerpath" ? careerPathSample : undefined,
    view_type,
    source: "mock",
  };
}

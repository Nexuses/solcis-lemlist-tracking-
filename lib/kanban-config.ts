import type { EngagementStage, Prospect } from "./types";

export type AutomationChannel = "email" | "linkedin";

export type KanbanColumnRule =
  | { type: "hot" }
  | { type: "manual" }
  | { type: "stages"; stages: EngagementStage[] };

export interface AutomationKanbanColumn {
  id: string;
  title: string;
  description: string;
  rule: KanbanColumnRule;
  order: number;
  /** Tailwind classes for the column accent (dot + soft header tint) */
  color?: string;
  colorBg?: string;
}

export const ALL_ENGAGEMENT_STAGES: {
  value: EngagementStage;
  label: string;
}[] = [
  { value: "prospect", label: "Prospect" },
  { value: "contacted", label: "Contacted" },
  { value: "inviteAccepted", label: "Invite accepted" },
  { value: "opened", label: "Opened" },
  { value: "clicked", label: "Clicked" },
  { value: "replied", label: "Replied" },
];

/** Email / multi-channel default board */
export const DEFAULT_KANBAN_COLUMNS: AutomationKanbanColumn[] = [
  {
    id: "hot",
    title: "Hot",
    description: "High-intent · interested · replied",
    rule: { type: "hot" },
    order: 0,
    color: "bg-[#EF4444]",
    colorBg: "bg-[#FEF2F2]",
  },
  {
    id: "engaged",
    title: "Engage",
    description: "Opened · clicked · replied",
    rule: { type: "stages", stages: ["inviteAccepted", "opened", "clicked", "replied"] },
    order: 1,
    color: "bg-[#10B981]",
    colorBg: "bg-[#ECFDF5]",
  },
  {
    id: "contacted",
    title: "Contacted",
    description: "Outreach sent",
    rule: { type: "stages", stages: ["contacted"] },
    order: 2,
    color: "bg-[#3B82F6]",
    colorBg: "bg-[#EFF6FF]",
  },
  {
    id: "prospect",
    title: "Prospects",
    description: "Not contacted yet",
    rule: { type: "stages", stages: ["prospect"] },
    order: 3,
    color: "bg-[#F59E0B]",
    colorBg: "bg-[#FFFBEB]",
  },
];

/**
 * LinkedIn automation board:
 * Prospect → Contact → Invite accepted → Opened → Clicked → Replied
 */
export const LINKEDIN_KANBAN_COLUMNS: AutomationKanbanColumn[] = [
  {
    id: "li_prospect",
    title: "Prospect",
    description: "Not contacted yet",
    rule: { type: "stages", stages: ["prospect"] },
    order: 0,
    color: "bg-[#F59E0B]",
    colorBg: "bg-[#FFFBEB]",
  },
  {
    id: "li_contact",
    title: "Contact",
    description: "Invite or message sent",
    rule: { type: "stages", stages: ["contacted"] },
    order: 1,
    color: "bg-[#3B82F6]",
    colorBg: "bg-[#EFF6FF]",
  },
  {
    id: "li_invite",
    title: "Invite accepted",
    description: "LinkedIn invitation accepted",
    rule: { type: "stages", stages: ["inviteAccepted"] },
    order: 2,
    color: "bg-[#06B6D4]",
    colorBg: "bg-[#ECFEFF]",
  },
  {
    id: "li_opened",
    title: "Opened",
    description: "LinkedIn message opened",
    rule: { type: "stages", stages: ["opened"] },
    order: 3,
    color: "bg-[#8B5CF6]",
    colorBg: "bg-[#F5F3FF]",
  },
  {
    id: "li_clicked",
    title: "Clicked",
    description: "Link clicked",
    rule: { type: "stages", stages: ["clicked"] },
    order: 4,
    color: "bg-[#EC4899]",
    colorBg: "bg-[#FDF2F8]",
  },
  {
    id: "li_replied",
    title: "Replied",
    description: "LinkedIn reply received",
    rule: { type: "stages", stages: ["replied"] },
    order: 5,
    color: "bg-[#10B981]",
    colorBg: "bg-[#ECFDF5]",
  },
];

export function defaultColumnsForChannel(
  channel: AutomationChannel = "email"
): AutomationKanbanColumn[] {
  return channel === "linkedin"
    ? LINKEDIN_KANBAN_COLUMNS
    : DEFAULT_KANBAN_COLUMNS;
}

export function resolveKanbanColumns(
  custom?: AutomationKanbanColumn[],
  channel: AutomationChannel = "email"
): AutomationKanbanColumn[] {
  if (!custom?.length) return defaultColumnsForChannel(channel);
  return [...custom].sort((a, b) => a.order - b.order);
}

export function matchesColumn(
  prospect: Pick<Prospect, "stage" | "isHot">,
  column: AutomationKanbanColumn
): boolean {
  if (column.rule.type === "manual") {
    return false;
  }
  if (column.rule.type === "hot") {
    return prospect.isHot === true;
  }
  return column.rule.stages.includes(prospect.stage);
}

export function assignProspectColumnId(
  prospect: Pick<Prospect, "stage" | "isHot" | "assignedColumnId">,
  columns: AutomationKanbanColumn[]
): string {
  if (
    prospect.assignedColumnId &&
    columns.some((col) => col.id === prospect.assignedColumnId)
  ) {
    return prospect.assignedColumnId;
  }

  for (const column of columns) {
    if (matchesColumn(prospect, column)) {
      return column.id;
    }
  }
  const fallback = columns[columns.length - 1];
  return fallback?.id ?? "prospect";
}

export interface EngagementCardStyle {
  label: string;
  dot: string;
  card: string;
  badge: string;
}

export function getEngagementCardStyle(
  stage?: EngagementStage,
  isHot?: boolean
): EngagementCardStyle {
  if (isHot) {
    return {
      label: "Hot",
      dot: "bg-[#EF4444]",
      card: "bg-orange-50/50 hover:bg-orange-50/80",
      badge: "bg-orange-100 text-orange-800 ring-orange-200",
    };
  }

  switch (stage) {
    case "replied":
      return {
        label: "Replied",
        dot: "bg-[#10B981]",
        card: "bg-emerald-50/40 hover:bg-emerald-50/70",
        badge: "bg-emerald-100 text-emerald-700 ring-emerald-200",
      };
    case "clicked":
      return {
        label: "Clicked",
        dot: "bg-[#EC4899]",
        card: "bg-pink-50/40 hover:bg-pink-50/70",
        badge: "bg-pink-100 text-pink-700 ring-pink-200",
      };
    case "opened":
      return {
        label: "Opened",
        dot: "bg-[#8B5CF6]",
        card: "bg-violet-50/40 hover:bg-violet-50/70",
        badge: "bg-violet-100 text-violet-700 ring-violet-200",
      };
    case "inviteAccepted":
      return {
        label: "Invite accepted",
        dot: "bg-[#06B6D4]",
        card: "bg-cyan-50/40 hover:bg-cyan-50/70",
        badge: "bg-cyan-100 text-cyan-700 ring-cyan-200",
      };
    case "contacted":
      return {
        label: "Contact",
        dot: "bg-[#3B82F6]",
        card: "bg-blue-50/40 hover:bg-blue-50/70",
        badge: "bg-blue-100 text-blue-700 ring-blue-200",
      };
    default:
      return {
        label: "Prospect",
        dot: "bg-[#F59E0B]",
        card: "bg-white hover:bg-[#FAFAF9]",
        badge: "bg-amber-100 text-amber-700 ring-amber-200",
      };
  }
}

export function isEngagedStage(stage?: EngagementStage): boolean {
  return (
    stage === "inviteAccepted" ||
    stage === "opened" ||
    stage === "clicked" ||
    stage === "replied"
  );
}

export function isEngagedColumn(column: {
  rule: KanbanColumnRule;
}): boolean {
  if (column.rule.type !== "stages") return false;
  return column.rule.stages.some((s) => isEngagedStage(s));
}

export function isHotColumn(column: { rule: KanbanColumnRule }): boolean {
  return column.rule.type === "hot";
}

const COLUMN_COLOR_PALETTE = [
  { color: "bg-[#F59E0B]", colorBg: "bg-[#FFFBEB]" },
  { color: "bg-[#3B82F6]", colorBg: "bg-[#EFF6FF]" },
  { color: "bg-[#06B6D4]", colorBg: "bg-[#ECFEFF]" },
  { color: "bg-[#8B5CF6]", colorBg: "bg-[#F5F3FF]" },
  { color: "bg-[#EC4899]", colorBg: "bg-[#FDF2F8]" },
  { color: "bg-[#10B981]", colorBg: "bg-[#ECFDF5]" },
  { color: "bg-[#EF4444]", colorBg: "bg-[#FEF2F2]" },
  { color: "bg-[#64748B]", colorBg: "bg-[#F8FAFC]" },
];

export function createKanbanColumn(
  title: string,
  rule: KanbanColumnRule,
  description = "",
  order?: number
): AutomationKanbanColumn {
  const id = `col_${Math.random().toString(36).slice(2, 10)}`;
  const paletteIndex = (order ?? 0) % COLUMN_COLOR_PALETTE.length;
  const accent = COLUMN_COLOR_PALETTE[paletteIndex];
  return {
    id,
    title: title.trim(),
    description: description.trim(),
    rule,
    order: order ?? 999,
    color: accent.color,
    colorBg: accent.colorBg,
  };
}

export function getColumnAccent(
  column: Pick<AutomationKanbanColumn, "id" | "title" | "color" | "colorBg">,
  index: number
): { dot: string; bg: string } {
  if (column.color) {
    return {
      dot: column.color,
      bg: column.colorBg ?? "bg-white",
    };
  }

  const key = `${column.id} ${column.title}`.toLowerCase();
  if (key.includes("invite")) return { dot: "bg-[#06B6D4]", bg: "bg-[#ECFEFF]" };
  if (key.includes("prospect")) return { dot: "bg-[#F59E0B]", bg: "bg-[#FFFBEB]" };
  if (key.includes("engage") || key.includes("replied"))
    return { dot: "bg-[#10B981]", bg: "bg-[#ECFDF5]" };
  if (key.includes("open")) return { dot: "bg-[#8B5CF6]", bg: "bg-[#F5F3FF]" };
  if (key.includes("click")) return { dot: "bg-[#EC4899]", bg: "bg-[#FDF2F8]" };
  if (key.includes("hot")) return { dot: "bg-[#EF4444]", bg: "bg-[#FEF2F2]" };
  if (key.includes("contact")) return { dot: "bg-[#3B82F6]", bg: "bg-[#EFF6FF]" };

  const palette = [
    { dot: "bg-[#F97316]", bg: "bg-[#FFF7ED]" },
    { dot: "bg-[#22C55E]", bg: "bg-[#F0FDF4]" },
    { dot: "bg-[#3B82F6]", bg: "bg-[#EFF6FF]" },
    { dot: "bg-[#A855F7]", bg: "bg-[#FAF5FF]" },
    { dot: "bg-[#EC4899]", bg: "bg-[#FDF2F8]" },
    { dot: "bg-[#06B6D4]", bg: "bg-[#ECFEFF]" },
  ];
  return palette[index % palette.length];
}

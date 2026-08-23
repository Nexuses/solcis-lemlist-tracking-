import type { EngagementStage, LemlistActivity, LemlistLead } from "./types";

const OPEN_TYPES = new Set(["emailsOpened", "linkedinOpened"]);
const CLICK_TYPES = new Set(["emailsClicked"]);
const INVITE_ACCEPTED_TYPES = new Set(["linkedinInviteAccepted"]);
const REPLY_TYPES = new Set([
  "emailsReplied",
  "linkedinReplied",
  "whatsappReplied",
]);
/** Outreach sent — Contact column (not profile visit alone). */
const SENT_TYPES = new Set([
  "emailsSent",
  "linkedinSent",
  "linkedinInviteDone",
]);
/** Soft contact signals (visit) — still Contact, lower than invite/message. */
const VISIT_TYPES = new Set(["linkedinVisitDone", "linkedinFollowDone"]);

export const STAGE_RANK: Record<EngagementStage, number> = {
  prospect: 0,
  contacted: 1,
  inviteAccepted: 2,
  opened: 3,
  clicked: 4,
  replied: 5,
};

export function maxStage(
  a: EngagementStage,
  b: EngagementStage
): EngagementStage {
  return STAGE_RANK[a] >= STAGE_RANK[b] ? a : b;
}

/**
 * Map Lemlist lead state / lastState to our board stage.
 * This matches Lemlist campaign reports more closely than activities alone.
 */
export function stageFromLeadState(
  raw?: string | null
): EngagementStage | null {
  if (!raw?.trim()) return null;
  const state = raw.trim();

  // Exact detailed states (LinkedIn + email)
  switch (state) {
    case "linkedinReplied":
    case "emailsReplied":
    case "whatsappReplied":
    case "linkedinInterested":
    case "emailsInterested":
    case "interested":
    case "meetingBooked":
      return "replied";

    case "emailsClicked":
      return "clicked";

    case "linkedinOpened":
    case "emailsOpened":
    case "attracted":
    case "warmed":
    case "hooked":
      return "opened";

    case "linkedinInviteAccepted":
      return "inviteAccepted";

    case "linkedinSent":
    case "linkedinInviteDone":
    case "linkedinVisitDone":
    case "linkedinFollowDone":
    case "emailsSent":
    case "contacted":
      return "contacted";

    case "linkedinNotInterested":
    case "emailsNotInterested":
    case "notInterested":
    case "emailsBounced":
    case "emailsUnsubscribed":
    case "failed":
    case "paused":
    case "skipped":
    case "imported":
    case "scanned":
    case "reviewed":
      return "prospect";

    default:
      break;
  }

  const lower = state.toLowerCase();
  if (lower.includes("replied") || lower.includes("interested")) {
    return "replied";
  }
  if (lower.includes("clicked")) return "clicked";
  if (lower.includes("opened") || lower.includes("attracted")) {
    return "opened";
  }
  if (lower.includes("inviteaccepted") || lower.includes("invite_accepted")) {
    return "inviteAccepted";
  }
  if (
    lower.includes("sent") ||
    lower.includes("invitedone") ||
    lower.includes("visitdone") ||
    lower.includes("contact")
  ) {
    return "contacted";
  }

  return null;
}

function stageFromActivities(activities: LemlistActivity[]): {
  stage: EngagementStage;
  openCount: number;
  clickCount: number;
  hasReplied: boolean;
  hasInviteAccepted: boolean;
  lastActivityAt?: Date;
} {
  let openCount = 0;
  let clickCount = 0;
  let hasReplied = false;
  let hasInviteAccepted = false;
  let hasSent = false;
  let hasVisit = false;
  let lastActivityAt: Date | undefined;

  for (const activity of activities) {
    const at = new Date(activity.createdAt);
    if (!Number.isNaN(at.getTime())) {
      if (!lastActivityAt || at > lastActivityAt) {
        lastActivityAt = at;
      }
    }

    if (OPEN_TYPES.has(activity.type)) openCount += 1;
    if (CLICK_TYPES.has(activity.type)) clickCount += 1;
    if (INVITE_ACCEPTED_TYPES.has(activity.type)) hasInviteAccepted = true;
    if (REPLY_TYPES.has(activity.type)) hasReplied = true;
    if (SENT_TYPES.has(activity.type)) hasSent = true;
    if (VISIT_TYPES.has(activity.type)) hasVisit = true;
  }

  let stage: EngagementStage = "prospect";
  if (hasReplied) stage = "replied";
  else if (clickCount > 0) stage = "clicked";
  else if (openCount > 0) stage = "opened";
  else if (hasInviteAccepted) stage = "inviteAccepted";
  else if (hasSent || hasVisit) stage = "contacted";

  return {
    stage,
    openCount,
    clickCount,
    hasReplied,
    hasInviteAccepted,
    lastActivityAt,
  };
}

export function computeEngagementFromActivities(
  activities: LemlistActivity[],
  lead?: Pick<LemlistLead, "state" | "lastState" | "status">
): {
  stage: EngagementStage;
  openCount: number;
  clickCount: number;
  hasReplied: boolean;
  hasInviteAccepted: boolean;
  lastActivityAt?: Date;
} {
  const fromActivities = stageFromActivities(activities);

  const stateStage = maxOfNullable(
    stageFromLeadState(lead?.state),
    stageFromLeadState(lead?.lastState),
    stageFromLeadState(lead?.status)
  );

  // Prefer the higher of activity-derived stage and Lemlist lead state
  // so board columns align with Lemlist reports.
  let stage = fromActivities.stage;
  if (stateStage) {
    stage = maxStage(stage, stateStage);
  }

  const hasInviteAccepted =
    fromActivities.hasInviteAccepted ||
    stateStage === "inviteAccepted" ||
    stageFromLeadState(lead?.state) === "inviteAccepted" ||
    stageFromLeadState(lead?.lastState) === "inviteAccepted";

  const hasReplied =
    fromActivities.hasReplied ||
    stateStage === "replied" ||
    stageFromLeadState(lead?.state) === "replied" ||
    stageFromLeadState(lead?.lastState) === "replied";

  return {
    stage,
    openCount: fromActivities.openCount,
    clickCount: fromActivities.clickCount,
    hasReplied,
    hasInviteAccepted,
    lastActivityAt: fromActivities.lastActivityAt,
  };
}

function maxOfNullable(
  ...stages: Array<EngagementStage | null>
): EngagementStage | null {
  let best: EngagementStage | null = null;
  for (const stage of stages) {
    if (!stage) continue;
    best = best ? maxStage(best, stage) : stage;
  }
  return best;
}

export function stageFromWebhookEvent(type: string): EngagementStage | null {
  if (REPLY_TYPES.has(type)) return "replied";
  if (CLICK_TYPES.has(type)) return "clicked";
  if (OPEN_TYPES.has(type)) return "opened";
  if (INVITE_ACCEPTED_TYPES.has(type)) return "inviteAccepted";
  if (SENT_TYPES.has(type) || VISIT_TYPES.has(type)) return "contacted";
  if (type === "linkedinInterested" || type === "emailsInterested") {
    return "replied";
  }
  return null;
}

export function isEngagementEvent(type: string): boolean {
  return (
    OPEN_TYPES.has(type) ||
    CLICK_TYPES.has(type) ||
    INVITE_ACCEPTED_TYPES.has(type) ||
    REPLY_TYPES.has(type) ||
    SENT_TYPES.has(type) ||
    VISIT_TYPES.has(type) ||
    type === "linkedinInterested" ||
    type === "emailsInterested"
  );
}

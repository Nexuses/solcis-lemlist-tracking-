import type { LemlistLead, Prospect } from "./types";

const STANDARD_LEAD_KEYS = new Set([
  "_id",
  "email",
  "firstName",
  "lastName",
  "companyName",
  "jobTitle",
  "companyDomain",
  "phone",
  "linkedinUrl",
  "picture",
  "emailStatus",
  "timezone",
  "icebreaker",
  "state",
  "lastState",
  "status",
  "contactId",
  "variables",
]);

function pickString(value: unknown): string | undefined {
  if (value == null) return undefined;
  // Skip objects / arrays — they break the details UI
  if (typeof value === "object") return undefined;
  if (typeof value === "boolean" || typeof value === "number") {
    return String(value);
  }
  if (typeof value !== "string") return undefined;
  const str = value.trim();
  if (!str || str === "[object Object]") return undefined;
  return str;
}

export function extractCustomFields(lead: LemlistLead): Record<string, string> {
  const custom: Record<string, string> = {};

  for (const [key, value] of Object.entries(lead)) {
    if (STANDARD_LEAD_KEYS.has(key)) continue;
    const str = pickString(value);
    if (str) custom[key] = str;
  }

  const variables = lead.variables;
  if (variables && typeof variables === "object" && !Array.isArray(variables)) {
    for (const [key, value] of Object.entries(variables)) {
      try {
        const str = pickString(value);
        if (str && !STANDARD_LEAD_KEYS.has(key)) {
          custom[key] = str;
        }
      } catch {
        // Skip bad variable entries
      }
    }
  }

  return custom;
}

export function leadToProspectBase(
  lead: LemlistLead,
  automationId: string,
  engagement: Pick<
    Prospect,
    | "stage"
    | "openCount"
    | "clickCount"
    | "hasReplied"
    | "hasInviteAccepted"
    | "lastActivityAt"
    | "isHot"
  >
): Omit<Prospect, "_id"> {
  const now = new Date();

  return {
    automationId,
    leadId: lead._id,
    email: lead.email,
    firstName: lead.firstName,
    lastName: lead.lastName,
    companyName: lead.companyName,
    jobTitle: lead.jobTitle,
    companyDomain: lead.companyDomain,
    phone: lead.phone,
    linkedinUrl: lead.linkedinUrl,
    picture: lead.picture,
    emailStatus: lead.emailStatus,
    timezone: lead.timezone,
    icebreaker: lead.icebreaker,
    state: lead.state,
    lastState: lead.lastState,
    status: lead.status,
    contactId: lead.contactId,
    customFields: extractCustomFields(lead),
    isHot: engagement.isHot ?? false,
    stage: engagement.stage,
    openCount: engagement.openCount,
    clickCount: engagement.clickCount,
    hasReplied: engagement.hasReplied,
    hasInviteAccepted: engagement.hasInviteAccepted ?? false,
    lastActivityAt: engagement.lastActivityAt,
    updatedAt: now,
  };
}

export function serializeProspectForBoard(prospect: Prospect) {
  const customFields: Record<string, string> = {};
  for (const [key, value] of Object.entries(prospect.customFields ?? {})) {
    if (value == null) continue;
    if (typeof value === "object") continue;
    const str = String(value).trim();
    if (!str || str === "[object Object]") continue;
    customFields[key] = str;
  }

  return {
    leadId: prospect.leadId,
    email: prospect.email ?? null,
    firstName: prospect.firstName ?? null,
    lastName: prospect.lastName ?? null,
    companyName: prospect.companyName ?? null,
    jobTitle: prospect.jobTitle ?? null,
    companyDomain: prospect.companyDomain ?? null,
    phone: prospect.phone ?? null,
    linkedinUrl: prospect.linkedinUrl ?? null,
    picture: prospect.picture ?? null,
    emailStatus: prospect.emailStatus ?? null,
    timezone: prospect.timezone ?? null,
    icebreaker: prospect.icebreaker ?? null,
    state: prospect.state ?? null,
    lastState: prospect.lastState ?? null,
    status: prospect.status ?? null,
    contactId: prospect.contactId ?? null,
    customFields,
    isHot: prospect.isHot ?? false,
    assignedColumnId: prospect.assignedColumnId ?? null,
    stage: prospect.stage,
    openCount: prospect.openCount,
    clickCount: prospect.clickCount,
    hasReplied: prospect.hasReplied,
    hasInviteAccepted: prospect.hasInviteAccepted ?? false,
    lastActivityAt: prospect.lastActivityAt ?? null,
  };
}

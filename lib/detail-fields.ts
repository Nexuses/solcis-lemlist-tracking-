import type { BoardProspect } from "@/components/ProspectDetailModal";
import { getFullName } from "./prospect-display";

export type DetailFieldKey =
  | "fullName"
  | "email"
  | "jobTitle"
  | "companyName"
  | "linkedinUrl"
  | "phone"
  | "companyDomain"
  | "emailStatus"
  | "timezone"
  | "icebreaker"
  | "state"
  | "lastState"
  | "status"
  | "contactId"
  | "leadId"
  | "opens"
  | "clicks"
  | "replied"
  | "inviteAccepted"
  | "customFields";

export interface DetailFieldDefinition {
  key: DetailFieldKey;
  label: string;
  group: "contact" | "company" | "engagement" | "lemlist" | "other";
}

export const DETAIL_FIELD_CATALOG: DetailFieldDefinition[] = [
  { key: "fullName", label: "Full name", group: "contact" },
  { key: "email", label: "Email", group: "contact" },
  { key: "jobTitle", label: "Job title", group: "contact" },
  { key: "phone", label: "Phone", group: "contact" },
  { key: "linkedinUrl", label: "LinkedIn", group: "contact" },
  { key: "companyName", label: "Company name", group: "company" },
  { key: "companyDomain", label: "Company domain", group: "company" },
  { key: "emailStatus", label: "Email status", group: "lemlist" },
  { key: "timezone", label: "Timezone", group: "lemlist" },
  { key: "icebreaker", label: "Icebreaker", group: "lemlist" },
  { key: "state", label: "Lead state", group: "lemlist" },
  { key: "lastState", label: "Last activity", group: "lemlist" },
  { key: "status", label: "Status", group: "lemlist" },
  { key: "opens", label: "Opens", group: "engagement" },
  { key: "clicks", label: "Clicks", group: "engagement" },
  { key: "inviteAccepted", label: "Invite accepted", group: "engagement" },
  { key: "replied", label: "Replied", group: "engagement" },
  { key: "contactId", label: "Contact ID", group: "other" },
  { key: "leadId", label: "Lead ID", group: "other" },
  { key: "customFields", label: "Custom variables", group: "other" },
];

export const DEFAULT_DETAIL_FIELDS: DetailFieldKey[] = [
  "fullName",
  "email",
  "jobTitle",
  "companyName",
  "linkedinUrl",
];

/** Always surface every known field; empty ones are filtered at render. */
export const ALL_DETAIL_FIELDS: DetailFieldKey[] = DETAIL_FIELD_CATALOG.map(
  (f) => f.key
);

export function defaultDetailFieldsForChannel(
  _channel: "email" | "linkedin" = "email"
): DetailFieldKey[] {
  return ALL_DETAIL_FIELDS;
}

const EMPTY = "—";

const HIDDEN_CUSTOM_KEYS = new Set([
  "stateSystem",
  "updatedAt",
  "isPaused",
  "personalized",
  "source",
  "variables",
  "_id",
  "id",
  "picture",
  "createdAt",
  "created_at",
]);

export interface DetailRow {
  key: string;
  label: string;
  value: string;
  href?: string;
  isEmpty: boolean;
}

/** Convert any value to a safe display string; returns null for objects/arrays/empty. */
export function safeDisplayValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed === "[object Object]") return null;
    return trimmed;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  // Hide nested objects / arrays that break the UI
  if (typeof value === "object") return null;
  return null;
}

function display(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : EMPTY;
}

function humanLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function linkFor(label: string, value: string): string | undefined {
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (label.toLowerCase().includes("linkedin") && value.includes("linkedin.")) {
    return value.startsWith("http") ? value : `https://${value}`;
  }
  if (label.toLowerCase() === "email" || value.includes("@")) {
    return value.includes("@") ? `mailto:${value}` : undefined;
  }
  if (label.toLowerCase() === "phone") return `tel:${value}`;
  if (label.toLowerCase().includes("domain")) {
    return value.startsWith("http") ? value : `https://${value}`;
  }
  return undefined;
}

export function resolveDetailFields(
  custom?: DetailFieldKey[],
  channel: "email" | "linkedin" = "email"
): DetailFieldKey[] {
  if (!custom?.length) return defaultDetailFieldsForChannel(channel);
  const resolved = custom.filter((key) =>
    DETAIL_FIELD_CATALOG.some((field) => field.key === key)
  );
  // Always include customFields so extra Lemlist vars appear
  if (!resolved.includes("customFields")) {
    resolved.push("customFields");
  }
  return resolved.length ? resolved : ALL_DETAIL_FIELDS;
}

function pushRow(
  rows: DetailRow[],
  seen: Set<string>,
  row: DetailRow,
  options?: { keepEmpty?: boolean }
) {
  if (seen.has(row.key)) return;
  if (row.isEmpty && !options?.keepEmpty) return;
  seen.add(row.key);
  rows.push(row);
}

function standardValue(
  prospect: BoardProspect,
  key: DetailFieldKey
): { value: string; href?: string; isEmpty: boolean } | null {
  switch (key) {
    case "fullName": {
      const v = getFullName(prospect);
      return { value: display(v), isEmpty: !v };
    }
    case "email": {
      const v = safeDisplayValue(prospect.email);
      return {
        value: v ?? EMPTY,
        href: v ? `mailto:${v}` : undefined,
        isEmpty: !v,
      };
    }
    case "jobTitle": {
      const v = safeDisplayValue(prospect.jobTitle);
      return { value: v ?? EMPTY, isEmpty: !v };
    }
    case "companyName": {
      const v = safeDisplayValue(prospect.companyName);
      return { value: v ?? EMPTY, isEmpty: !v };
    }
    case "linkedinUrl": {
      const v = safeDisplayValue(prospect.linkedinUrl);
      return {
        value: v ?? EMPTY,
        href: v ? (v.startsWith("http") ? v : `https://${v}`) : undefined,
        isEmpty: !v,
      };
    }
    case "phone": {
      const v = safeDisplayValue(prospect.phone);
      return {
        value: v ?? EMPTY,
        href: v ? `tel:${v}` : undefined,
        isEmpty: !v,
      };
    }
    case "companyDomain": {
      const v = safeDisplayValue(prospect.companyDomain);
      return {
        value: v ?? EMPTY,
        href: v ? (v.startsWith("http") ? v : `https://${v}`) : undefined,
        isEmpty: !v,
      };
    }
    case "emailStatus": {
      const v = safeDisplayValue(prospect.emailStatus);
      return { value: v ?? EMPTY, isEmpty: !v };
    }
    case "timezone": {
      const v = safeDisplayValue(prospect.timezone);
      return { value: v ?? EMPTY, isEmpty: !v };
    }
    case "icebreaker": {
      const v = safeDisplayValue(prospect.icebreaker);
      return { value: v ?? EMPTY, isEmpty: !v };
    }
    case "state": {
      const v = safeDisplayValue(prospect.state);
      return { value: v ?? EMPTY, isEmpty: !v };
    }
    case "lastState": {
      const v = safeDisplayValue(prospect.lastState);
      return { value: v ?? EMPTY, isEmpty: !v };
    }
    case "status": {
      const v = safeDisplayValue(prospect.status);
      return { value: v ?? EMPTY, isEmpty: !v };
    }
    case "contactId": {
      const v = safeDisplayValue(prospect.contactId);
      return { value: v ?? EMPTY, isEmpty: !v };
    }
    case "leadId": {
      const v = safeDisplayValue(prospect.leadId);
      return { value: v ?? EMPTY, isEmpty: !v };
    }
    case "opens":
      return {
        value: String(prospect.openCount ?? 0),
        isEmpty: !(prospect.openCount > 0),
      };
    case "clicks":
      return {
        value: String(prospect.clickCount ?? 0),
        isEmpty: !(prospect.clickCount > 0),
      };
    case "replied":
      return {
        value: prospect.hasReplied ? "Yes" : "No",
        isEmpty: !prospect.hasReplied,
      };
    case "inviteAccepted":
      return {
        value: prospect.hasInviteAccepted ? "Yes" : "No",
        isEmpty: !prospect.hasInviteAccepted,
      };
    default:
      return null;
  }
}

/**
 * Build detail rows from whatever data the prospect actually has.
 * - Core fields (name/email/...) always shown (— if empty)
 * - Other catalog fields only when they have data
 * - Custom Lemlist variables only when they are safe strings (objects hidden)
 */
export function buildConfiguredDetailRows(
  prospect: BoardProspect,
  enabledFields: DetailFieldKey[] = ALL_DETAIL_FIELDS
): DetailRow[] {
  const rows: DetailRow[] = [];
  const seen = new Set<string>();
  const fields =
    enabledFields.length > 0 ? enabledFields : ALL_DETAIL_FIELDS;

  const coreAlways = new Set<DetailFieldKey>(DEFAULT_DETAIL_FIELDS);

  for (const key of fields) {
    if (key === "customFields") continue;

    const def = DETAIL_FIELD_CATALOG.find((f) => f.key === key);
    if (!def) continue;

    const parsed = standardValue(prospect, key);
    if (!parsed) continue;

    pushRow(
      rows,
      seen,
      {
        key,
        label: def.label,
        value: parsed.value,
        href: parsed.href,
        isEmpty: parsed.isEmpty,
      },
      { keepEmpty: coreAlways.has(key) }
    );
  }

  // Any remaining catalog fields with data (even if not in toggles)
  for (const def of DETAIL_FIELD_CATALOG) {
    if (def.key === "customFields") continue;
    if (seen.has(def.key)) continue;
    const parsed = standardValue(prospect, def.key);
    if (!parsed || parsed.isEmpty) continue;
    pushRow(rows, seen, {
      key: def.key,
      label: def.label,
      value: parsed.value,
      href: parsed.href,
      isEmpty: false,
    });
  }

  // Custom variables — skip objects / empty / noise keys
  const customs = prospect.customFields ?? {};
  for (const [fieldKey, rawValue] of Object.entries(customs)) {
    if (HIDDEN_CUSTOM_KEYS.has(fieldKey)) continue;
    const value = safeDisplayValue(rawValue);
    if (!value) continue;

    const label = humanLabel(fieldKey);
    pushRow(rows, seen, {
      key: `custom_${fieldKey}`,
      label,
      value,
      href: linkFor(label, value),
      isEmpty: false,
    });
  }

  return rows;
}

export const DETAIL_FIELD_GROUPS: {
  id: DetailFieldDefinition["group"];
  label: string;
}[] = [
  { id: "contact", label: "Contact" },
  { id: "company", label: "Company" },
  { id: "engagement", label: "Engagement" },
  { id: "lemlist", label: "Lemlist" },
  { id: "other", label: "Other" },
];

import type { LemlistLead } from "./types";

const HOT_STATE_KEYWORDS = [
  "interested",
  "warmed",
  "meetingbooked",
  "hooked",
  "attracted",
  "emailsinterested",
  "linkedininterested",
];

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

export function computeIsHot(
  lead: Pick<
    LemlistLead,
    "status" | "lastState" | "state"
  >,
  engagement: {
    hasReplied: boolean;
    clickCount: number;
    openCount: number;
  }
): boolean {
  const tokens = [lead.status, lead.lastState, lead.state]
    .filter(Boolean)
    .map((v) => normalizeToken(String(v)));

  if (tokens.some((t) => HOT_STATE_KEYWORDS.some((k) => t.includes(k)))) {
    return true;
  }

  if (engagement.hasReplied) return true;
  if (engagement.clickCount >= 1 && engagement.openCount >= 2) return true;

  return false;
}

export interface ProspectDisplayFields {
  leadId: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  jobTitle?: string | null;
}

export function getFullName(prospect: ProspectDisplayFields): string {
  return [prospect.firstName, prospect.lastName].filter(Boolean).join(" ").trim();
}

export function getDisplayName(prospect: ProspectDisplayFields): string {
  const fullName = getFullName(prospect);
  if (fullName) return fullName;
  if (prospect.companyName?.trim()) return prospect.companyName.trim();
  if (prospect.email?.trim()) {
    return prospect.email.split("@")[0]?.replace(/[._-]/g, " ") ?? prospect.email;
  }
  return prospect.leadId;
}

export function getCardSubtitle(prospect: ProspectDisplayFields): string | null {
  const displayName = getDisplayName(prospect);
  const parts: string[] = [];

  if (prospect.jobTitle?.trim()) {
    parts.push(prospect.jobTitle.trim());
  }

  const company = prospect.companyName?.trim();
  if (company && company.toLowerCase() !== displayName.toLowerCase()) {
    parts.push(company);
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}

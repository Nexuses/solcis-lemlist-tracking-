import type {
  LemlistActivity,
  LemlistCampaign,
  LemlistLead,
} from "./types";

const BASE_URL = "https://api.lemlist.com/api";

function getAuthHeader(): string {
  const apiKey = process.env.LEMLIST_API_KEY;
  if (!apiKey) {
    throw new Error("Missing LEMLIST_API_KEY environment variable");
  }
  const token = Buffer.from(`:${apiKey}`).toString("base64");
  return `Basic ${token}`;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function lemlistFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
      ...options.headers,
    },
    cache: "no-store",
  });

  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("Retry-After") ?? "2");
    await sleep(retryAfter * 1000);
    return lemlistFetch<T>(path, options);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Lemlist API error ${response.status}: ${body}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function getCampaigns(): Promise<LemlistCampaign[]> {
  const campaigns: LemlistCampaign[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const batch = await lemlistFetch<LemlistCampaign[]>(
      `/campaigns?limit=${limit}&offset=${offset}`
    );
    if (!batch.length) break;
    campaigns.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
    await sleep(150);
  }

  return campaigns;
}

function normalizeLead(raw: LemlistLead): LemlistLead {
  const variables = raw.variables ?? {};
  const vars = variables as Record<string, string>;
  const combinedName = vars.name ?? vars.Name ?? vars.fullName;

  let firstName: string | undefined =
    raw.firstName ?? vars.firstName ?? vars.first_name ?? undefined;
  let lastName: string | undefined =
    raw.lastName ?? vars.lastName ?? vars.last_name ?? undefined;

  if (!firstName && !lastName && combinedName) {
    const parts = combinedName.trim().split(/\s+/).filter(Boolean);
    firstName = parts[0];
    lastName = parts.length > 1 ? parts.slice(1).join(" ") : undefined;
  }

  const email =
    raw.email ?? vars.email ?? vars.Email;

  return {
    ...raw,
    email: email?.trim() || undefined,
    firstName: firstName?.trim() || undefined,
    lastName: lastName?.trim() || undefined,
    companyName:
      raw.companyName ?? vars.companyName ?? vars.company,
    jobTitle: raw.jobTitle ?? vars.jobTitle,
    state: pickFirst(raw.state, raw.lastState, vars.state, vars.lastState),
    lastState: pickFirst(raw.lastState, raw.state, vars.lastState, vars.state),
    status: pickFirst(raw.status, vars.status),
  };
}

function pickFirst(
  ...values: Array<string | undefined | null>
): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

function parseExportLeads(data: unknown): LemlistLead[] {
  if (Array.isArray(data)) {
    return data as LemlistLead[];
  }
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    if (Array.isArray(record.leads)) return record.leads as LemlistLead[];
    if (Array.isArray(record.data)) return record.data as LemlistLead[];
  }
  return [];
}

async function getCampaignLeadIds(campaignId: string): Promise<LemlistLead[]> {
  const leads: LemlistLead[] = [];
  let offset = 0;
  const limit = 500;

  while (true) {
    const batch = await lemlistFetch<LemlistLead[]>(
      `/campaigns/${campaignId}/leads/?limit=${limit}&offset=${offset}`
    );
    if (!batch.length) break;
    leads.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
    await sleep(150);
  }

  return leads;
}

async function enrichLeadDetails(lead: LemlistLead): Promise<LemlistLead> {
  const normalized = normalizeLead(lead);

  if (
    normalized.firstName &&
    normalized.linkedinUrl &&
    normalized.phone &&
    normalized.jobTitle
  ) {
    return normalized;
  }

  try {
    const full = await getLeadById(lead._id);
    if (
      full.firstName ||
      full.lastName ||
      full.email ||
      full.linkedinUrl ||
      full.phone
    ) {
      return {
        ...normalized,
        ...full,
        email: full.email ?? normalized.email,
        firstName: full.firstName ?? normalized.firstName,
        lastName: full.lastName ?? normalized.lastName,
        companyName: full.companyName ?? normalized.companyName,
        jobTitle: full.jobTitle ?? normalized.jobTitle,
        linkedinUrl: full.linkedinUrl ?? normalized.linkedinUrl,
        phone: full.phone ?? normalized.phone,
        picture: full.picture ?? normalized.picture,
        companyDomain: full.companyDomain ?? normalized.companyDomain,
        emailStatus: full.emailStatus ?? normalized.emailStatus,
        timezone: full.timezone ?? normalized.timezone,
        icebreaker: full.icebreaker ?? normalized.icebreaker,
        state: full.state ?? normalized.state,
        lastState: full.lastState ?? normalized.lastState,
        status: full.status ?? normalized.status,
        variables: { ...normalized.variables, ...full.variables },
      };
    }
  } catch {
    // Keep export data
  }

  return normalized;
}

/** Full lead details including email and name. */
export async function exportCampaignLeads(
  campaignId: string
): Promise<LemlistLead[]> {
  let leads: LemlistLead[] = [];

  try {
    const response = await fetch(
      `${BASE_URL}/campaigns/${campaignId}/export/leads?state=all&format=json`,
      {
        headers: {
          Authorization: getAuthHeader(),
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    if (response.ok) {
      const data = (await response.json()) as unknown;
      leads = parseExportLeads(data).map(normalizeLead);
    }
  } catch {
    leads = [];
  }

  if (leads.length === 0) {
    leads = await getCampaignLeadIds(campaignId);
  }

  const enriched: LemlistLead[] = [];
  for (const lead of leads) {
    enriched.push(await enrichLeadDetails(lead));
    await sleep(120);
  }

  return enriched;
}

export async function getCampaignActivities(
  campaignId: string
): Promise<LemlistActivity[]> {
  const activities: LemlistActivity[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const batch = await lemlistFetch<LemlistActivity[]>(
      `/activities?campaignId=${encodeURIComponent(campaignId)}&version=v2&limit=${limit}&offset=${offset}`
    );
    if (!Array.isArray(batch) || !batch.length) break;
    activities.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
    await sleep(150);
  }

  return activities;
}

export async function getLeadById(leadId: string): Promise<LemlistLead> {
  const data = await lemlistFetch<LemlistLead | LemlistLead[]>(
    `/leads?id=${encodeURIComponent(leadId)}&version=v2`
  );
  const lead = Array.isArray(data) ? data[0] : data;
  if (!lead?._id) {
    throw new Error(`Lead not found: ${leadId}`);
  }
  return normalizeLead(lead);
}

export async function registerWebhook(
  targetUrl: string,
  campaignId: string
): Promise<{ _id: string }> {
  return lemlistFetch<{ _id: string }>(
    `/hooks?campaignId=${encodeURIComponent(campaignId)}`,
    {
      method: "POST",
      body: JSON.stringify({ targetUrl }),
    }
  );
}

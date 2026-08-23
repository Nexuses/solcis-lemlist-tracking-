/** Minimal CSV parser that handles quotes and commas. */

export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n").filter((line) => line.trim().length > 0);
  if (!lines.length) return { headers: [], rows: [] };

  const parsed = lines.map(parseCsvLine);
  const headers = parsed[0].map((h) => h.trim());
  const rows = parsed.slice(1).filter((row) => row.some((cell) => cell.trim()));
  return { headers, rows };
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

export function rowsToObjects(
  headers: string[],
  rows: string[][]
): Record<string, string>[] {
  return rows.map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((header, index) => {
      const key = header.trim();
      if (!key) return;
      obj[key] = (row[index] ?? "").trim();
    });
    return obj;
  });
}

export const IMPORT_FIELD_OPTIONS = [
  { key: "skip", label: "— Skip —" },
  { key: "email", label: "Email" },
  { key: "firstName", label: "First name" },
  { key: "lastName", label: "Last name" },
  { key: "fullName", label: "Full name" },
  { key: "companyName", label: "Company name" },
  { key: "jobTitle", label: "Job title" },
  { key: "phone", label: "Phone" },
  { key: "linkedinUrl", label: "LinkedIn URL" },
  { key: "companyDomain", label: "Company domain" },
  { key: "custom", label: "Custom field" },
] as const;

export type ImportFieldKey = (typeof IMPORT_FIELD_OPTIONS)[number]["key"];

export function guessMapping(header: string): ImportFieldKey {
  const h = header.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (["email", "emailaddress", "mail"].includes(h)) return "email";
  if (["firstname", "first", "fname", "givenname"].includes(h)) return "firstName";
  if (["lastname", "last", "lname", "surname", "familyname"].includes(h))
    return "lastName";
  if (["fullname", "fullname", "contactname"].includes(h)) return "fullName";
  if (["company", "companyname", "organization", "org"].includes(h))
    return "companyName";
  if (["title", "jobtitle", "position", "role"].includes(h)) return "jobTitle";
  if (["phone", "mobile", "phonenumber", "tel"].includes(h)) return "phone";
  if (["linkedin", "linkedinurl", "linkedinprofile", "liurl"].includes(h))
    return "linkedinUrl";
  if (["domain", "companydomain", "website", "web"].includes(h))
    return "companyDomain";
  return "custom";
}

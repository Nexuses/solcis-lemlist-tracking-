import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import {
  resolveKanbanColumns,
  type AutomationKanbanColumn,
} from "@/lib/kanban-config";
import {
  ensureIndexes,
  getAutomationsCollection,
  getProspectsCollection,
} from "@/lib/mongodb";
import type { EngagementStage, Prospect } from "@/lib/types";

type RouteContext = { params: Promise<{ slug: string }> };

type MappableField =
  | "email"
  | "firstName"
  | "lastName"
  | "fullName"
  | "companyName"
  | "jobTitle"
  | "phone"
  | "linkedinUrl"
  | "companyDomain"
  | "custom"
  | "skip";

interface ImportRow {
  [key: string]: string;
}

function stageForColumn(column: AutomationKanbanColumn): EngagementStage {
  if (column.rule.type === "stages" && column.rule.stages.length) {
    return column.rule.stages[column.rule.stages.length - 1];
  }
  return "prospect";
}

function splitFullName(fullName: string): {
  firstName?: string;
  lastName?: string;
} {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return {};
  if (parts.length === 1) return { firstName: parts[0] };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function mapRow(
  row: ImportRow,
  mapping: Record<string, MappableField>
): {
  email?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  jobTitle?: string;
  phone?: string;
  linkedinUrl?: string;
  companyDomain?: string;
  customFields: Record<string, string>;
} {
  const customFields: Record<string, string> = {};
  let email: string | undefined;
  let firstName: string | undefined;
  let lastName: string | undefined;
  let companyName: string | undefined;
  let jobTitle: string | undefined;
  let phone: string | undefined;
  let linkedinUrl: string | undefined;
  let companyDomain: string | undefined;
  let fullName: string | undefined;

  for (const [csvHeader, field] of Object.entries(mapping)) {
    const value = String(row[csvHeader] ?? "").trim();
    if (!value || field === "skip") continue;

    switch (field) {
      case "email":
        email = value;
        break;
      case "firstName":
        firstName = value;
        break;
      case "lastName":
        lastName = value;
        break;
      case "fullName":
        fullName = value;
        break;
      case "companyName":
        companyName = value;
        break;
      case "jobTitle":
        jobTitle = value;
        break;
      case "phone":
        phone = value;
        break;
      case "linkedinUrl":
        linkedinUrl = value;
        break;
      case "companyDomain":
        companyDomain = value;
        break;
      case "custom":
        customFields[csvHeader] = value;
        break;
      default:
        break;
    }
  }

  if (fullName && !firstName && !lastName) {
    const split = splitFullName(fullName);
    firstName = split.firstName;
    lastName = split.lastName;
  }

  return {
    email,
    firstName,
    lastName,
    companyName,
    jobTitle,
    phone,
    linkedinUrl,
    companyDomain,
    customFields,
  };
}

function normalizeEmail(value?: string): string | null {
  const v = value?.trim().toLowerCase();
  return v || null;
}

function normalizeLinkedIn(value?: string): string | null {
  if (!value?.trim()) return null;
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

function normalizePhone(value?: string): string | null {
  if (!value?.trim()) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 ? digits : null;
}

function normalizeNameKey(
  firstName?: string,
  lastName?: string,
  companyName?: string
): string | null {
  const name = [firstName, lastName]
    .filter(Boolean)
    .join(" ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  const company = companyName?.trim().toLowerCase() ?? "";
  if (!name) return null;
  return `${name}|${company}`;
}

function identityKeys(person: {
  email?: string;
  linkedinUrl?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
}): string[] {
  const keys: string[] = [];
  const email = normalizeEmail(person.email);
  const linkedin = normalizeLinkedIn(person.linkedinUrl);
  const phone = normalizePhone(person.phone);
  const nameKey = normalizeNameKey(
    person.firstName,
    person.lastName,
    person.companyName
  );

  if (email) keys.push(`email:${email}`);
  if (linkedin) keys.push(`li:${linkedin}`);
  if (phone) keys.push(`phone:${phone}`);
  // Name+company only when no stronger identity is present
  if (nameKey && !email && !linkedin) keys.push(`name:${nameKey}`);
  return keys;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const body = await request.json();
    const columnId = String(body.columnId ?? "").trim();
    const rows = body.rows as ImportRow[] | undefined;
    const mapping = body.mapping as Record<string, MappableField> | undefined;

    if (!columnId) {
      return NextResponse.json(
        { error: "Target stage is required" },
        { status: 400 }
      );
    }
    if (!rows?.length) {
      return NextResponse.json({ error: "No rows to import" }, { status: 400 });
    }
    if (!mapping || !Object.keys(mapping).length) {
      return NextResponse.json(
        { error: "Column mapping is required" },
        { status: 400 }
      );
    }
    if (rows.length > 2000) {
      return NextResponse.json(
        { error: "Import is limited to 2000 rows at a time" },
        { status: 400 }
      );
    }

    await ensureIndexes();
    const automations = await getAutomationsCollection();
    const prospectsCol = await getProspectsCollection();
    const automation = await automations.findOne({ slug });

    if (!automation) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    const columns = resolveKanbanColumns(
      automation.kanbanColumns,
      automation.channelType ?? "email"
    );
    const targetColumn = columns.find((col) => col.id === columnId);
    if (!targetColumn) {
      return NextResponse.json({ error: "Stage not found" }, { status: 404 });
    }

    const automationId = String(automation._id);
    const existing = await prospectsCol
      .find(
        { automationId },
        {
          projection: {
            email: 1,
            linkedinUrl: 1,
            phone: 1,
            firstName: 1,
            lastName: 1,
            companyName: 1,
          },
        }
      )
      .toArray();

    const seenKeys = new Set<string>();
    for (const prospect of existing) {
      for (const key of identityKeys(prospect)) {
        seenKeys.add(key);
      }
    }

    const stage = stageForColumn(targetColumn);
    const now = new Date();
    let imported = 0;
    let skippedEmpty = 0;
    let skippedDuplicates = 0;

    const ops = [];

    for (const row of rows) {
      const mapped = mapRow(row, mapping);
      if (
        !mapped.email &&
        !mapped.firstName &&
        !mapped.lastName &&
        !mapped.companyName &&
        !mapped.linkedinUrl
      ) {
        skippedEmpty += 1;
        continue;
      }

      const keys = identityKeys(mapped);
      const isDuplicate =
        keys.length > 0 && keys.some((key) => seenKeys.has(key));

      if (isDuplicate) {
        skippedDuplicates += 1;
        continue;
      }

      // Reserve keys so duplicates within the same CSV are also skipped
      for (const key of keys) {
        seenKeys.add(key);
      }

      const leadId = `imp_${nanoid(12)}`;
      const prospect: Omit<Prospect, "_id"> = {
        automationId,
        leadId,
        email: mapped.email,
        firstName: mapped.firstName,
        lastName: mapped.lastName,
        companyName: mapped.companyName,
        jobTitle: mapped.jobTitle,
        phone: mapped.phone,
        linkedinUrl: mapped.linkedinUrl,
        companyDomain: mapped.companyDomain,
        customFields: mapped.customFields,
        assignedColumnId: columnId,
        stage,
        openCount: 0,
        clickCount: 0,
        hasReplied: stage === "replied",
        hasInviteAccepted: stage === "inviteAccepted",
        isHot: false,
        updatedAt: now,
        lastActivityAt: now,
      };

      ops.push({
        insertOne: { document: prospect },
      });
      imported += 1;
    }

    if (ops.length > 0) {
      await prospectsCol.bulkWrite(ops);
      await automations.updateOne(
        { _id: automation._id },
        { $inc: { prospectCount: imported } }
      );
    }

    return NextResponse.json({
      imported,
      skipped: skippedEmpty + skippedDuplicates,
      skippedEmpty,
      skippedDuplicates,
      columnId,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to import CSV";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

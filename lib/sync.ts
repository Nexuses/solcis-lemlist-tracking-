import { ObjectId } from "mongodb";
import { computeEngagementFromActivities } from "./engagement";
import {
  exportCampaignLeads,
  getCampaignActivities,
  registerWebhook,
} from "./lemlist";
import {
  ensureIndexes,
  getAutomationsCollection,
  getProspectsCollection,
} from "./mongodb";
import { computeIsHot } from "./hot-lead";
import {
  resolveKanbanColumns,
  type AutomationKanbanColumn,
} from "./kanban-config";
import type { LemlistActivity } from "./types";
import { leadToProspectBase } from "./prospect-fields";

function groupActivitiesByLead(
  activities: LemlistActivity[]
): Map<string, LemlistActivity[]> {
  const map = new Map<string, LemlistActivity[]>();
  for (const activity of activities) {
    if (!activity.leadId) continue;
    const list = map.get(activity.leadId) ?? [];
    list.push(activity);
    map.set(activity.leadId, list);
  }
  return map;
}

function shouldKeepManualAssignment(
  assignedColumnId: string | undefined,
  columns: AutomationKanbanColumn[],
  leadId?: string
): boolean {
  if (!assignedColumnId) return false;
  // CSV / manual imports always keep their stage placement
  if (leadId?.startsWith("imp_")) return true;
  const column = columns.find((col) => col.id === assignedColumnId);
  return column?.rule.type === "manual";
}

export async function syncAutomation(
  automationId: string,
  options?: { registerWebhook?: boolean; appUrl?: string }
): Promise<{ prospectCount: number }> {
  await ensureIndexes();

  const automations = await getAutomationsCollection();
  const prospectsCol = await getProspectsCollection();

  const automation = await automations.findOne({
    _id: new ObjectId(automationId),
  });

  if (!automation) {
    throw new Error("Automation not found");
  }

  const columns = resolveKanbanColumns(
    automation.kanbanColumns,
    automation.channelType ?? "email"
  );

  const [leads, activities] = await Promise.all([
    exportCampaignLeads(automation.campaignId),
    getCampaignActivities(automation.campaignId),
  ]);

  const activitiesByLead = groupActivitiesByLead(activities);
  const now = new Date();

  if (leads.length === 0) {
    await automations.updateOne(
      { _id: automation._id },
      { $set: { lastSyncedAt: now, prospectCount: 0 } }
    );
    return { prospectCount: 0 };
  }

  const existingAssignments = await prospectsCol
    .find(
      { automationId: String(automation._id) },
      { projection: { leadId: 1, assignedColumnId: 1 } }
    )
    .toArray();
  const assignmentByLead = new Map(
    existingAssignments.map((p) => [p.leadId, p.assignedColumnId])
  );

  const bulkOps = leads.map((lead) => {
    const leadActivities = activitiesByLead.get(lead._id) ?? [];
    const engagement = computeEngagementFromActivities(leadActivities, lead);

    const prospect = leadToProspectBase(lead, String(automation._id), {
      stage: engagement.stage,
      openCount: engagement.openCount,
      clickCount: engagement.clickCount,
      hasReplied: engagement.hasReplied,
      hasInviteAccepted: engagement.hasInviteAccepted,
      lastActivityAt: engagement.lastActivityAt,
      isHot: computeIsHot(lead, engagement),
    });

    const assignedColumnId = assignmentByLead.get(lead._id);
    // Only keep drag placement on manual custom stages.
    // Auto stages follow Lemlist lead state on sync so counts match reports.
    const keepManual = shouldKeepManualAssignment(
      assignedColumnId,
      columns,
      lead._id
    );
    if (keepManual) {
      prospect.assignedColumnId = assignedColumnId;
    }

    const update: {
      $set: typeof prospect;
      $unset?: { assignedColumnId: "" };
    } = { $set: prospect };

    if (!keepManual) {
      update.$unset = { assignedColumnId: "" };
    }

    return {
      updateOne: {
        filter: { automationId: String(automation._id), leadId: lead._id },
        update,
        upsert: true,
      },
    };
  });

  if (bulkOps.length > 0) {
    await prospectsCol.bulkWrite(bulkOps);
  }

  await automations.updateOne(
    { _id: automation._id },
    { $set: { lastSyncedAt: now, prospectCount: leads.length } }
  );

  if (options?.registerWebhook && options.appUrl) {
    const webhookUrl = `${options.appUrl}/api/webhooks/lemlist/${automationId}`;
    try {
      await registerWebhook(webhookUrl, automation.campaignId);
    } catch {
      // Webhook may already exist; sync still succeeds
    }
  }

  return { prospectCount: leads.length };
}

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import {
  isEngagementEvent,
  maxStage,
  stageFromWebhookEvent,
} from "@/lib/engagement";
import { computeIsHot } from "@/lib/hot-lead";
import {
  ensureIndexes,
  getAutomationsCollection,
  getProspectsCollection,
} from "@/lib/mongodb";
import { getLeadById } from "@/lib/lemlist";
import type { Prospect } from "@/lib/types";

type RouteContext = { params: Promise<{ automationId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { automationId } = await context.params;
    if (!ObjectId.isValid(automationId)) {
      return NextResponse.json({ error: "Invalid automation id" }, { status: 400 });
    }

    const payload = await request.json();
    const type = payload.type as string | undefined;
    const leadId = payload.leadId as string | undefined;
    const campaignId = payload.campaignId as string | undefined;

    if (!type || !leadId) {
      return NextResponse.json({ received: true });
    }

    if (!isEngagementEvent(type)) {
      return NextResponse.json({ received: true });
    }

    await ensureIndexes();
    const automations = await getAutomationsCollection();
    const prospectsCol = await getProspectsCollection();

    const automation = await automations.findOne({
      _id: new ObjectId(automationId),
    });

    if (!automation) {
      return NextResponse.json({ error: "Automation not found" }, { status: 404 });
    }

    if (campaignId && campaignId !== automation.campaignId) {
      return NextResponse.json({ received: true });
    }

    const eventStage = stageFromWebhookEvent(type);
    if (!eventStage) {
      return NextResponse.json({ received: true });
    }

    const existing = await prospectsCol.findOne({
      automationId,
      leadId,
    });

    const now = new Date();
    const openDelta =
      type === "emailsOpened" || type === "linkedinOpened" ? 1 : 0;
    const clickDelta = type === "emailsClicked" ? 1 : 0;
    const inviteAccepted =
      type === "linkedinInviteAccepted" ? true : false;
    const repliedDelta =
      type === "emailsReplied" ||
      type === "linkedinReplied" ||
      type === "whatsappReplied";

    if (existing) {
      const nextStage = maxStage(existing.stage, eventStage);
      const openCount = existing.openCount + openDelta;
      const clickCount = existing.clickCount + clickDelta;
      const hasReplied = existing.hasReplied || repliedDelta;
      const hasInviteAccepted =
        existing.hasInviteAccepted === true || inviteAccepted;
      const isHot = computeIsHot(
        {
          status: existing.status,
          lastState: existing.lastState,
          state: existing.state,
        },
        { hasReplied, clickCount, openCount }
      );

      await prospectsCol.updateOne(
        { automationId, leadId },
        {
          $set: {
            stage: nextStage,
            hasReplied,
            hasInviteAccepted,
            isHot,
            lastActivityAt: now,
            updatedAt: now,
          },
          $inc: {
            openCount: openDelta,
            clickCount: clickDelta,
          },
        }
      );
    } else {
      let leadDetails = {
        email: payload.email as string | undefined,
        firstName: payload.firstName as string | undefined,
        lastName: payload.lastName as string | undefined,
        companyName: payload.companyName as string | undefined,
      };

      try {
        const lead = await getLeadById(leadId);
        leadDetails = {
          email: lead.email,
          firstName: lead.firstName,
          lastName: lead.lastName,
          companyName: lead.companyName,
        };
      } catch {
        // Use webhook payload only
      }

      const prospect: Omit<Prospect, "_id"> = {
        automationId,
        leadId,
        email: leadDetails.email,
        firstName: leadDetails.firstName,
        lastName: leadDetails.lastName,
        companyName: leadDetails.companyName,
        stage: eventStage,
        openCount: openDelta,
        clickCount: clickDelta,
        hasReplied: repliedDelta,
        hasInviteAccepted: inviteAccepted,
        isHot: computeIsHot(
          {},
          {
            hasReplied: repliedDelta,
            clickCount: clickDelta,
            openCount: openDelta,
          }
        ),
        lastActivityAt: now,
        updatedAt: now,
      };

      await prospectsCol.insertOne(prospect);
      await automations.updateOne(
        { _id: automation._id },
        { $inc: { prospectCount: 1 } }
      );
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Webhook processing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

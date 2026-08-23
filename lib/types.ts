import type { ObjectId } from "mongodb";
import type { AutomationChannel, AutomationKanbanColumn } from "./kanban-config";
import type { DetailFieldKey } from "./detail-fields";

export type EngagementStage =
  | "prospect"
  | "contacted"
  | "inviteAccepted"
  | "opened"
  | "clicked"
  | "replied";

export interface Automation {
  _id?: ObjectId;
  name: string;
  slug: string;
  campaignId: string;
  campaignName: string;
  /** email = opens/clicks board; linkedin = LI funnel columns */
  channelType?: AutomationChannel;
  kanbanColumns?: AutomationKanbanColumn[];
  detailFields?: DetailFieldKey[];
  createdAt: Date;
  lastSyncedAt?: Date;
  prospectCount?: number;
}

export interface Prospect {
  _id?: ObjectId;
  automationId: string;
  leadId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  jobTitle?: string;
  companyDomain?: string;
  phone?: string;
  linkedinUrl?: string;
  picture?: string;
  emailStatus?: string;
  timezone?: string;
  icebreaker?: string;
  state?: string;
  lastState?: string;
  status?: string;
  contactId?: string;
  customFields?: Record<string, string>;
  isHot?: boolean;
  assignedColumnId?: string;
  stage: EngagementStage;
  openCount: number;
  clickCount: number;
  hasReplied: boolean;
  hasInviteAccepted?: boolean;
  lastActivityAt?: Date;
  updatedAt: Date;
}

export interface LemlistCampaign {
  _id: string;
  name: string;
  status?: string;
}

export interface LemlistLead {
  _id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  jobTitle?: string;
  companyDomain?: string;
  phone?: string;
  linkedinUrl?: string;
  picture?: string;
  emailStatus?: string;
  timezone?: string;
  icebreaker?: string;
  state?: string;
  lastState?: string;
  status?: string;
  contactId?: string;
  variables?: Record<string, string>;
  [key: string]: unknown;
}

export interface LemlistActivity {
  _id: string;
  type: string;
  leadId: string;
  campaignId: string;
  createdAt: string;
}

import { MongoClient, Db, Collection } from "mongodb";
import type { User } from "./auth";
import type { Automation, Prospect } from "./types";

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function getUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Missing MONGODB_URI environment variable");
  }
  return uri;
}

function getClientPromise(): Promise<MongoClient> {
  const uri = getUri();

  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      const client = new MongoClient(uri);
      global._mongoClientPromise = client.connect();
    }
    return global._mongoClientPromise;
  }

  const client = new MongoClient(uri);
  return client.connect();
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise();
  return client.db(process.env.MONGODB_DB ?? "lemlist-tracker");
}

export async function getAutomationsCollection(): Promise<
  Collection<Automation>
> {
  const db = await getDb();
  return db.collection<Automation>("automations");
}

export async function getProspectsCollection(): Promise<Collection<Prospect>> {
  const db = await getDb();
  return db.collection<Prospect>("prospects");
}

export async function getUsersCollection(): Promise<Collection<User>> {
  const db = await getDb();
  return db.collection<User>("users");
}

export async function ensureIndexes(): Promise<void> {
  const automations = await getAutomationsCollection();
  const prospects = await getProspectsCollection();
  const users = await getUsersCollection();

  await automations.createIndex({ slug: 1 }, { unique: true });
  await automations.createIndex({ campaignId: 1 });
  await prospects.createIndex(
    { automationId: 1, leadId: 1 },
    { unique: true }
  );
  await prospects.createIndex({ automationId: 1, stage: 1 });
  await users.createIndex({ email: 1 }, { unique: true });
}

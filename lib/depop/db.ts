import { db } from "@/lib/db";
import {
  decryptDepopApiKey,
  parseConnectionSettings,
  parseStoredCredentials,
  type DepopConnectionSettings,
} from "./credentials";
import type { DepopEnvironment } from "./status";

export type UserDepopClient = {
  apiKey: string;
  environment: DepopEnvironment;
  settings: DepopConnectionSettings;
};

export async function getUserDepopClient(userId: string): Promise<UserDepopClient | null> {
  const connection = await db.platformconnection.findUnique({
    where: { userId_platformId: { userId, platformId: "depop" } },
  });
  if (!connection?.isEnabled) return null;
  const stored = parseStoredCredentials(connection.credentials);
  if (!stored) return null;
  return {
    apiKey: decryptDepopApiKey(stored.apiKey),
    environment: stored.environment,
    settings: parseConnectionSettings(connection.settings),
  };
}

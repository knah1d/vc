import { Expo, type ExpoPushMessage } from "expo-server-sdk";
import { prisma } from "./prisma.js";

const expo = new Expo();

// Reaches a user who has no live socket connection (backgrounded or killed
// app) — used for things like an incoming call ring or a new message. Uses
// Expo's push service, which proxies FCM/APNs, so no separate Firebase
// project or credentials are needed on our side.
export async function pushToUser(userId: string, message: Omit<ExpoPushMessage, "to">) {
  const devices = await prisma.deviceToken.findMany({ where: { userId } });
  const validTokens = devices.filter((d) => Expo.isExpoPushToken(d.token));
  if (validTokens.length === 0) return;

  const messages: ExpoPushMessage[] = validTokens.map((d) => ({ to: d.token, ...message }));
  const chunks = expo.chunkPushNotifications(messages);
  const invalidTokens: string[] = [];

  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      for (const ticket of tickets) {
        if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered" && ticket.details.expoPushToken) {
          invalidTokens.push(ticket.details.expoPushToken);
        }
      }
    } catch (error) {
      console.error("Push send failed", error instanceof Error ? error.message : "Unknown error");
    }
  }

  if (invalidTokens.length > 0) {
    await prisma.deviceToken.deleteMany({ where: { token: { in: invalidTokens } } });
  }
}

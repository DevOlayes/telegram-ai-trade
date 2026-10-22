import { definePlugin } from "nitro";
import { db } from "../src/lib/nexora/core.server";
import { runTick } from "../src/lib/nexora/settlement.server";
import { ensureTelegramWebhook } from "../src/lib/nexora/telegram.server";

type ScheduledEvent = {
  controller: { scheduledTime: number; cron: string };
  env: { ENABLE_SCHEDULED_TICK?: string };
};

export default definePlugin((nitroApp) => {
  nitroApp.hooks.hook("cloudflare:scheduled", async (rawEvent) => {
    const { controller, env } = rawEvent as unknown as ScheduledEvent;

    try {
      const webhookStatus = await ensureTelegramWebhook();
      await db().from("system_settings").upsert({
        key: "telegram_webhook_health",
        value: { checked_at: new Date().toISOString(), ...webhookStatus },
      });
      console.log("Telegram webhook check", webhookStatus);
    } catch (error) {
      console.error("Telegram webhook registration check failed", error);
    }

    if (env.ENABLE_SCHEDULED_TICK !== "true") return;

    try {
      const result = await runTick();
      console.log("nexora scheduled tick completed", {
        cron: controller.cron,
        scheduledTime: controller.scheduledTime,
        ...result,
      });
    } catch (error) {
      console.error("nexora scheduled tick failed", error);
      throw error;
    }
  });
});

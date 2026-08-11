import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(context: { supabase: { rpc: Function }; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Forbidden");
}

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { db } = await import("@/lib/nexora/core.server");
    const [users, trades, withdrawals, referrals, settings] = await Promise.all([
      db()
        .from("users")
        .select("id,telegram_id,username,created_at,bonus_claimed,status,flagged_reason,referral_code")
        .order("created_at", { ascending: false })
        .limit(100),
      db()
        .from("trades")
        .select("id,user_id,symbol,direction,amount,entry_price,take_profit,stop_loss,duration_minutes,result,pnl,status,opened_at")
        .order("opened_at", { ascending: false })
        .limit(100),
      db()
        .from("withdrawals")
        .select("id,user_id,amount,wallet_address,network,status,created_at,service_fee_amount,service_fee_status,service_fee_tx")
        .order("created_at", { ascending: false })
        .limit(100),
      db()
        .from("referrals")
        .select("id,referrer_id,referred_id,status,reward_amount,qualified_at")
        .order("created_at", { ascending: false })
        .limit(100),
      db().from("system_settings").select("key,value").order("key"),
    ]);
    const balances = await db().from("balances").select("user_id,balance,profit,referral_balance");
    return {
      users: users.data ?? [],
      trades: trades.data ?? [],
      withdrawals: withdrawals.data ?? [],
      referrals: referrals.data ?? [],
      settings: settings.data ?? [],
      balances: balances.data ?? [],
    };
  });

export const updateSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ key: z.string(), value: z.string() }).parse(i))
  .handler(async ({ context, data }) => {
    await assertAdmin(context as never);
    const { db } = await import("@/lib/nexora/core.server");
    let parsed: unknown;
    try {
      parsed = JSON.parse(data.value);
    } catch {
      throw new Error("Value must be valid JSON (e.g. 25, true, [30,60], \"market\")");
    }
    await db()
      .from("system_settings")
      .upsert({ key: data.key, value: parsed as object, updated_at: new Date().toISOString() });
    await db().from("admin_actions").insert({
      admin_id: (context as { userId: string }).userId,
      action: "update_setting",
      target: data.key,
      payload: { value: parsed } as object,
    });
    return { ok: true };
  });

export const setWithdrawalStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["pending", "paid", "rejected"]) }).parse(i),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context as never);
    const { db, usd, applyBalance } = await import("@/lib/nexora/core.server");
    const { editMessage, sendMessage } = await import("@/lib/nexora/telegram.server");
    const { data: wd } = await db()
      .from("withdrawals")
      .select("id,user_id,amount,status,message_id,wallet_address")
      .eq("id", data.id)
      .single();
    if (!wd || wd.status === data.status) return { ok: true };

    await db()
      .from("withdrawals")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.id);

    if (data.status === "rejected") {
      await applyBalance(
        wd.user_id,
        { balance: Number(wd.amount), profit: Number(wd.amount) },
        { kind: "withdrawal_refund", amount: Number(wd.amount), ref_id: wd.id },
      );
    }

    const { data: user } = await db()
      .from("users")
      .select("telegram_id")
      .eq("id", wd.user_id)
      .maybeSingle();
    if (user) {
      const text =
        data.status === "paid"
          ? `✅ WITHDRAWAL SENT\n\nAmount:\n${usd(wd.amount)}\n\nNetwork:\nTRON (TRC-20)\n\nWallet:\n${wd.wallet_address}\n\nStatus:\nPaid`
          : data.status === "rejected"
            ? `⚠️ WITHDRAWAL REJECTED\n\nAmount:\n${usd(wd.amount)}\n\nThe amount has been returned to your balance.`
            : `⏳ WITHDRAWAL PROCESSING\n\nAmount:\n${usd(wd.amount)}\n\nStatus:\nPending`;
      if (wd.message_id) await editMessage(user.telegram_id, wd.message_id, text);
      else await sendMessage(user.telegram_id, text);
    }

    await db().from("admin_actions").insert({
      admin_id: (context as { userId: string }).userId,
      action: "withdrawal_status",
      target: data.id,
      payload: { status: data.status } as object,
    });
    return { ok: true };
  });

export const setUserStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["active", "blocked"]) }).parse(i),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context as never);
    const { db } = await import("@/lib/nexora/core.server");
    await db().from("users").update({ status: data.status }).eq("id", data.id);
    await db().from("admin_actions").insert({
      admin_id: (context as { userId: string }).userId,
      action: "user_status",
      target: data.id,
      payload: { status: data.status } as object,
    });
    return { ok: true };
  });

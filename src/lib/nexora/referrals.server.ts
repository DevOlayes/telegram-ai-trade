// Referral engine: qualification, rewards, milestones.
import { applyBalance, db, getSettings, usd } from "./core.server";
import { sendMessage, kb } from "./telegram.server";

export async function referralStats(userId: string) {
  const { data: refs } = await db()
    .from("referrals")
    .select("status")
    .eq("referrer_id", userId);
  const { data: rewards } = await db()
    .from("referral_rewards")
    .select("amount")
    .eq("user_id", userId);
  const active = (refs ?? []).filter((r) => r.status === "active").length;
  const { data: milestones } = await db()
    .from("milestones")
    .select("id,active_referrals,reward_amount")
    .eq("active", true)
    .order("active_referrals");
  const next = (milestones ?? []).find((m) => m.active_referrals > active) ?? null;
  return {
    invited: refs?.length ?? 0,
    active,
    rewards: (rewards ?? []).reduce((a, r) => a + Number(r.amount), 0),
    next,
  };
}

/**
 * Called after a referred user completes qualifying activity
 * (bonus claimed + N settled trades, configurable).
 */
export async function qualifyReferral(referredUserId: string) {
  const s = await getSettings();
  const { data: ref } = await db()
    .from("referrals")
    .select("id,referrer_id,status")
    .eq("referred_id", referredUserId)
    .maybeSingle();
  if (!ref || ref.status !== "pending") return;
  if (ref.referrer_id === referredUserId) return; // no self-referrals

  const { count } = await db()
    .from("trades")
    .select("id", { count: "exact", head: true })
    .eq("user_id", referredUserId)
    .eq("status", "settled");
  if ((count ?? 0) < Number(s.qualify_trades ?? 1)) return;

  const { data: referredUser } = await db()
    .from("users")
    .select("bonus_claimed")
    .eq("id", referredUserId)
    .maybeSingle();
  if (!referredUser?.bonus_claimed) return;

  await db()
    .from("referrals")
    .update({
      status: "active",
      qualified_at: new Date().toISOString(),
      reward_amount: s.referral_reward,
    })
    .eq("id", ref.id);
  await db().from("referral_rewards").insert({
    user_id: ref.referrer_id,
    referral_id: ref.id,
    amount: s.referral_reward,
  });
  await applyBalance(
    ref.referrer_id,
    { referral_balance: s.referral_reward },
    { kind: "referral_reward", amount: s.referral_reward, ref_id: ref.id },
  );

  const { data: referrer } = await db()
    .from("users")
    .select("telegram_id")
    .eq("id", ref.referrer_id)
    .maybeSingle();
  if (referrer) {
    await sendMessage(
      referrer.telegram_id,
      `✅ REFERRAL QUALIFIED\n\nYou earned ${usd(s.referral_reward)}.`,
    );
  }
  await checkMilestones(ref.referrer_id);
}

export async function checkMilestones(userId: string) {
  const stats = await referralStats(userId);
  const { data: milestones } = await db()
    .from("milestones")
    .select("id,active_referrals,reward_amount")
    .eq("active", true)
    .order("active_referrals");
  const { data: reached } = await db()
    .from("user_milestones")
    .select("milestone_id")
    .eq("user_id", userId);
  const done = new Set((reached ?? []).map((r) => r.milestone_id));

  for (const m of milestones ?? []) {
    if (stats.active < m.active_referrals || done.has(m.id)) continue;
    await db().from("user_milestones").insert({ user_id: userId, milestone_id: m.id });
    await db().from("referral_rewards").insert({
      user_id: userId,
      kind: "milestone",
      amount: m.reward_amount,
    });
    await applyBalance(
      userId,
      { referral_balance: m.reward_amount },
      { kind: "milestone_reward", amount: m.reward_amount },
    );
    const nextM = (milestones ?? []).find((x) => x.active_referrals > m.active_referrals);
    const { data: user } = await db()
      .from("users")
      .select("telegram_id")
      .eq("id", userId)
      .maybeSingle();
    if (user) {
      await sendMessage(
        user.telegram_id,
        `🎉 MILESTONE UNLOCKED!\n\nYou now have:\n${m.active_referrals} Active Referrals\n\n🎁 Reward unlocked: ${usd(
          m.reward_amount,
        )}${nextM ? `\n\nNext:\n${nextM.active_referrals} Active Referrals` : ""}`,
        kb([
          [{ text: "👥 INVITE MORE", data: "invite" }],
          [{ text: "💰 VIEW REWARDS", data: "rewards" }],
        ]),
      );
    }
  }
}

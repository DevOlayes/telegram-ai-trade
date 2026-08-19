# NEXORA AI Trades

NEXORA — TELEGRAM AI TRADING BOT MVP



Build a simple, mobile-first Telegram AI trading bot MVP called NEXORA.



NEXORA is a Telegram Messenger bot, NOT a Telegram Mini App and NOT a Telegram Web App.



The entire primary user experience must happen inside normal Telegram chat using:



- Telegram messages

- Inline buttons

- Callback buttons

- Persistent menu commands where appropriate



The goal is to build a clean MVP that can later connect to a real trading engine.



---



⚠️ IMPORTANT DEVELOPMENT INSTRUCTION



This project has a very limited development budget/credit allowance.



DO NOT over-engineer the MVP.



Build only what is necessary for the complete user journey.



Prioritize:



1. Telegram bot

2. User onboarding

3. $25 welcome bonus

4. AI trade recommendation

5. Trade risk/amount selection

6. Controlled trade/settlement engine

7. Balance tracking

8. Trade history

9. Withdrawal system

10. Referral system

11. Referral milestones

12. Basic admin controls

13. Data collection



Do NOT waste development credits on:



- Complex animations

- Landing pages

- Social feeds

- Leaderboards

- Complex charts

- Advanced analytics

- Unnecessary settings

- Excessive UI

- Features not required for the MVP



---



1. BRAND



Brand:



NEXORA



Positioning:



AI-Powered Trading. Directly on Telegram.



Tone:



- Modern

- Intelligent

- Fast

- Simple

- Beginner-friendly

- Crypto-native

- Professional



Use emojis strategically.



Keep every message short and highly scannable.



Avoid long paragraphs.



---



2. CORE UX PRINCIPLE — CLEAN TELEGRAM CHAT



This is extremely important.



NEXORA should NOT flood the user's Telegram chat with messages.



The experience should feel like an interactive trading terminal rather than a normal chatbot conversation.



Use message editing whenever possible.



For example, instead of:



"Analyzing..."



then:



"Analysis complete"



then:



"Trade available"



then:



"Trade confirmed"



edit the SAME message whenever practical.



Example:



🤖 NEXORA AI



Analyzing BTC/USDT...



↓



EDIT SAME MESSAGE



🤖 NEXORA AI



✅ Analysis complete.



BTC/USDT

📈 LONG



↓



EDIT SAME MESSAGE



⚡ TRADE ACTIVE



BTC/USDT

📈 LONG



Entry: $XXX

TP: $XXX

SL: $XXX



This keeps the chat clean.



---



3. TEMPORARY MESSAGE CLEANUP



Messages that are only required temporarily should be automatically deleted when they are no longer useful.



Examples:



- Loading messages

- Temporary confirmation messages

- Menu-selection prompts

- Temporary error messages

- Intermediate trade setup messages

- Old interactive keyboards

- Expired trade controls

- Temporary referral/share prompts



Where appropriate:



DELETE temporary messages after the action is completed.



Do not delete information the user may need for:



- Financial records

- Completed trades

- Withdrawal records

- Account information

- Important warnings

- Important terms/conditions



---



4. IMPORTANT MESSAGES THAT SHOULD REMAIN



Keep only useful information in the chat.



Examples:



Completed trade result



🎉 TRADE WON



BTC/USDT

📈 LONG



Profit:

+$4.20



Balance:

$29.20



---



Withdrawal confirmation



✅ WITHDRAWAL REQUESTED



Amount:

$30.00



Network:

TRON (TRC-20)



Status:

Processing



---



Important account notices



Keep these visible when necessary.



Everything else should be aggressively cleaned up.



---



5. ONBOARDING



When a new user starts:



🤖 WELCOME TO NEXORA



AI-powered trading, directly on Telegram.



🎁 $25 WELCOME BONUS



No deposit required.



Use your welcome bonus to explore NEXORA.



[ 🎁 CLAIM $25 ]



[ ℹ️ HOW IT WORKS ]



Make absolutely clear that the $25 is a welcome/promotional bonus and is NOT a required deposit.



---



6. CLAIM BONUS



After claiming:



🎉 $25 BONUS CLAIMED!



Your NEXORA account is ready.



💰 Balance:

$25.00



[ 🚀 START TRADING ]



[ 👥 INVITE & EARN ]



Record:



- Telegram user ID

- Username

- First name

- Registration timestamp

- Bonus claim timestamp

- Bonus amount

- Referral source



Prevent multiple bonus claims for the same Telegram account.



---



7. MAIN MENU



Use a simple persistent menu:



🏠 HOME



🚀 TRADE



👥 INVITE & EARN



💰 WALLET



📜 HISTORY



ℹ️ HOW IT WORKS



Keep the menu simple.



---



8. HOME



Display:



🤖 NEXORA



💰 Balance

$25.00



📈 Profit

$0.00



📊 Trades

0



━━━━━━━━━━━━



[ 🚀 TRADE ]



[ 👥 INVITE & EARN ]



[ 💰 WALLET ]



[ 📜 HISTORY ]



---



9. AI TRADING CONCEPT



The core product concept is:



«NEXORA AI decides WHAT trade to take.



The user decides HOW MUCH to risk.»



The user does NOT manually select BUY or SELL.



The AI generates the trade direction.



Example:



🤖 NEXORA AI



Analyzing market...



↓



EDIT SAME MESSAGE



🤖 ANALYSIS COMPLETE



BTC/USDT



📈 LONG



🎯 AI Confidence:

87%



⏱ Suggested duration:

1 hour



[ 👀 VIEW TRADE ]



---



10. TRADE DURATION



Trade durations must be significantly longer than short-term 5–10 minute trades.



Supported durations should generally range from:



Minimum



30 minutes



Normal



45 minutes

1 hour

2 hours



Extended



3 hours

4 hours



The AI should determine the suggested duration based on the trade setup.



Do NOT force every trade to have the same duration.



Examples:



BTC/USDT

⏱ 1 hour



ETH/USDT

⏱ 2 hours



SOL/USDT

⏱ 45 minutes



A high-conviction setup may use:



⏱ 4 hours



The supported durations must be configurable from the admin panel.



---



11. AI TRADE SETUP



Example:



🤖 AI TRADE



BTC/USDT



📈 LONG



Entry:

$118,420



🎯 Take Profit:

$119,100



🛑 Stop Loss:

$118,050



⏱ Duration:

2 hours



🎯 AI Confidence:

87%



━━━━━━━━━━━━



Choose your risk



🟢 CONSERVATIVE



🟡 BALANCED ⭐



🔴 AGGRESSIVE



[ CONTINUE ]



The AI should recommend BALANCED by default.



---



12. RISK SELECTION



The user chooses a risk profile.



🟢 CONSERVATIVE



Lower amount at risk.



🟡 BALANCED



Recommended default.



🔴 AGGRESSIVE



Higher amount at risk.



The system should calculate:



- Suggested trade amount

- Potential profit

- Potential loss

- Leverage if applicable



Do not overwhelm users with technical calculations.



---



13. TRADE AMOUNT



Example:



💰 TRADE SIZE



Available balance:

$25.00



🤖 AI Recommended:

$6.25



Choose amount:



[ $2.50 ]



[ $5 ]



[ $6.25 ⭐ ]



[ $10 ]



[ CUSTOM ]



Prevent the user from selecting more than their available balance.



Then display:



Potential Profit:

+$X



Potential Loss:

-$X



[ 🚀 ENTER AI TRADE ]



---



14. LEVERAGE



Keep leverage simple.



The AI may recommend leverage based on:



- Risk profile

- Stop-loss distance

- Trade setup

- Available balance

- AI confidence



Example:



⚡ Leverage:

5x



Users should primarily understand:



Amount at Risk

Potential Profit

Potential Loss



Do not expose complicated leverage calculations.



---



15. TRADE CONFIRMATION



Before entering:



⚡ CONFIRM AI TRADE



BTC/USDT

📈 LONG



Amount:

$6.25



Potential Profit:

+$4.20



Potential Loss:

-$2.50



AI Confidence:

87%



⏱ Duration:

2 hours



⚠️ Markets can move against the trade.



[ ✅ ENTER TRADE ]



[ ❌ CANCEL ]



Once the user confirms, edit the current message into the active-trade state rather than sending multiple new messages.



---



16. CONTROLLED MARKET / SETTLEMENT ENGINE



For the MVP, create a controlled market/settlement engine.



IMPORTANT:



Keep the settlement engine separate from:



- Telegram interface

- User balance system

- AI recommendation system



The settlement engine must support:



- Trading pairs

- Price

- Direction

- Entry price

- Take Profit

- Stop Loss

- Trade duration

- Trade expiration

- Win

- Loss

- Settlement



The result must be determined by the programmed settlement rules.



The user does not manually determine the result.



The architecture must allow this engine to later be replaced by a legitimate live market/trading engine.



---



17. TRADE SETTLEMENT



For LONG:



If Take Profit is reached:



🎉 WIN



If Stop Loss is reached:



❌ LOSS



For SHORT:



If Take Profit is reached:



🎉 WIN



If Stop Loss is reached:



❌ LOSS



If the maximum duration expires before either level is reached, apply a clearly defined configurable settlement rule.



All parameters must be configurable.



---



18. ACTIVE TRADE — CLEAN CHAT



When a trade begins, display ONE active trade message.



Example:



⚡ TRADE ACTIVE



BTC/USDT

📈 LONG



Entry:

$118,420



Current:

$118,537



🎯 TP:

$119,100



🛑 SL:

$118,050



⏱ Remaining:

1h 42m



Potential Profit:

+$4.20



Potential Loss:

-$2.50



Where possible, update this same message periodically instead of creating new messages.



Do NOT send a new Telegram message every time the price changes.



Use sensible update intervals.



---



19. TRADE COMPLETION



When the trade ends, edit the active trade message into the final result where possible.



WIN



🎉 TRADE WON



BTC/USDT

📈 LONG



Profit:

+$4.20



━━━━━━━━━━━━



💰 Balance:

$29.20



[ 🚀 TRADE AGAIN ]



[ 📜 HISTORY ]



Optionally display a referral CTA after selected successful trades.



Do NOT display the referral CTA after every trade.



---



20. LOSS



❌ TRADE CLOSED



BTC/USDT

📈 LONG



Result:

LOSS



Loss:

-$2.50



━━━━━━━━━━━━



💰 Balance:

$22.50



[ 🚀 TRY AGAIN ]



[ 📜 HISTORY ]



Never hide losses.



---



21. WALLET



💰 MY WALLET



Balance:

$29.20



🎁 Welcome Bonus:

$25.00



📈 Profit:

+$4.20



💸 Eligible Balance:

$4.20



━━━━━━━━━━━━



[ 💸 WITHDRAW ]



[ 📜 WITHDRAWALS ]



Clearly distinguish:



- Promotional bonus

- Trading profit

- Eligible balance

- Withdrawable amount



---



22. WITHDRAWAL



Current withdrawal threshold:



$30 minimum eligible balance



The user can request a withdrawal once:



1. They have at least $30 eligible balance

2. Their account has passed the required waiting period



There is NO separate $4 withdrawal deposit.



Do not create a pay-to-withdraw mechanism.



---



23. WITHDRAWAL WAITING PERIOD



Because users receive a promotional welcome bonus:



72 hours / 3 days from registration



must pass before the user becomes eligible for withdrawal.



Example:



🔒 WITHDRAWAL LOCKED



Your withdrawal window opens in:



⏳ 1 day 8 hours



Minimum eligible balance:



💰 $30



Once both conditions are satisfied:



✅ Withdrawal becomes available.



Clearly disclose this condition during onboarding and in the wallet.



---



24. WITHDRAWAL NETWORK



Withdrawals use:



🔴 USDT — TRON (TRC-20)



Show:



💸 WITHDRAW PROFIT



Minimum:

$30



Network:

🔴 TRON (TRC-20)



⚠️ Only enter a USDT TRC-20 wallet address.



Using the wrong network may result in permanent loss of funds.



[ CONTINUE ]



---



25. WITHDRAWAL CONFIRMATION



Collect:



USDT TRC-20 wallet address



Then show:



🔎 CHECK WITHDRAWAL



Amount:

$XX



Network:

TRON (TRC-20)



Wallet:

TXxxxxxxxx...



⚠️ Confirm that this is a USDT TRC-20 address.



[ ✅ CONFIRM WITHDRAWAL ]



After submission:



⏳ WITHDRAWAL PROCESSING



Amount:

$XX



Network:

TRC-20



Status:

Pending



Then update the same message when status changes.



---



26. REFERRAL SYSTEM



Referral section:



👥 INVITE & EARN



🎁 Your friend gets:

$25



💰 You earn:

$2 per qualified active referral



A referral does NOT qualify simply because someone clicks the link.



Qualification:



Friend clicks referral link

↓

Joins NEXORA

↓

Claims $25

↓

Completes qualifying activity

↓

Referral becomes ACTIVE

↓

Referrer earns $2



Make qualifying activity configurable.



---



27. REFERRAL SCREEN



👥 INVITE & EARN



🎁 Friend gets:

$25



💰 You earn:

$2 per qualified referral



━━━━━━━━━━━━



👥 Invited:

7



✅ Active:

4



💰 Rewards:

$8



🎯 Next milestone:

5 Active Referrals



████████░░ 4/5



🔥 1 more to unlock!



[ 📤 SHARE & EARN ]



[ 🎯 MILESTONES ]



[ 💰 MY REWARDS ]



---



28. SOCIAL SHARING



Referral links must work beyond Telegram.



Use the device's native sharing mechanism where possible.



Allow sharing through:



- WhatsApp

- Telegram

- X

- Facebook

- Messenger

- Instagram

- SMS

- Email

- Discord

- Other supported apps



Also provide:



[ 🔗 COPY LINK ]



Each user receives a unique referral link.



Example:



t.me/NexoraBot?start=ABC123



Track the referral ID when the new user starts the bot.



---



29. SHARE MESSAGE



Automatically generate:



🎁 GET $25 ON NEXORA



Try NEXORA's AI-powered trading experience directly on Telegram.



No deposit required.



Claim your $25 welcome bonus 👇



[ JOIN NEXORA ]



Attach the user's unique referral link automatically.



---



30. REFERRAL MILESTONES



Do NOT create a leaderboard.



Use simple milestones:



🎯 1 Active Referral



🎯 5 Active Referrals



🎯 10 Active Referrals



🎯 25 Active Referrals



Milestone rewards must be configurable.



---



31. MILESTONE NOTIFICATION



When reached:



🎉 MILESTONE UNLOCKED!



You now have:



5 Active Referrals



🎁 Reward unlocked.



Next:



10 Active Referrals



[ 👥 INVITE MORE ]



[ 💰 VIEW REWARDS ]



---



32. REFERRAL PAYOUTS



Keep referral rewards separate from trading balance.



Example:



👥 REFERRAL REWARDS



Available:

$18.00



📅 Next payout:

August 31



Status:

⏳ Pending



Referral rewards can be processed on a configurable scheduled monthly payout date after eligibility/fraud checks.



---



33. ANTI-ABUSE



Implement basic protections:



- One account per Telegram user ID

- Prevent self-referrals

- Original referrer cannot be changed

- Referral reward only after qualification

- Track referral relationships

- Track withdrawal wallets

- Flag suspicious wallet reuse

- Flag suspicious referral activity

- Admin review status



Keep the first version simple.



---



34. TRADE HISTORY



📜 TRADE HISTORY



🟢 BTC/USDT

+$4.20



🔴 ETH/USDT

-$2.50



🟢 SOL/USDT

+$3.80



━━━━━━━━━━━━



Trades:

3



Wins:

2



Losses:

1



Profit:

+$5.50



History should remain accessible from the menu.



---



35. DATA COLLECTION



Collect structured data needed to understand user behavior.



Track:



- Registration

- Bonus claim

- Referral source

- Trade frequency

- Trading pairs

- AI recommendations

- Risk selection

- Trade amount

- AI recommendation acceptance

- AI recommendation rejection

- Trade outcome

- Profit/loss

- Session activity

- Withdrawal requests

- Referral activity

- Milestones



Inform users appropriately about data collection and consent where required.



---



36. ADMIN PANEL



Keep the admin panel minimal.



USERS



- Telegram ID

- Username

- Registration

- Bonus status

- Balance

- Profit

- Referral source

- Referral count

- Account status



TRADES



- User

- Pair

- Direction

- Amount

- Entry

- TP

- SL

- Duration

- Result

- Profit/loss

- Timestamp



WITHDRAWALS



- User

- Amount

- Wallet

- Network

- Status

- Timestamp



REFERRALS



- Referrer

- Referred user

- Status

- Reward

- Qualification date



SETTINGS



Admin should be able to configure:



- Welcome bonus

- Minimum withdrawal

- Withdrawal waiting period

- Referral reward

- Referral milestones

- Trading pairs

- Risk profiles

- Trade durations

- Settlement parameters

- AI confidence display



---



37. TECHNICAL ARCHITECTURE



Use:



Telegram Bot

↓

Backend/API

↓

AI Trading Engine

↓

Market/Settlement Engine

↓

Database



Keep these components modular.



Separate:



1. Telegram interface

2. User/account system

3. AI engine

4. Trading engine

5. Settlement engine

6. Referral engine

7. Wallet/withdrawal system

8. Admin system



The future live trading engine must be replaceable without rebuilding the Telegram interface.



---



38. DATABASE



Create the minimum required entities:



- users

- balances

- trades

- trading_pairs

- withdrawals

- referrals

- referral_rewards

- milestones

- user_milestones

- transactions

- system_settings

- admin_actions



Use proper timestamps and relationships.



Use safe decimal handling for financial calculations.



Do not use unsafe JavaScript floating-point arithmetic for balances.



---



39. SECURITY



Never hardcode:



- Telegram Bot API token

- Private keys

- Wallet credentials

- Database credentials

- API secrets



Use secure environment variables/secrets.



When Telegram integration requires the Bot API token, ask for it through the secure secret/environment-variable mechanism.



Never expose it in frontend code or GitHub.



---



40. CHAT CLEANLINESS RULES



This is a HIGH PRIORITY requirement.



The Telegram conversation should remain visually clean.



Prefer:



EDIT



over:



SEND NEW MESSAGE



Whenever the content belongs to the same interaction.



Delete temporary messages such as:



- Loading

- Processing

- Selection prompts

- Temporary errors

- Intermediate trade setup

- Expired keyboards

- Temporary referral prompts



Keep:



- Final trade result

- Important account information

- Withdrawal status

- Important warnings

- Important system notices

- Trade history accessible through the menu



The user should never see dozens of repetitive NEXORA messages after using the bot for several trades.



---



41. FINAL USER EXPERIENCE



The ideal experience is:



👋 JOIN



↓



🎁 CLAIM $25



↓



🏠 HOME



↓



🚀 TRADE



↓



🤖 AI ANALYZES



↓



📈 AI RECOMMENDS TRADE



↓



🛡️ USER SELECTS RISK



↓



💰 USER SELECTS AMOUNT



↓



🚀 ENTER TRADE



↓



⚡ ONE ACTIVE TRADE MESSAGE



↓



⏱ 30 MIN — 4 HOURS



↓



🎉 WIN / ❌ LOSS



↓



💰 BALANCE UPDATED



↓



📜 RESULT REMAINS



↓



🔁 TRADE AGAIN



OR



↓



👥 INVITE & EARN



↓



📤 SHARE



↓



🎁 FRIEND GETS $25



↓



✅ FRIEND QUALIFIES



↓



💰 REFERRER EARNS



↓



🎯 MILESTONE



↓



🔁 INVITE AGAIN



OR



↓



💰 BALANCE ≥ $30



+ 



⏳ 72 HOURS PASSED



↓



💸 WITHDRAW



↓



🔴 TRC-20



---



42. DEVELOPMENT PRIORITY



Because development credits are limited, implement in this order:



PRIORITY 1



Telegram connection + onboarding + database



PRIORITY 2



$25 bonus + balance system



PRIORITY 3



AI trade flow + controlled settlement engine



PRIORITY 4



30-minute to 4-hour trade duration system



PRIORITY 5



Wallet + $30 withdrawal threshold + 72-hour eligibility



PRIORITY 6



Referral system + social sharing



PRIORITY 7



Referral milestones



PRIORITY 8



Basic admin controls



PRIORITY 9



Chat cleanup + message editing optimization



PRIORITY 10



Testing and bug fixing



Do not spend credits polishing secondary features before the core flow works.



---



FINAL BUILD INSTRUCTION



Build the MVP around this exact core experience:



JOIN → $25 BONUS → AI TRADE → RISK → AMOUNT → 30 MIN–4 HOUR TRADE → RESULT → BALANCE → WITHDRAWAL / REFERRAL



The Telegram experience must feel:



FAST ⚡



SIMPLE 🧠



CLEAN 🧹



PROFESSIONAL 📊



BEGINNER-FRIENDLY 🚀



Do not overwhelm the user.



Do not flood the Telegram chat.



Do not create unnecessary screens or messages.



If a requirement is ambiguous, choose the simplest implementation that preserves the intended user experience.



The architecture must remain modular so the controlled trading/settlement engine can later be replaced by the actual trading engine.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://telegram-ai-trade.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f7d5b767-7e2d-482f-a147-2287f89d926c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

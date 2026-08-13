// Branded LEXORA artwork used inside the Telegram bot.
// Telegram fetches these by absolute URL, so they must be publicly reachable.
import banner from "@/assets/banner.jpg.asset.json";
import deposit from "@/assets/deposit.jpg.asset.json";
import depositSuccess from "@/assets/deposit-success.jpg.asset.json";
import logo from "@/assets/logo.jpg.asset.json";
import tradeLoss from "@/assets/trade-loss.jpg.asset.json";
import tradeWon from "@/assets/trade-won.jpg.asset.json";
import welcome from "@/assets/welcome.jpg.asset.json";
import withdrawProcessing from "@/assets/withdraw-processing.jpg.asset.json";
import withdrawSuccess from "@/assets/withdraw-success.jpg.asset.json";

const host = () =>
  process.env["ASSET_HOST"] ??
  "https://project--f7d5b767-7e2d-482f-a147-2287f89d926c-dev.lovable.app";

const abs = (u: string) => `${host()}${u}`;

export const IMG = {
  banner: () => abs(banner.url),
  deposit: () => abs(deposit.url),
  depositSuccess: () => abs(depositSuccess.url),
  logo: () => abs(logo.url),
  tradeLoss: () => abs(tradeLoss.url),
  tradeWon: () => abs(tradeWon.url),
  welcome: () => abs(welcome.url),
  withdrawProcessing: () => abs(withdrawProcessing.url),
  withdrawSuccess: () => abs(withdrawSuccess.url),
};

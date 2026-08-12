// Shared TRON / USDT TRC-20 read helpers (TronGrid).
export const usdtContract = () =>
  process.env["USDT_TRC20_CONTRACT"] ?? "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

export type TronTransfer = {
  transaction_id: string;
  value: string;
  to: string;
  from?: string;
  block_timestamp: number;
  token_info?: { decimals?: number; address?: string };
};

/** Confirmed incoming USDT TRC-20 transfers to a wallet since a timestamp. */
export async function recentTransfers(
  wallet: string,
  sinceMs: number,
): Promise<TronTransfer[]> {
  if (!wallet) return [];
  const contract = usdtContract();
  const url =
    `https://api.trongrid.io/v1/accounts/${wallet}/transactions/trc20` +
    `?only_confirmed=true&only_to=true&limit=200&contract_address=${contract}` +
    `&min_timestamp=${Math.max(0, sinceMs)}`;
  const headers: Record<string, string> = {};
  const key = process.env["TRONGRID_API_KEY"];
  if (key) headers["TRON-PRO-API-KEY"] = key;
  try {
    const res = await fetch(url, { headers });
    const json = (await res.json()) as { data?: TronTransfer[] };
    return (json.data ?? []).filter(
      (t) =>
        t.to?.toLowerCase() === wallet.toLowerCase() &&
        (!t.token_info?.address || t.token_info.address === contract),
    );
  } catch (e) {
    console.error("trongrid error", e);
    return [];
  }
}

/** Convert a transfer's raw value into USD cents-safe number. */
export function transferAmount(t: TronTransfer) {
  const decimals = t.token_info?.decimals ?? 6;
  return Number(t.value) / Math.pow(10, decimals);
}

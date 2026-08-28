// URL builders pour les explorateurs blockchain.
// Override possible via VITE_CHAIN_EXPLORER_BASE (par défaut Sepolia).

const EXPLORER_BASE =
  (import.meta.env.VITE_CHAIN_EXPLORER_BASE as string | undefined) ||
  "https://sepolia.etherscan.io";

export function etherscanTxUrl(txHash: string): string {
  return `${EXPLORER_BASE}/tx/${txHash}`;
}

export function etherscanBlockUrl(blockNumber: number): string {
  return `${EXPLORER_BASE}/block/${blockNumber}`;
}

export function etherscanAddressUrl(address: string): string {
  return `${EXPLORER_BASE}/address/${address}`;
}

export const explorerName: string = (() => {
  try {
    return new URL(EXPLORER_BASE).hostname.split(".").slice(-2, -1)[0] || "Etherscan";
  } catch {
    return "Etherscan";
  }
})();

/**
 * Envoi du bulletin : un vote dont la réponse s'est perdue est renvoyé avec le
 * même jeton de reçu, et le serveur redonne le même reçu.
 */
import { AxiosError, AxiosHeaders } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.fn();
vi.mock("@/lib/api", () => ({ api: { post: (...args: unknown[]) => post(...args) } }));

const { castVote } = await import("@/lib/queries/votes");

const RECEIPT = { id: "r", election_id: "e1", vote_hash: "0xabc", tx_hash: null, block_number: null, created_at: "" };

function networkError() {
  return new AxiosError("Network Error", AxiosError.ERR_NETWORK);
}

function httpError(status: number) {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError("HTTP", "ERR_BAD_RESPONSE", config, null, {
    status, statusText: "", headers: {}, config, data: { detail: "x" },
  });
}

describe("castVote", () => {
  beforeEach(() => {
    post.mockReset();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("renvoie le même jeton après une coupure réseau", async () => {
    post.mockRejectedValueOnce(networkError()).mockResolvedValueOnce({ data: RECEIPT });

    const pending = castVote({ election_id: "e1", candidate_id: "c1" });
    await vi.runAllTimersAsync();

    await expect(pending).resolves.toEqual(RECEIPT);
    expect(post).toHaveBeenCalledTimes(2);
    const [first, second] = post.mock.calls.map((c) => c[1] as { receipt_key: string });
    expect(first.receipt_key).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(second.receipt_key).toBe(first.receipt_key);
  });

  it("tire un nouveau jeton une fois le reçu obtenu", async () => {
    post.mockResolvedValue({ data: RECEIPT });
    await castVote({ election_id: "e1", candidate_id: "c1" });
    await castVote({ election_id: "e1", candidate_id: "c1" });
    const keys = post.mock.calls.map((c) => (c[1] as { receipt_key: string }).receipt_key);
    expect(keys[0]).not.toBe(keys[1]);
  });

  it("ne réessaie pas une réponse définitive (déjà voté)", async () => {
    post.mockRejectedValue(httpError(409));
    await expect(castVote({ election_id: "e2", candidate_id: null })).rejects.toBeInstanceOf(AxiosError);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("abandonne après deux nouveaux essais", async () => {
    post.mockRejectedValue(httpError(503));
    const pending = castVote({ election_id: "e3", candidate_id: "c1" });
    const settled = expect(pending).rejects.toBeInstanceOf(AxiosError);
    await vi.runAllTimersAsync();
    await settled;
    expect(post).toHaveBeenCalledTimes(3);
  });
});

// 验证非安全上下文缺少 randomUUID 时仍可生成 ID；测试不声称回退算法提供密码学身份保证。
// Checks ID generation without randomUUID on insecure origins, without claiming cryptographic identity guarantees for the fallback.
import { afterEach, describe, expect, it, vi } from "vitest";
import { randomId } from "./random-id";

afterEach(() => vi.unstubAllGlobals());
describe("randomId", () => {
  it("works when LAN HTTP does not expose randomUUID", () => {
    const getRandomValues = crypto.getRandomValues.bind(crypto);
    vi.stubGlobal("crypto", { getRandomValues });
    const ids = Array.from({ length: 100 }, randomId);
    expect(new Set(ids).size).toBe(100);
    ids.forEach((id) => expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/));
  });
});

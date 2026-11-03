import { expect, it } from "vitest";
import { api } from "./client";

it("includes Zhipu as a disabled demo default without a key", async () => {
  expect(api.isDemo).toBe(true);
  const settings = await api.getAiSettings();
  expect(settings.providers.find(provider => provider.id === "zhipu")).toMatchObject({
    label: "智谱",
    type: "OPENAI_COMPATIBLE",
    enabled: false,
    baseUrl: "https://open.bigmodel.cn/api/paas/v4/",
    model: "glm-4.7-flash",
    apiKeyConfigured: false,
  });
});

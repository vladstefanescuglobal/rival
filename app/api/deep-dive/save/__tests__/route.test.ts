import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { deepDiveCreateMock, apiLogCreateMock } = vi.hoisted(() => ({
  deepDiveCreateMock: vi.fn(),
  apiLogCreateMock: vi.fn()
}));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    deepDive: { create: deepDiveCreateMock },
    apiLog: { create: apiLogCreateMock }
  }
}));

function request(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/deep-dive/save", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

describe("POST /api/deep-dive/save", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    deepDiveCreateMock.mockResolvedValue({});
    apiLogCreateMock.mockResolvedValue({});
  });

  it("requires a competitor id", async () => {
    const { POST } = await import("@/app/api/deep-dive/save/route");
    const response = await POST(request({}));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "competitorId is required" });
    expect(deepDiveCreateMock).not.toHaveBeenCalled();
  });

  it("stores a successful result and log", async () => {
    const { POST } = await import("@/app/api/deep-dive/save/route");
    const response = await POST(
      request({
        competitorId: "cmp_1",
        mode: "balanced",
        query: "pricing",
        promptTemplate: null,
        result: { summary: "Updated" },
        citations: ["https://example.com"],
        durationMs: 250,
        status: "success"
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(deepDiveCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ competitorId: "cmp_1", result: { summary: "Updated" } }) })
    );
    expect(apiLogCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "success", resultQuality: "full" }) })
    );
  });

  it("stores null JSON values as Prisma JSON null", async () => {
    const { POST } = await import("@/app/api/deep-dive/save/route");
    await POST(request({ competitorId: "cmp_1", result: null, citations: null, status: "error" }));

    const data = deepDiveCreateMock.mock.calls[0][0].data;
    expect(data.result).toBeDefined();
    expect(data.citations).toBeDefined();
    expect(apiLogCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "error", resultQuality: "empty" }) })
    );
  });

  it("returns a database error", async () => {
    deepDiveCreateMock.mockRejectedValueOnce(new Error("database unavailable"));
    const { POST } = await import("@/app/api/deep-dive/save/route");
    const response = await POST(request({ competitorId: "cmp_1" }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "database unavailable" });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { competitorFindManyMock, pushCompetitorMock } = vi.hoisted(() => ({
  competitorFindManyMock: vi.fn(),
  pushCompetitorMock: vi.fn()
}));

vi.mock("@/lib/db/client", () => ({
  prisma: { competitor: { findMany: competitorFindManyMock } }
}));

vi.mock("@/lib/quiver", () => ({ pushCompetitorToQuiver: pushCompetitorMock }));

function request(apiKey?: string): NextRequest {
  return new NextRequest("http://localhost/api/quiver-sync", {
    method: "POST",
    headers: apiKey ? { "x-internal-api-key": apiKey } : {}
  });
}

describe("POST /api/quiver-sync", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.INTERNAL_API_KEY = "test-key";
    competitorFindManyMock.mockResolvedValue([]);
    pushCompetitorMock.mockResolvedValue(undefined);
  });

  it("rejects a missing internal API key", async () => {
    const { POST } = await import("@/app/api/quiver-sync/route");
    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(competitorFindManyMock).not.toHaveBeenCalled();
  });

  it("returns an empty result when there are no competitors", async () => {
    const { POST } = await import("@/app/api/quiver-sync/route");
    const response = await POST(request("test-key"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ pushed: 0, competitors: [] });
    expect(competitorFindManyMock).toHaveBeenCalledWith({
      where: { isSelf: false },
      select: { id: true, name: true, baseUrl: true }
    });
  });

  it("pushes each competitor and reports the names", async () => {
    competitorFindManyMock.mockResolvedValue([
      { id: "cmp_1", name: "Acme", baseUrl: "https://acme.example" },
      { id: "cmp_2", name: "Beta", baseUrl: "https://beta.example" }
    ]);
    const { POST } = await import("@/app/api/quiver-sync/route");
    const response = await POST(request("test-key"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      pushed: 2,
      competitors: [
        { name: "Acme", status: "pushed" },
        { name: "Beta", status: "pushed" }
      ]
    });
    expect(pushCompetitorMock).toHaveBeenCalledTimes(2);
    expect(pushCompetitorMock).toHaveBeenNthCalledWith(1, "cmp_1", "Acme", "https://acme.example");
  });
});

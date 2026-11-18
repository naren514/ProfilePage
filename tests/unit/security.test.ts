import { describe, expect, it } from "vitest";
import { isCrossSiteWrite } from "@/middleware";

function req(method: string, headers: Record<string, string>, host = "narenc.com") {
  return { method, headers: new Headers(headers), nextUrl: new URL(`https://${host}/api/admin/writing/documents`) } as never;
}

describe("cross-site write protection", () => {
  it("allows reads from anywhere", () => {
    expect(isCrossSiteWrite(req("GET", { origin: "https://evil.example", "sec-fetch-site": "cross-site" }))).toBe(false);
  });

  it("allows writes from the site's own pages", () => {
    expect(isCrossSiteWrite(req("POST", { origin: "https://narenc.com", "sec-fetch-site": "same-origin" }))).toBe(false);
  });

  it("blocks writes another site's page sends", () => {
    expect(isCrossSiteWrite(req("POST", { origin: "https://evil.example" }))).toBe(true);
    expect(isCrossSiteWrite(req("DELETE", { "sec-fetch-site": "cross-site" }))).toBe(true);
    expect(isCrossSiteWrite(req("PATCH", { origin: "null" }))).toBe(true);
  });

  it("lets non-browser clients through (they still need the session cookie)", () => {
    expect(isCrossSiteWrite(req("POST", {}))).toBe(false);
  });
});

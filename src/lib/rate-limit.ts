import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimitRequests } from "@/lib/db/schema";
import { and, eq, gte, sql, lt } from "drizzle-orm";

interface RateLimitConfig {
  route: string;
  limit: number;
  windowSeconds: number;
}

export const RATE_LIMITS = {
  chat: { route: "/api/chat", limit: 20, windowSeconds: 60 },
  fitAssessment: { route: "/api/fit-assessment", limit: 5, windowSeconds: 60 },
  // Sign-in attempts per address: slows password guessing to a crawl
  login: { route: "/api/auth/session", limit: 10, windowSeconds: 15 * 60 },
  readingSave: { route: "/api/reading/save", limit: 30, windowSeconds: 60 },
} satisfies Record<string, RateLimitConfig>;

export function getClientIp(request: NextRequest): string {
  // Set by Vercel's edge and not forgeable by the client; prefer it over X-Forwarded-For
  const vercel = request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-real-ip");
  if (vercel) return vercel.split(",")[0].trim();
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

async function checkRateLimit(
  ip: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number }> {
  const windowStart = new Date(Date.now() - config.windowSeconds * 1000);

  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(rateLimitRequests)
    .where(
      and(
        eq(rateLimitRequests.ipAddress, ip),
        eq(rateLimitRequests.route, config.route),
        gte(rateLimitRequests.createdAt, windowStart)
      )
    );

  const count = result[0]?.count ?? 0;

  if (count >= config.limit) {
    return { allowed: false, remaining: 0 };
  }

  // Record this request
  await db.insert(rateLimitRequests).values({
    ipAddress: ip,
    route: config.route,
  });

  // Probabilistic cleanup (~1% of requests)
  if (Math.random() < 0.01) {
    const cutoff = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
    db.delete(rateLimitRequests)
      .where(lt(rateLimitRequests.createdAt, cutoff))
      .then(() => {})
      .catch(() => {});
  }

  return { allowed: true, remaining: config.limit - count - 1 };
}

function rateLimitExceededResponse(config: RateLimitConfig): NextResponse {
  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(config.windowSeconds),
        "X-RateLimit-Limit": String(config.limit),
        "X-RateLimit-Remaining": "0",
      },
    }
  );
}

/**
 * Check and record one request. Returns a 429 response when over the limit,
 * otherwise null. Fails open if the rate-limit table is unavailable.
 */
export async function rateLimitResponse(request: NextRequest, config: RateLimitConfig): Promise<NextResponse | null> {
  try {
    const { allowed } = await checkRateLimit(getClientIp(request), config);
    return allowed ? null : rateLimitExceededResponse(config);
  } catch (error) {
    console.error("Rate limit check failed, allowing request:", error);
    return null;
  }
}

export function withRateLimit(
  config: RateLimitConfig,
  handler: (request: NextRequest) => Promise<NextResponse>
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest) => {
    try {
      const ip = getClientIp(request);
      const { allowed, remaining } = await checkRateLimit(ip, config);

      if (!allowed) {
        return rateLimitExceededResponse(config);
      }

      const response = await handler(request);

      // Add rate limit headers to successful responses
      response.headers.set("X-RateLimit-Limit", String(config.limit));
      response.headers.set("X-RateLimit-Remaining", String(remaining));

      return response;
    } catch (rateLimitError) {
      // Fail open: if rate limit check fails, let the request through
      console.error("Rate limit check failed, allowing request:", rateLimitError);
      return handler(request);
    }
  };
}

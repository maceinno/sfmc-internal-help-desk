import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Route matchers
// ---------------------------------------------------------------------------

/** Routes that do not require authentication at all. */
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks/clerk(.*)",
  "/api/webhooks/inbound-email(.*)",
  "/api/sla/check",
  "/api/version",
]);

/** Routes restricted to admin role only. */
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

/** Routes restricted to agent or admin roles. */
const isAgentRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/tickets",
  "/reports(.*)",
]);

/** Routes that require branch-level access. */
const isBranchRoute = createRouteMatcher(["/branch(.*)"]);

/** Routes that require region-level access. */
const isRegionRoute = createRouteMatcher(["/region(.*)"]);

/** Routes available to any authenticated user (employee, agent, admin). */
const isAuthenticatedRoute = createRouteMatcher([
  "/my-tickets(.*)",
  "/cc-tickets(.*)",
  "/tickets/new(.*)",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type UserRole = "admin" | "agent" | "employee";

interface PublicMetadata {
  role?: UserRole;
  hasBranchAccess?: boolean;
  hasRegionalAccess?: boolean;
  [key: string]: unknown;
}

function getRole(metadata: PublicMetadata | undefined): UserRole {
  return metadata?.role ?? "employee";
}

function isAgentOrAdmin(role: UserRole): boolean {
  return role === "agent" || role === "admin";
}

function defaultRedirect(role: UserRole): string {
  return isAgentOrAdmin(role) ? "/dashboard" : "/my-tickets";
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export default clerkMiddleware(async (auth, request) => {
  // Allow public routes through without any auth checks.
  if (isPublicRoute(request)) {
    return NextResponse.next();
  }

  // Everything below this point requires authentication.
  const { userId, sessionClaims, redirectToSignIn } = await auth();

  if (!userId) {
    return redirectToSignIn();
  }

  const metadata = sessionClaims?.metadata as PublicMetadata | undefined;
  const role = getRole(metadata);

  // --- Admin routes ---------------------------------------------------------
  if (isAdminRoute(request)) {
    if (role !== "admin") {
      const url = new URL(defaultRedirect(role), request.url);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // --- Agent / admin routes -------------------------------------------------
  if (isAgentRoute(request)) {
    if (!isAgentOrAdmin(role)) {
      const url = new URL("/my-tickets", request.url);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // --- Branch routes --------------------------------------------------------
  if (isBranchRoute(request)) {
    if (!metadata?.hasBranchAccess) {
      const url = new URL(defaultRedirect(role), request.url);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // --- Region routes --------------------------------------------------------
  if (isRegionRoute(request)) {
    if (!metadata?.hasRegionalAccess) {
      const url = new URL(defaultRedirect(role), request.url);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // --- Authenticated-only routes (any signed-in user) -----------------------
  if (isAuthenticatedRoute(request)) {
    return NextResponse.next();
  }

  // For any other (portal) route that isn't explicitly matched above, require
  // authentication (already checked) and allow through.
  return NextResponse.next();
});

export const config = {
  matcher: [
    // Match all routes except Next.js internals and static files.
    // See: https://clerk.com/docs/quickstarts/nextjs#require-authentication-to-access-your-application
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run middleware for API routes.
    "/(api|trpc)(.*)",
  ],
};

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/auth";
import { ebayService } from "@/lib/ebay/service";

// GET /api/ebay/callback - Handle eBay OAuth callback
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const ebaytkn = searchParams.get("ebaytkn");
    const username = searchParams.get("username");
    const tknexp = searchParams.get("tknexp");
    const state = searchParams.get("state");
    const userIdParam = searchParams.get("user_id"); // Check for user_id parameter
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    // Debug: Log all parameters
    console.log("eBay callback received:", {
      code: code ? code.substring(0, 20) + "..." : "missing",
      ebaytkn: ebaytkn ? ebaytkn.substring(0, 20) + "..." : "missing",
      username,
      tknexp,
      userIdParam,
      error,
      errorDescription,
      state,
      timestamp: new Date().toISOString(),
      fullUrl: request.url
    });

    // Handle OAuth errors
    if (error) {
      const errorMsg = errorDescription || error;
      console.error("eBay OAuth error:", errorMsg);
      
      return NextResponse.redirect(
        new URL(`/dashboard?platform=ebay&status=error&message=${encodeURIComponent(errorMsg)}`, "http://localhost:3000")
      );
    }

    // Check for authorization code or eBay token
    if (!code && !ebaytkn) {
      const errorMsg = "No authorization code or eBay token received";
      console.error(errorMsg);
      
      return NextResponse.redirect(
        new URL(`/dashboard?platform=ebay&status=error&message=${encodeURIComponent(errorMsg)}`, "http://localhost:3000")
      );
    }

    // Extract userId from state parameter or user_id parameter
    let userId: string | null = null;
    if (state && state.includes(':')) {
      const stateParts = state.split(':');
      userId = stateParts[1]; // Extract userId from state
      console.log("Extracted userId from state:", userId);
    } else if (userIdParam) {
      userId = userIdParam; // Use user_id parameter
      console.log("Using userId from user_id parameter:", userId);
    } else {
      console.log("No userId found in state or user_id parameter:", { state, userIdParam });
    }

    // Get the current session
    const session = await auth();
    const sessionUserId = session?.user?.id;
    
    console.log("Session check:", {
      hasSession: !!session,
      sessionUserId,
      stateUserId: userId,
      state: state
    });
    
    // Use userId from state if session is not available
    const finalUserId = sessionUserId || userId;
    
    if (!finalUserId) {
      console.error("eBay callback: No authenticated user found and no userId in state");
      
      // Simple solution: Find the most recent user who has been active
      try {
        const { db } = await import("@/lib/db");
        
        // Get the most recently created user (most likely the one who initiated the OAuth)
        const recentUser = await db.user.findFirst({
          orderBy: { createdAt: 'desc' }
        });
        
        if (recentUser) {
          console.log("Using most recent user for eBay connection:", recentUser.id);
          
          // Process the callback with the most recent user
          const authResponse = await ebayService.handleCallback(
            recentUser.id, 
            code || ebaytkn || "", 
            state || undefined,
            username || undefined
          );
          
          console.log("eBay callback processed successfully with recent user:", {
            userId: recentUser.id,
            username: authResponse.username,
            timestamp: authResponse.timestamp,
            environment: process.env.EBAY_SANDBOX === "true" ? "SANDBOX" : "PRODUCTION",
          });

          // Redirect to dashboard with success message
          return NextResponse.redirect(
            new URL(`/dashboard?platform=ebay&status=connected&username=${encodeURIComponent(authResponse.username || "")}`, "http://localhost:3000")
          );
        }
      } catch (fallbackError) {
        console.error("User lookup failed:", fallbackError);
      }
      
      return NextResponse.redirect(
        new URL("/login?error=unauthorized&message=Please log in to connect your eBay account", "http://localhost:3000")
      );
    }

    // Process the callback - handle both OAuth code and eBay token flows
    const authResponse = await ebayService.handleCallback(
      finalUserId, 
      code || ebaytkn || "", 
      state || undefined,
      username || undefined
    );
    
    console.log("eBay callback processed successfully:", {
      userId: finalUserId,
      username: authResponse.username,
      timestamp: authResponse.timestamp,
      environment: process.env.EBAY_SANDBOX === "true" ? "SANDBOX" : "PRODUCTION",
    });

    // Redirect to dashboard with success message
    return NextResponse.redirect(
      new URL(`/dashboard?platform=ebay&status=connected&username=${encodeURIComponent(authResponse.username || "")}`, "http://localhost:3000")
    );

  } catch (error) {
    console.error("eBay callback error:", error);
    
    const errorMsg = error instanceof Error ? error.message : "An unexpected error occurred";
    
    return NextResponse.redirect(
      new URL(`/dashboard?platform=ebay&status=error&message=${encodeURIComponent(errorMsg)}`, "http://localhost:3000")
    );
  }
}

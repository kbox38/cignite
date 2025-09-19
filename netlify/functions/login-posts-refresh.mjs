/**
 * Netlify Function: login-posts-refresh
 * Triggers posts sync when user logs in
 */

export default async function handler(event, context) {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return new Response("", {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      }
    });
  }

  if (event.httpMethod !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }

  try {
    console.log("🔄 Login posts refresh triggered");

    // Get user ID from request body or auth headers
    const requestBody = event.body ? JSON.parse(event.body) : {};
    const { userId } = requestBody;

    if (!userId) {
      return new Response(JSON.stringify({ error: "userId is required" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    console.log(`Triggering posts sync for user: ${userId}`);

    // Call the sync-user-posts function
    const syncResponse = await fetch(`${process.env.URL}/.netlify/functions/sync-user-posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: userId,
        syncAll: false
      })
    });

    let syncResult;
    if (syncResponse.ok) {
      syncResult = await syncResponse.json();
      console.log("✅ Posts sync completed:", syncResult);
    } else {
      console.warn(`⚠️ Posts sync failed: ${syncResponse.status}`);
      syncResult = { 
        success: false, 
        error: `Sync failed with status ${syncResponse.status}` 
      };
    }

    return new Response(JSON.stringify({
      success: true,
      message: "Login posts refresh triggered",
      syncResult: syncResult,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });

  } catch (error) {
    console.error("❌ Login posts refresh error:", error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}
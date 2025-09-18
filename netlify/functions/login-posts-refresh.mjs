// netlify/functions/login-posts-refresh.mjs - Trigger posts refresh on user login
export async function handler(event, context) {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const { authorization } = event.headers;
  const { userId } = JSON.parse(event.body || '{}');

  console.log("=== LOGIN POSTS REFRESH ===");
  console.log("User ID:", userId);
  console.log("Authorization present:", !!authorization);

  if (!authorization) {
    return {
      statusCode: 401,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: "No authorization token" }),
    };
  }

  if (!userId) {
    return {
      statusCode: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: "userId is required" }),
    };
  }

  try {
    // Check when posts were last updated
    const lastUpdate = await getLastUpdateTime(userId);
    const shouldUpdate = shouldUpdateOnLogin(lastUpdate);

    if (!shouldUpdate) {
      const nextMidnight = getNextMidnight();
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          message: "Posts are up to date",
          lastUpdate,
          nextUpdate: nextMidnight.toISOString(),
          updated: false,
          trigger: "login_skip"
        }),
      };
    }

    console.log("User login detected - refreshing posts...");

    // Call the refresh function
    const refreshResponse = await fetch(`${getBaseUrl()}/refresh-user-posts`, {
      method: 'POST',
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        trigger: 'login',
        forceRefresh: false
      })
    });

    const refreshResult = await refreshResponse.json();

    if (!refreshResponse.ok) {
      throw new Error(refreshResult.error || 'Refresh failed');
    }

    // Update last login time
    await updateLastLoginTime(userId);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        message: "Posts refreshed on login",
        ...refreshResult,
        updated: true,
        trigger: "login_success"
      }),
    };

  } catch (error) {
    console.error("Login posts refresh error:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Failed to refresh posts on login",
        details: error.message,
        updated: false,
        trigger: "login_error"
      }),
    };
  }
}

async function getLastUpdateTime(userId) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase
      .from('post_cache')
      .select('fetched_at')
      .eq('user_id', userId)
      .order('fetched_at', { ascending: false })
      .limit(1)
      .single();

    if (error) return null;
    return data?.fetched_at;
  } catch (error) {
    console.error('Error getting last update time:', error);
    return null;
  }
}

function shouldUpdateOnLogin(lastUpdate) {
  if (!lastUpdate) return true; // No cache, definitely update

  const now = new Date();
  const lastUpdateDate = new Date(lastUpdate);
  
  // Update if it's a different day (crossed midnight)
  if (now.toDateString() !== lastUpdateDate.toDateString()) {
    return true;
  }

  // Update if more than 12 hours old (for frequent users)
  const hoursSinceUpdate = (now.getTime() - lastUpdateDate.getTime()) / (1000 * 60 * 60);
  return hoursSinceUpdate >= 12;
}

async function updateLastLoginTime(userId) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', userId);

  } catch (error) {
    console.error('Error updating last login time:', error);
    // Don't throw - this is not critical
  }
}

function getNextMidnight() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow;
}

function getBaseUrl() {
  // Get base URL for internal function calls
  return process.env.URL || 'https://your-site.netlify.app/.netlify/functions';
}
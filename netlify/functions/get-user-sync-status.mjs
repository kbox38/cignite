/**
 * Netlify Function: get-user-sync-status
 * Returns posts sync status for a specific user
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
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { userId } = JSON.parse(event.body || '{}');

    if (!userId) {
      return new Response(JSON.stringify({ error: "userId is required" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    // Get user sync status
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('posts_sync_status, last_posts_sync')
      .eq('id', userId)
      .single();

    if (userError) {
      throw new Error(`Failed to get user: ${userError.message}`);
    }

    // Get posts count
    const { count: postsCount, error: countError } = await supabase
      .from('post_cache')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countError) {
      console.warn('Failed to get posts count:', countError.message);
    }

    // Get latest post date
    const { data: latestPost, error: latestError } = await supabase
      .from('post_cache')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return new Response(JSON.stringify({
      status: user.posts_sync_status || 'pending',
      lastSync: user.last_posts_sync,
      postsCount: postsCount || 0,
      latestPostDate: latestPost?.created_at || null,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });

  } catch (error) {
    console.error("Get sync status error:", error);
    
    return new Response(JSON.stringify({
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
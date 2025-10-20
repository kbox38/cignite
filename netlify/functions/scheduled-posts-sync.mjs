/**
 * Netlify Scheduled Function: scheduled-posts-sync
 * Runs every day at midnight (0 0 * * *) to sync posts for all users
 * File location: netlify/functions/scheduled-posts-sync.mjs
 */

export default async function handler(event, context) {
  console.log("🕒 Starting scheduled posts sync at:", new Date().toISOString());
  
  try {
    // Call the sync-user-posts function with syncAll=true
    const syncResponse = await fetch(`${process.env.URL}/.netlify/functions/sync-user-posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        syncAll: true
      })
    });

    if (!syncResponse.ok) {
      throw new Error(`Sync function returned ${syncResponse.status}: ${syncResponse.statusText}`);
    }

    const syncResult = await syncResponse.json();
    
    console.log("✅ Scheduled sync completed:", {
      totalProcessed: syncResult.totalProcessed,
      successCount: syncResult.successCount,
      failureCount: syncResult.failureCount,
      timestamp: syncResult.timestamp
    });

    // Log results to monitoring/analytics if needed
    await logScheduledSyncResult(syncResult);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: "Scheduled posts sync completed successfully",
        ...syncResult
      })
    };

  } catch (error) {
    console.error("❌ Scheduled posts sync failed:", error);
    
    // Log error for monitoring
    await logScheduledSyncError(error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
}

/**
 * Log successful sync results for monitoring
 */
async function logScheduledSyncResult(result) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Log to platform analytics or create a sync log table
    await supabase.from('platform_analytics').upsert({
      metric_date: new Date().toISOString().split('T')[0],
      feature_usage: {
        scheduled_posts_sync: {
          timestamp: result.timestamp,
          total_processed: result.totalProcessed,
          success_count: result.successCount,
          failure_count: result.failureCount,
          results: result.results?.map(r => ({
            userId: r.userId,
            status: r.status,
            postsProcessed: r.postsProcessed
          })) || []
        }
      }
    }, {
      onConflict: 'metric_date'
    });

    console.log("📊 Sync results logged to analytics");
  } catch (error) {
    console.error("Failed to log sync results:", error);
  }
}

/**
 * Log sync errors for monitoring and alerting
 */
async function logScheduledSyncError(error) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Log error for debugging and alerts
    await supabase.from('api_usage_logs').insert({
      api_endpoint: 'scheduled-posts-sync',
      method: 'CRON',
      status_code: 500,
      error_message: error.message,
      created_at: new Date().toISOString()
    });

    // Send alert notification if needed
    await sendSyncFailureAlert(error);

    console.log("🚨 Sync error logged");
  } catch (logError) {
    console.error("Failed to log sync error:", logError);
  }
}

/**
 * Send alert notification for sync failures
 */
async function sendSyncFailureAlert(error) {
  // Implement alerting mechanism (email, Slack, etc.)
  // For now, just log to console
  console.warn("🚨 ALERT: Scheduled posts sync failed:", {
    error: error.message,
    timestamp: new Date().toISOString(),
    action: "Manual intervention may be required"
  });
  
  // Future: Send email alert, Slack notification, etc.
}
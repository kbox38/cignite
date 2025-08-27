export async function handler(event, context) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
      },
    };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const { userId, search = "", limit = "10" } = event.queryStringParameters || {};

  console.log("=== SYNERGY USER SEARCH (REAL DATABASE) ===");
  console.log("User ID provided:", userId);
  console.log("Search term:", search);
  console.log("Limit:", limit);

  if (!userId) {
    return {
      statusCode: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: "User ID is required" }),
    };
  }

  try {
    const currentUserId = userId;
    console.log("Current user ID:", currentUserId);

    // Initialize Supabase client
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log("Supabase client initialized");

    // Get existing partnerships to exclude
    const { data: existingPartnerships, error: partnershipsError } = await supabase
      .from('synergy_partners')
      .select('a_user_id, b_user_id')
      .or(`a_user_id.eq.${currentUserId},b_user_id.eq.${currentUserId}`)
      .eq('partnership_status', 'active');

    if (partnershipsError) {
      console.error("Error fetching partnerships:", partnershipsError);
    }

    const partnerIds = new Set();
    existingPartnerships?.forEach(partnership => {
      if (partnership.a_user_id === currentUserId) {
        partnerIds.add(partnership.b_user_id);
      } else {
        partnerIds.add(partnership.a_user_id);
      }
    });

    console.log("Existing partner IDs:", Array.from(partnerIds));

    // Get pending invitations to exclude
    const { data: pendingInvitations, error: invitationsError } = await supabase
      .from('synergy_invitations')
      .select('from_user_id, to_user_id')
      .or(`from_user_id.eq.${currentUserId},to_user_id.eq.${currentUserId}`)
      .eq('invitation_status', 'pending');

    if (invitationsError) {
      console.error("Error fetching pending invitations:", invitationsError);
    }

    const pendingIds = new Set();
    pendingInvitations?.forEach(invitation => {
      if (invitation.from_user_id === currentUserId) {
        pendingIds.add(invitation.to_user_id);
      } else {
        pendingIds.add(invitation.from_user_id);
      }
    });

    console.log("Pending invitation IDs:", Array.from(pendingIds));

    // Build search query for users with DMA active
    let query = supabase
      .from('users')
      .select(`
        id,
        name,
        email,
        headline,
        industry,
        location,
        avatar_url,
        linkedin_member_urn,
        dma_active,
        created_at,
        user_profiles (
          total_connections,
          profile_completeness_score
        )
      `)
      .eq('dma_active', true)
      .neq('id', currentUserId)
      .limit(parseInt(limit));

    // Add search filter if provided
    if (search.trim()) {
      query = query.or(`name.ilike.%${search}%,headline.ilike.%${search}%,industry.ilike.%${search}%`);
    }

    const { data: users, error: usersError } = await query;

    if (usersError) {
      console.error("Error fetching users:", usersError);
      return {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          error: "Failed to fetch users from database",
          details: usersError.message
        }),
      };
    }

    console.log("Raw users from database:", users?.length || 0);

    // Filter out existing partners and pending invitations
    const availableUsers = users?.filter(user => 
      !partnerIds.has(user.id) && !pendingIds.has(user.id)
    ) || [];

    console.log("Available users after filtering:", availableUsers.length);

    // Format response with real user data
    const formattedUsers = availableUsers.map(user => ({
      id: user.id,
      name: user.name || 'LinkedIn User',
      email: user.email,
      headline: user.headline || 'LinkedIn Professional',
      industry: user.industry || 'Professional Services',
      location: user.location || 'Location not specified',
      avatarUrl: user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=0ea5e9&color=fff`,
      linkedinMemberUrn: user.linkedin_member_urn,
      dmaActive: user.dma_active,
      totalConnections: user.user_profiles?.total_connections || 0,
      profileCompleteness: user.user_profiles?.profile_completeness_score || 0,
      mutualConnections: 0, // Would need complex query to calculate real mutual connections
      joinedDate: user.created_at
    }));

    console.log(`Returning ${formattedUsers.length} formatted users`);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        users: formattedUsers,
        totalFound: formattedUsers.length,
        searchTerm: search,
        dmaRequirement: "Only users with active DMA consent can be added as Synergy partners",
        metadata: {
          searchPerformed: !!search,
          currentUserId,
          excludedPartners: partnerIds.size,
          excludedPending: pendingIds.size,
          timestamp: new Date().toISOString()
        }
      }),
    };
  } catch (error) {
    console.error("Synergy user search error:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Failed to search users",
        details: error.message,
        stack: error.stack
      }),
    };
  }
}
export async function handler(event, context) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
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

  const { authorization } = event.headers;
  const { search = "", limit = "10" } = event.queryStringParameters || {};

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

  try {
    console.log("Synergy User Search:", { search, limit });

    // Get current user ID from token
    const currentUserId = await getUserIdFromToken(authorization);
    if (!currentUserId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Invalid token" }),
      };
    }

    // Query Supabase for real users
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Build search query
    let query = supabase
      .from('users')
      .select(`
        id,
        name,
        email,
        avatar_url,
        headline,
        industry,
        location,
        linkedin_member_urn,
        dma_active,
        created_at,
        user_profiles!inner(
          total_connections,
          profile_completeness_score
        )
      `)
      .eq('dma_active', true)
      .neq('id', currentUserId) // Exclude current user
      .limit(parseInt(limit));

    // Add search filters if search term provided
    if (search && search.trim()) {
      const searchTerm = `%${search.toLowerCase()}%`;
      query = query.or(`
        name.ilike.${searchTerm},
        email.ilike.${searchTerm},
        headline.ilike.${searchTerm},
        industry.ilike.${searchTerm},
        location.ilike.${searchTerm}
      `);
    }

    const { data: users, error } = await query;

    if (error) {
      console.error("Database error:", error);
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          error: "Database query failed",
          details: error.message 
        }),
      };
    }

    // Filter out existing partners
    const { data: existingPartnerships } = await supabase
      .from('synergy_partners')
      .select('a_user_id, b_user_id')
      .or(`a_user_id.eq.${currentUserId},b_user_id.eq.${currentUserId}`)
      .eq('partnership_status', 'active');

    const partnerIds = new Set();
    existingPartnerships?.forEach(partnership => {
      if (partnership.a_user_id === currentUserId) {
        partnerIds.add(partnership.b_user_id);
      } else {
        partnerIds.add(partnership.a_user_id);
      }
    });

    // Filter out existing partners and pending invitations
    const { data: pendingInvitations } = await supabase
      .from('synergy_invitations')
      .select('from_user_id, to_user_id')
      .or(`from_user_id.eq.${currentUserId},to_user_id.eq.${currentUserId}`)
      .eq('invitation_status', 'pending');

    const pendingIds = new Set();
    pendingInvitations?.forEach(invitation => {
      pendingIds.add(invitation.from_user_id);
      pendingIds.add(invitation.to_user_id);
    });

    const availableUsers = users?.filter(user => 
      !partnerIds.has(user.id) && !pendingIds.has(user.id)
    ) || [];

    // Format response
    const formattedUsers = availableUsers.map(user => ({
      id: user.id,
      name: user.name || 'Unknown User',
      email: user.email,
      headline: user.headline || 'LinkedIn Professional',
      industry: user.industry || 'Professional Services',
      location: user.location || 'Location not specified',
      avatarUrl: user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=0ea5e9&color=fff`,
      linkedinMemberUrn: user.linkedin_member_urn,
      dmaActive: user.dma_active,
      totalConnections: user.user_profiles?.total_connections || 0,
      profileCompleteness: user.user_profiles?.profile_completeness_score || 0,
      mutualConnections: Math.floor(Math.random() * 20), // This would be calculated from actual connections in production
      joinedDate: user.created_at
    }));

    console.log(`Found ${formattedUsers.length} available users for partnerships`);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
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
        details: error.message
      }),
    };
  }
}

async function getUserIdFromToken(authorization) {
  try {
    // Extract user info from LinkedIn token
    const response = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: {
        'Authorization': authorization,
        'LinkedIn-Version': '202312'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to get user info from LinkedIn');
    }

    const userInfo = await response.json();
    const linkedinUrn = `urn:li:person:${userInfo.sub}`;

    // Find user in database by LinkedIn URN
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('linkedin_member_urn', linkedinUrn)
      .single();

    return user?.id || null;
  } catch (error) {
    console.error('Error getting user ID from token:', error);
    return null;
  }
}
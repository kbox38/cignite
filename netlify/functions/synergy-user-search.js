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

  console.log("=== SYNERGY USER SEARCH (REAL DATABASE) ===");
  console.log("Search term:", search);
  console.log("Limit:", limit);
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

  try {
    // Get current user ID from LinkedIn token
    const currentUserId = await getUserIdFromToken(authorization);
    if (!currentUserId) {
      console.error("Failed to get user ID from token");
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Invalid token or user not found in database" }),
      };
    }

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
      console.error("Error fetching invitations:", invitationsError);
    }

    const pendingIds = new Set();
    pendingInvitations?.forEach(invitation => {
      pendingIds.add(invitation.from_user_id);
      pendingIds.add(invitation.to_user_id);
    });

    console.log("Pending invitation IDs:", Array.from(pendingIds));

    // Build search query for real users
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
      .neq('id', currentUserId)
      .limit(parseInt(limit));

    // Add search filters if search term provided
    if (search && search.trim()) {
      const searchTerm = search.trim();
      console.log("Applying search filter for:", searchTerm);
      
      query = query.or(`
        name.ilike.%${searchTerm}%,
        email.ilike.%${searchTerm}%,
        headline.ilike.%${searchTerm}%,
        industry.ilike.%${searchTerm}%,
        location.ilike.%${searchTerm}%
      `);
    }

    const { data: users, error: usersError } = await query;

    if (usersError) {
      console.error("Database error:", usersError);
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          error: "Database query failed",
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
        details: error.message,
        stack: error.stack
      }),
    };
  }
}

async function getUserIdFromToken(authorization) {
  try {
    console.log("Getting user ID from LinkedIn token...");
    
    // Extract user info from LinkedIn token
    const response = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: {
        'Authorization': authorization,
        'LinkedIn-Version': '202312'
      }
    });

    if (!response.ok) {
      console.error("LinkedIn userinfo API error:", response.status, response.statusText);
      throw new Error('Failed to get user info from LinkedIn');
    }

    const userInfo = await response.json();
    console.log("LinkedIn user info:", {
      sub: userInfo.sub,
      name: userInfo.name,
      email: userInfo.email
    });
    
    const linkedinUrn = `urn:li:person:${userInfo.sub}`;
    console.log("LinkedIn URN:", linkedinUrn);

    // Find user in database by LinkedIn URN
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, dma_active')
      .eq('linkedin_member_urn', linkedinUrn)
      .single();

    if (error) {
      console.error("Database lookup error:", error);
      
      // If user doesn't exist, create them
      if (error.code === 'PGRST116') {
        console.log("User not found in database, creating new user...");
        
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({
            email: userInfo.email,
            name: userInfo.name,
            given_name: userInfo.given_name,
            family_name: userInfo.family_name,
            avatar_url: userInfo.picture,
            linkedin_member_urn: linkedinUrn,
            headline: userInfo.headline || '',
            industry: userInfo.industry || '',
            location: userInfo.location || '',
            dma_active: true,
            dma_consent_date: new Date().toISOString()
          })
          .select('id')
          .single();

        if (createError) {
          console.error("Error creating user:", createError);
          throw new Error('Failed to create user in database');
        }

        console.log("Created new user:", newUser.id);
        return newUser.id;
      }
      
      throw new Error('Database lookup failed');
    }

    console.log("Found user in database:", user.id, user.name, "DMA active:", user.dma_active);
    return user.id;
  } catch (error) {
    console.error('Error getting user ID from token:', error);
    return null;
  }
}
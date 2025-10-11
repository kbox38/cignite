// netlify/functions/synergy-partners.mjs
// Fixed synergy partners function to work with new Synergy component

export async function handler(event, context) {
  console.log('🚀 SYNERGY PARTNERS: Handler started', {
    method: event.httpMethod,
    timestamp: new Date().toISOString(),
    headers: Object.keys(event.headers || {}),
    queryParams: event.queryStringParameters,
    body: event.body ? 'present' : 'empty'
  });

  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    console.log('✅ CORS preflight handled');
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
      body: "",
    };
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    if (event.httpMethod === "GET") {
      // GET method for loading partners
      return await getPartners(supabase, event);
    } else if (event.httpMethod === "POST") {
      // POST method for partner operations (invite, accept, etc.)
      return await handlePartnerOperations(supabase, event);
    } else {
      return {
        statusCode: 405,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: "Method not allowed" }),
      };
    }

  } catch (error) {
    console.error("❌ Synergy partners error:", error);
    
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString()
      }),
    };
  }
}

/**
 * Get user's synergy partners (GET method)
 */
async function getPartners(supabase, event) {
  try {
    const { userId } = event.queryStringParameters || {};
    
    console.log('📥 Getting partners for userId:', userId);

    if (!userId) {
      console.log('❌ Missing userId parameter');
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ 
          error: "userId parameter is required",
          received: event.queryStringParameters 
        }),
      };
    }

    // First verify user exists
    console.log('🔍 Verifying user exists:', userId);
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('id', userId)
      .single();

    if (userError) {
      console.log('❌ User verification failed:', userError);
      return {
        statusCode: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ 
          error: "User not found",
          details: userError.message 
        }),
      };
    }

    console.log('✅ User verified:', user);

    // Get partnerships where user is either a_user_id or b_user_id
    console.log('🔍 Fetching partnerships for user:', userId);
    const { data: partnerships, error: partnershipsError } = await supabase
      .from('synergy_partners')
      .select(`
        id,
        a_user_id,
        b_user_id,
        partnership_status,
        created_at,
        last_interaction,
        a_user:users!synergy_partners_a_user_id_fkey(
          id,
          name,
          email,
          avatar_url,
          linkedin_member_urn,
          linkedin_dma_member_urn,
          dma_active,
          last_posts_sync,
          posts_sync_status
        ),
        b_user:users!synergy_partners_b_user_id_fkey(
          id,
          name,
          email,
          avatar_url,
          linkedin_member_urn,
          linkedin_dma_member_urn,
          dma_active,
          last_posts_sync,
          posts_sync_status
        )
      `)
      .or(`a_user_id.eq.${userId},b_user_id.eq.${userId}`)
      .eq('partnership_status', 'active');

    if (partnershipsError) {
      console.error('❌ Partnerships query error:', partnershipsError);
      return {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ 
          error: "Failed to fetch partnerships",
          details: partnershipsError.message 
        }),
      };
    }

    console.log('📊 Raw partnerships data:', {
      count: partnerships?.length || 0,
      partnerships: partnerships
    });

    // Transform partnerships to partners list
    const partners = partnerships?.map(partnership => {
      // Determine which user is the partner (not the current user)
      const isAUser = partnership.a_user_id === userId;
      const partner = isAUser ? partnership.b_user : partnership.a_user;
      
      if (!partner) {
        console.warn('⚠️ Missing partner data in partnership:', partnership);
        return null;
      }
      
      console.log('🤝 Processing partner:', {
        partnershipId: partnership.id,
        isAUser,
        partnerId: partner.id,
        partnerName: partner.name
      });

      return {
        id: partner.id,
        name: partner.name,
        email: partner.email,
        avatarUrl: partner.avatar_url,
        linkedinMemberUrn: partner.linkedin_member_urn,
        linkedinDmaMemberUrn: partner.linkedin_dma_member_urn,
        dmaActive: partner.dma_active || false,
        lastPostsSync: partner.last_posts_sync,
        postsSyncStatus: partner.posts_sync_status,
        partnershipId: partnership.id,
        partnershipCreatedAt: partnership.created_at
      };
    }).filter(Boolean) || []; // Remove null entries

    console.log(`✅ Processed ${partners.length} partners for user ${userId}`);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        partners,
        count: partners.length,
        timestamp: new Date().toISOString(),
        debug: {
          userId: userId,
          partnershipsFound: partnerships?.length || 0,
          partnersProcessed: partners.length
        }
      }),
    };

  } catch (error) {
    console.error("❌ Get partners error:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Internal server error",
        message: error.message,
        timestamp: new Date().toISOString()
      }),
    };
  }
}

/**
 * Handle partner operations (POST method)
 */
async function handlePartnerOperations(supabase, event) {
  try {
    const requestBody = JSON.parse(event.body || '{}');
    const { action, userId } = requestBody;

    console.log('🔧 Handling partner operation:', { action, userId });

    switch (action) {
      case 'get_partners':
        return await getPartnersPost(supabase, requestBody);
      case 'search_users':
        return await searchUsers(supabase, requestBody);
      case 'send_invitation':
        return await sendInvitation(supabase, requestBody);
      case 'get_notifications':
        return await getNotifications(supabase, requestBody);
      case 'get_notifications_count':
        return await getNotificationsCount(supabase, requestBody);
      case 'respond_invitation':
        return await respondToInvitation(supabase, requestBody);
      default:
        return {
          statusCode: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({ 
            error: "Invalid action",
            validActions: ['get_partners', 'search_users', 'send_invitation', 'get_notifications', 'get_notifications_count', 'respond_invitation']
          }),
        };
    }

  } catch (error) {
    console.error("❌ Partner operations error:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Internal server error",
        message: error.message,
        timestamp: new Date().toISOString()
      }),
    };
  }
}

/**
 * Get partners via POST (legacy support)
 */
async function getPartnersPost(supabase, requestBody) {
  const { userId } = requestBody;
  
  // Create a mock event for the GET method
  const mockEvent = {
    queryStringParameters: { userId }
  };
  
  return await getPartners(supabase, mockEvent);
}

/**
 * Search available users for invitations
 */
async function searchUsers(supabase, requestBody) {
  try {
    const { userId } = requestBody;
    
    console.log('🔍 Searching users, excluding:', userId);

    // Get users who are not already partners and not the current user
    const { data: existingPartnerIds } = await supabase
      .from('synergy_partners')
      .select('a_user_id, b_user_id')
      .or(`a_user_id.eq.${userId},b_user_id.eq.${userId}`)
      .eq('partnership_status', 'active');

    // Extract partner IDs to exclude
    const excludeIds = [userId];
    existingPartnerIds?.forEach(partnership => {
      if (partnership.a_user_id !== userId) excludeIds.push(partnership.a_user_id);
      if (partnership.b_user_id !== userId) excludeIds.push(partnership.b_user_id);
    });

    console.log('🚫 Excluding user IDs:', excludeIds);

    // Get available users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select(`
        id,
        name,
        email,
        avatar_url,
        linkedin_member_urn,
        headline,
        industry,
        location
      `)
      .not('id', 'in', `(${excludeIds.join(',')})`)
      .limit(50);

    if (usersError) {
      throw usersError;
    }

    console.log(`✅ Found ${users?.length || 0} available users`);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        users: users || [],
        count: users?.length || 0,
        timestamp: new Date().toISOString()
      }),
    };

  } catch (error) {
    console.error("❌ Search users error:", error);
    throw error;
  }
}

/**
 * Send partnership invitation
 */
async function sendInvitation(supabase, requestBody) {
  try {
    const { fromUserId, toUserId, message } = requestBody;
    
    console.log('📧 Sending invitation:', { fromUserId, toUserId });

    // Create invitation record
    const { data: invitation, error: inviteError } = await supabase
      .from('synergy_invitations')
      .insert({
        from_user_id: fromUserId,
        to_user_id: toUserId,
        message: message || 'Would you like to be synergy partners?',
        invitation_status: 'pending',
        sent_at: new Date().toISOString()
      })
      .select()
      .single();

    if (inviteError) {
      throw inviteError;
    }

    console.log('✅ Invitation sent:', invitation);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        success: true,
        invitation,
        timestamp: new Date().toISOString()
      }),
    };

  } catch (error) {
    console.error("❌ Send invitation error:", error);
    throw error;
  }
}

/**
 * Get notifications for user
 */
async function getNotifications(supabase, requestBody) {
  try {
    const { userId } = requestBody;
    
    console.log('🔔 Getting notifications for:', userId);

    const { data: notifications, error: notifError } = await supabase
      .from('synergy_invitations')
      .select(`
        id,
        from_user_id,
        message,
        invitation_status,
        sent_at,
        from_user:users!synergy_invitations_from_user_id_fkey(
          id,
          name,
          email,
          avatar_url
        )
      `)
      .eq('to_user_id', userId)
      .eq('invitation_status', 'pending')
      .order('sent_at', { ascending: false });

    if (notifError) {
      throw notifError;
    }

    console.log(`✅ Found ${notifications?.length || 0} notifications`);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        notifications: notifications || [],
        count: notifications?.length || 0,
        timestamp: new Date().toISOString()
      }),
    };

  } catch (error) {
    console.error("❌ Get notifications error:", error);
    throw error;
  }
}

/**
 * Get notification count for user
 */
async function getNotificationsCount(supabase, requestBody) {
  try {
    const { userId } = requestBody;
    
    const { count, error: countError } = await supabase
      .from('synergy_invitations')
      .select('*', { count: 'exact', head: true })
      .eq('to_user_id', userId)
      .eq('invitation_status', 'pending');

    if (countError) {
      throw countError;
    }

    console.log(`✅ Notification count for ${userId}:`, count);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        count: count || 0,
        timestamp: new Date().toISOString()
      }),
    };

  } catch (error) {
    console.error("❌ Get notification count error:", error);
    throw error;
  }
}

/**
 * Respond to partnership invitation
 */
async function respondToInvitation(supabase, requestBody) {
  try {
    const { invitationId, response, userId } = requestBody;
    
    console.log('📨 Responding to invitation:', { invitationId, response, userId });

    // Update invitation status
    const { data: invitation, error: updateError } = await supabase
      .from('synergy_invitations')
      .update({
        invitation_status: response, // 'accepted' or 'declined'
        responded_at: new Date().toISOString()
      })
      .eq('id', invitationId)
      .eq('to_user_id', userId) // Security check
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    console.log('✅ Invitation response recorded:', invitation);

    // Note: Partnership creation is handled by database trigger when status = 'accepted'

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        success: true,
        invitation,
        timestamp: new Date().toISOString()
      }),
    };

  } catch (error) {
    console.error("❌ Respond to invitation error:", error);
    throw error;
  }
}
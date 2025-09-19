/**
 * Netlify Function: synergy-partners.js  
 * Manages synergy partnerships and available users
 * Fixed to match current export format and requirements
 */

// Main handler function - matching current repo export format
export async function handler(event, context) {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
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
      // Get user's synergy partners
      return await getPartners(supabase, event);
    } else if (event.httpMethod === "POST") {
      // Handle partner operations (invite, accept, etc.)
      return await handlePartnerOperation(supabase, event);
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
    console.error("Synergy partners error:", error);
    
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
 * Get user's synergy partners
 */
async function getPartners(supabase, event) {
  try {
    // Extract user ID from query params
    const url = new URL(event.rawUrl);
    const userId = url.searchParams.get('userId');

    // Debug logging
    console.log("=== DEBUG SYNERGY PARTNERS ===");
    console.log("Raw URL:", event.rawUrl);
    console.log("Query params:", url.searchParams.toString());
    console.log("Extracted userId:", userId);
    console.log("userId type:", typeof userId);
    console.log("userId is null:", userId === null);
    console.log("userId is undefined:", userId === undefined);
    console.log("userId is empty string:", userId === "");

    if (!userId || userId === "null" || userId === "undefined") {
      console.error("Missing or invalid userId parameter");
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ 
          error: "userId parameter is required", 
          debug: {
            receivedUserId: userId,
            type: typeof userId,
            rawUrl: event.rawUrl,
            queryParams: url.searchParams.toString()
          }
        }),
      };
    }

    console.log(`Getting partners for user: ${userId}`);

    // Get user's partnerships
    const { data: partnerships, error: partnershipsError } = await supabase
      .from('synergy_partners')
      .select(`
        id,
        partnership_status,
        created_at,
        a_user:a_user_id(id, name, email, avatar_url, linkedin_member_urn, linkedin_dma_member_urn, dma_active, last_posts_sync, posts_sync_status),
        b_user:b_user_id(id, name, email, avatar_url, linkedin_member_urn, linkedin_dma_member_urn, dma_active, last_posts_sync, posts_sync_status)
      `)
      .or(`a_user_id.eq.${userId},b_user_id.eq.${userId}`)
      .eq('partnership_status', 'active');

    if (partnershipsError) {
      throw new Error(`Failed to get partnerships: ${partnershipsError.message}`);
    }

    // Process partnerships to get partner users
    const partners = partnerships?.map(partnership => {
      const isUserA = partnership.a_user.id === userId;
      const partner = isUserA ? partnership.b_user : partnership.a_user;
      
      return {
        id: partner.id,
        name: partner.name,
        email: partner.email,
        avatarUrl: partner.avatar_url,
        linkedinMemberUrn: partner.linkedin_member_urn,
        linkedinDmaMemberUrn: partner.linkedin_dma_member_urn,
        dmaActive: partner.dma_active,
        lastPostsSync: partner.last_posts_sync,
        postsSyncStatus: partner.posts_sync_status,
        partnershipId: partnership.id,
        partnershipCreatedAt: partnership.created_at
      };
    }) || [];

    console.log(`Found ${partners.length} partners for user ${userId}`);

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
          partnershipsFound: partnerships?.length || 0
        }
      }),
    };

  } catch (error) {
    console.error("Get partners error:", error);
    throw error;
  }
}

/**
 * Handle partner operations (invite, accept, etc.)
 */
async function handlePartnerOperation(supabase, event) {
  try {
    const { action, userId, targetUserId, invitationId, message } = JSON.parse(event.body || '{}');

    switch (action) {
      case 'search_users':
        return await searchAvailableUsers(supabase, userId);
      
      case 'send_invitation':
        return await sendPartnerInvitation(supabase, userId, targetUserId, message);
      
      case 'accept_invitation':
        return await acceptPartnerInvitation(supabase, invitationId);
      
      case 'decline_invitation':
        return await declinePartnerInvitation(supabase, invitationId);
      
      default:
        return {
          statusCode: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({ error: "Invalid action" }),
        };
    }

  } catch (error) {
    console.error("Partner operation error:", error);
    throw error;
  }
}

/**
 * Search for available users to invite as partners
 */
async function searchAvailableUsers(supabase, userId) {
  console.log(`Searching available users for user: ${userId}`);

  // Get users who are DMA active and not already partners
  const { data: availableUsers, error } = await supabase
    .from('users')
    .select('id, name, email, avatar_url, linkedin_member_urn, headline, industry, location')
    .eq('dma_active', true)
    .neq('id', userId)
    .limit(50);

  if (error) {
    throw new Error(`Failed to search users: ${error.message}`);
  }

  // Filter out existing partners and pending invitations
  const { data: existingRelations } = await supabase
    .from('synergy_partners')
    .select('a_user_id, b_user_id')
    .or(`a_user_id.eq.${userId},b_user_id.eq.${userId}`);

  const { data: pendingInvitations } = await supabase
    .from('synergy_invitations')
    .select('from_user_id, to_user_id')
    .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
    .in('invitation_status', ['pending']);

  const excludedUserIds = new Set();
  
  // Add existing partners
  existingRelations?.forEach(rel => {
    excludedUserIds.add(rel.a_user_id === userId ? rel.b_user_id : rel.a_user_id);
  });
  
  // Add pending invitations
  pendingInvitations?.forEach(inv => {
    excludedUserIds.add(inv.from_user_id === userId ? inv.to_user_id : inv.from_user_id);
  });

  const filteredUsers = availableUsers?.filter(user => !excludedUserIds.has(user.id)) || [];

  console.log(`Found ${filteredUsers.length} available users`);

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify({
      users: filteredUsers,
      count: filteredUsers.length,
      timestamp: new Date().toISOString()
    }),
  };
}

/**
 * Send partner invitation
 */
async function sendPartnerInvitation(supabase, fromUserId, toUserId, message) {
  console.log(`Sending invitation from ${fromUserId} to ${toUserId}`);

  const { data: invitation, error } = await supabase
    .from('synergy_invitations')
    .insert({
      from_user_id: fromUserId,
      to_user_id: toUserId,
      message: message || '',
      invitation_status: 'pending'
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to send invitation: ${error.message}`);
  }

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify({
      success: true,
      invitation,
      message: "Invitation sent successfully"
    }),
  };
}

/**
 * Accept partner invitation
 */
async function acceptPartnerInvitation(supabase, invitationId) {
  console.log(`Accepting invitation: ${invitationId}`);

  // Get invitation details
  const { data: invitation, error: invError } = await supabase
    .from('synergy_invitations')
    .select('*')
    .eq('id', invitationId)
    .eq('invitation_status', 'pending')
    .single();

  if (invError || !invitation) {
    throw new Error('Invitation not found or already processed');
  }

  // Update invitation status
  await supabase
    .from('synergy_invitations')
    .update({ 
      invitation_status: 'accepted',
      responded_at: new Date().toISOString()
    })
    .eq('id', invitationId);

  // Create partnership (ensure consistent ordering: smaller ID first)
  const aUserId = invitation.from_user_id < invitation.to_user_id ? 
    invitation.from_user_id : invitation.to_user_id;
  const bUserId = invitation.from_user_id < invitation.to_user_id ? 
    invitation.to_user_id : invitation.from_user_id;

  const { data: partnership, error: partnershipError } = await supabase
    .from('synergy_partners')
    .insert({
      a_user_id: aUserId,
      b_user_id: bUserId,
      partnership_status: 'active'
    })
    .select()
    .single();

  if (partnershipError) {
    throw new Error(`Failed to create partnership: ${partnershipError.message}`);
  }

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify({
      success: true,
      partnership,
      message: "Partnership created successfully"
    }),
  };
}

/**
 * Decline partner invitation
 */
async function declinePartnerInvitation(supabase, invitationId) {
  console.log(`Declining invitation: ${invitationId}`);

  const { error } = await supabase
    .from('synergy_invitations')
    .update({ 
      invitation_status: 'declined',
      responded_at: new Date().toISOString()
    })
    .eq('id', invitationId)
    .eq('invitation_status', 'pending');

  if (error) {
    throw new Error(`Failed to decline invitation: ${error.message}`);
  }

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify({
      success: true,
      message: "Invitation declined"
    }),
  };
}
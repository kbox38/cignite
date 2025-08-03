export async function handler(event, context) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      },
    };
  }

  const { authorization } = event.headers;
  
  if (!authorization) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: "No authorization token" }),
    };
  }

  try {
    const userId = await getUserIdFromToken(authorization);
    
    if (!userId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Invalid token" }),
      };
    }

    if (event.httpMethod === "GET") {
      return await getPartnersAndInvitations(userId);
    } else if (event.httpMethod === "POST") {
      const { action, partnerId, invitationId } = JSON.parse(event.body || "{}");
      
      if (action === "invite") {
        return await sendPartnerInvitation(userId, partnerId);
      } else if (action === "accept") {
        return await acceptInvitation(userId, invitationId);
      } else if (action === "decline") {
        return await declineInvitation(userId, invitationId);
      }
      
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid action" }),
      };
    } else if (event.httpMethod === "DELETE") {
      const { partnerId } = JSON.parse(event.body || "{}");
      return await removePartner(userId, partnerId);
    }

    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  } catch (error) {
    console.error("Synergy partners error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: "Internal server error",
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

async function getPartnersAndInvitations(userId) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Get active partnerships
    const { data: partnerships, error: partnershipsError } = await supabase
      .from('synergy_partners')
      .select(`
        id,
        a_user_id,
        b_user_id,
        partnership_status,
        engagement_score,
        last_interaction,
        created_at,
        a_user:users!synergy_partners_a_user_id_fkey(
          id, name, email, avatar_url, headline, industry, location, linkedin_member_urn, dma_active
        ),
        b_user:users!synergy_partners_b_user_id_fkey(
          id, name, email, avatar_url, headline, industry, location, linkedin_member_urn, dma_active
        )
      `)
      .or(`a_user_id.eq.${userId},b_user_id.eq.${userId}`)
      .eq('partnership_status', 'active');

    if (partnershipsError) {
      console.error('Error fetching partnerships:', partnershipsError);
    }

    // Get pending invitations
    const { data: invitations, error: invitationsError } = await supabase
      .from('synergy_invitations')
      .select(`
        id,
        from_user_id,
        to_user_id,
        invitation_status,
        message,
        created_at,
        from_user:users!synergy_invitations_from_user_id_fkey(
          id, name, avatar_url, headline
        ),
        to_user:users!synergy_invitations_to_user_id_fkey(
          id, name, avatar_url, headline
        )
      `)
      .eq('to_user_id', userId)
      .eq('invitation_status', 'pending');

    if (invitationsError) {
      console.error('Error fetching invitations:', invitationsError);
    }

    // Format partners (return the partner user, not the current user)
    const partners = partnerships?.map(partnership => {
      const partner = partnership.a_user_id === userId ? partnership.b_user : partnership.a_user;
      return {
        id: partner.id,
        name: partner.name || 'Unknown User',
        email: partner.email,
        avatarUrl: partner.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(partner.name || 'User')}&background=0ea5e9&color=fff`,
        linkedinMemberUrn: partner.linkedin_member_urn,
        dmaActive: partner.dma_active,
        headline: partner.headline,
        industry: partner.industry,
        location: partner.location,
        engagementScore: partnership.engagement_score,
        lastInteraction: partnership.last_interaction,
        createdAt: partnership.created_at
      };
    }) || [];

    // Format pending invitations
    const pendingInvitations = invitations?.map(invitation => ({
      id: invitation.id,
      fromUserId: invitation.from_user_id,
      toUserId: invitation.to_user_id,
      fromUserName: invitation.from_user.name,
      fromUserAvatar: invitation.from_user.avatar_url,
      fromUserHeadline: invitation.from_user.headline,
      message: invitation.message,
      createdAt: invitation.created_at
    })) || [];

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ 
        partners,
        pendingInvitations
      }),
    };
  } catch (error) {
    console.error('Error in getPartnersAndInvitations:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: "Failed to get partners",
        details: error.message 
      }),
    };
  }
}

async function sendPartnerInvitation(fromUserId, toUserId) {
  try {
    if (!toUserId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Partner ID is required" }),
      };
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Check if invitation already exists
    const { data: existingInvitation } = await supabase
      .from('synergy_invitations')
      .select('id')
      .or(`
        and(from_user_id.eq.${fromUserId},to_user_id.eq.${toUserId}),
        and(from_user_id.eq.${toUserId},to_user_id.eq.${fromUserId})
      `)
      .single();

    if (existingInvitation) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invitation already exists" }),
      };
    }

    // Create invitation
    const { data: invitation, error } = await supabase
      .from('synergy_invitations')
      .insert({
        from_user_id: fromUserId,
        to_user_id: toUserId,
        invitation_status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating invitation:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Failed to create invitation" }),
      };
    }

    // Log activity
    await supabase.rpc('log_user_activity', {
      p_user_id: fromUserId,
      p_activity_type: 'synergy_link_created',
      p_description: 'Sent partnership invitation',
      p_metadata: { to_user_id: toUserId, invitation_id: invitation.id }
    });

    return {
      statusCode: 201,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ 
        success: true,
        message: "Partnership invitation sent successfully",
        invitationId: invitation.id
      }),
    };
  } catch (error) {
    console.error('Error in sendPartnerInvitation:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: "Failed to send invitation",
        details: error.message 
      }),
    };
  }
}

async function acceptInvitation(userId, invitationId) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Update invitation status
    const { data: invitation, error } = await supabase
      .from('synergy_invitations')
      .update({ 
        invitation_status: 'accepted',
        responded_at: new Date().toISOString()
      })
      .eq('id', invitationId)
      .eq('to_user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error accepting invitation:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Failed to accept invitation" }),
      };
    }

    // Log activity
    await supabase.rpc('log_user_activity', {
      p_user_id: userId,
      p_activity_type: 'partnership_created',
      p_description: 'Accepted partnership invitation',
      p_metadata: { invitation_id: invitationId, from_user_id: invitation.from_user_id }
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ 
        success: true,
        message: "Partnership invitation accepted"
      }),
    };
  } catch (error) {
    console.error('Error in acceptInvitation:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: "Failed to accept invitation",
        details: error.message 
      }),
    };
  }
}

async function declineInvitation(userId, invitationId) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Update invitation status
    const { error } = await supabase
      .from('synergy_invitations')
      .update({ 
        invitation_status: 'declined',
        responded_at: new Date().toISOString()
      })
      .eq('id', invitationId)
      .eq('to_user_id', userId);

    if (error) {
      console.error('Error declining invitation:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Failed to decline invitation" }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ 
        success: true,
        message: "Partnership invitation declined"
      }),
    };
  } catch (error) {
    console.error('Error in declineInvitation:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: "Failed to decline invitation",
        details: error.message 
      }),
    };
  }
}

async function removePartner(userId, partnerId) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Remove partnership
    const { error } = await supabase
      .from('synergy_partners')
      .delete()
      .or(`
        and(a_user_id.eq.${userId},b_user_id.eq.${partnerId}),
        and(a_user_id.eq.${partnerId},b_user_id.eq.${userId})
      `);

    if (error) {
      console.error('Error removing partner:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Failed to remove partner" }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ 
        success: true,
        message: "Partner removed successfully"
      }),
    };
  } catch (error) {
    console.error('Error in removePartner:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: "Failed to remove partner",
        details: error.message 
      }),
    };
  }
}
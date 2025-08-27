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
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: "No authorization token" }),
    };
  }

  try {
    // Identity verification: get verified user ID from token
    const userId = await getUserIdFromToken(authorization);
    
    if (!userId) {
      return {
        statusCode: 401,
        headers: {
          "Content-Type": "application/json", 
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: "Invalid token or user not found" }),
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
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: "Invalid action" }),
      };
    } else if (event.httpMethod === "DELETE") {
      const { partnerId } = JSON.parse(event.body || "{}");
      return await removePartner(userId, partnerId);
    }

    return {
      statusCode: 405,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  } catch (error) {
    console.error("Synergy partners error:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ 
        error: "Internal server error",
        details: error.message 
      }),
    };
  }
}

// Identity verification function - uses DMA token to verify user identity
async function getUserIdFromToken(authorization) {
  try {
    console.log("Verifying user identity from DMA token...");
    
    // Use LinkedIn DMA Member Authorization API for identity verification
    const response = await fetch('https://api.linkedin.com/rest/memberAuthorizations?q=memberAndApplication', {
      headers: {
        'Authorization': authorization,
        'LinkedIn-Version': '202312',
        'X-Restli-Protocol-Version': '2.0.0'
      }
    });

    if (!response.ok) {
      console.error("LinkedIn member auth error:", response.status, response.statusText);
      throw new Error(`Failed to verify user identity: ${response.status}`);
    }

    const authData = await response.json();
    console.log("Member auth verification successful");

    // Extract member URN from the authorizations response
    if (!authData.elements || authData.elements.length === 0) {
      throw new Error('No member authorization found');
    }

    const memberAuth = authData.elements[0];
    const personUrn = memberAuth.memberComplianceAuthorizationKey.member;
    console.log("Verified person URN:", personUrn);

    // Look up user in database by LinkedIn URN
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, linkedin_member_urn')
      .eq('linkedin_member_urn', personUrn)
      .single();

    if (error || !user) {
      console.error('User not found in database:', error);
      return null;
    }

    console.log("Identity verified for user:", user.name, "ID:", user.id);
    return user.id;
  } catch (error) {
    console.error('Error verifying user identity:', error);
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

    console.log("Fetching partners and invitations for user:", userId);

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
      const partner = partnership.a_user_id === userId ? 
        partnership.b_user : partnership.a_user;
      
      return {
        id: partner.id,
        name: partner.name,
        email: partner.email,
        avatarUrl: partner.avatar_url,
        headline: partner.headline,
        industry: partner.industry,
        location: partner.location,
        linkedinMemberUrn: partner.linkedin_member_urn,
        dmaActive: partner.dma_active,
        partnershipId: partnership.id,
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

    console.log(`Found ${partners.length} partners and ${pendingInvitations.length} pending invitations`);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        partners,
        pendingInvitations,
        metadata: {
          userId,
          totalPartners: partners.length,
          totalPendingInvitations: pendingInvitations.length,
          timestamp: new Date().toISOString()
        }
      }),
    };
  } catch (error) {
    console.error('Error in getPartnersAndInvitations:', error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: 'Failed to fetch partners and invitations',
        details: error.message
      }),
    };
  }
}

async function sendPartnerInvitation(userId, partnerId) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log(`Sending invitation from ${userId} to ${partnerId}`);

    // Validate that both users exist and have DMA active
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name, dma_active')
      .in('id', [userId, partnerId]);

    if (usersError || users.length !== 2) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: 'Invalid user IDs' }),
      };
    }

    const targetUser = users.find(u => u.id === partnerId);
    if (!targetUser.dma_active) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ 
          error: 'Target user does not have active DMA consent' 
        }),
      };
    }

    // Check if invitation already exists
    const { data: existingInvitation } = await supabase
      .from('synergy_invitations')
      .select('id')
      .eq('from_user_id', userId)
      .eq('to_user_id', partnerId)
      .single();

    if (existingInvitation) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: 'Invitation already sent' }),
      };
    }

    // Check if partnership already exists
    const { data: existingPartnership } = await supabase
      .from('synergy_partners')
      .select('id')
      .or(`and(a_user_id.eq.${userId},b_user_id.eq.${partnerId}),and(a_user_id.eq.${partnerId},b_user_id.eq.${userId})`)
      .eq('partnership_status', 'active')
      .single();

    if (existingPartnership) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: 'Partnership already exists' }),
      };
    }

    // Create invitation
    const { data: invitation, error: invitationError } = await supabase
      .from('synergy_invitations')
      .insert({
        from_user_id: userId,
        to_user_id: partnerId,
        invitation_status: 'pending'
      })
      .select()
      .single();

    if (invitationError) {
      console.error('Error creating invitation:', invitationError);
      return {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ 
          error: 'Failed to send invitation',
          details: invitationError.message 
        }),
      };
    }

    console.log("Invitation sent successfully:", invitation.id);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        success: true,
        invitationId: invitation.id,
        message: 'Invitation sent successfully'
      }),
    };
  } catch (error) {
    console.error('Error in sendPartnerInvitation:', error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: 'Failed to send invitation',
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

    console.log(`User ${userId} accepting invitation ${invitationId}`);

    // Get invitation details
    const { data: invitation, error: invitationError } = await supabase
      .from('synergy_invitations')
      .select('*')
      .eq('id', invitationId)
      .eq('to_user_id', userId)
      .eq('invitation_status', 'pending')
      .single();

    if (invitationError || !invitation) {
      return {
        statusCode: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: 'Invitation not found or already processed' }),
      };
    }

    // Start transaction: update invitation and create partnership
    const { error: updateError } = await supabase
      .from('synergy_invitations')
      .update({ 
        invitation_status: 'accepted',
        responded_at: new Date().toISOString()
      })
      .eq('id', invitationId);

    if (updateError) {
      console.error('Error updating invitation:', updateError);
      return {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: 'Failed to accept invitation' }),
      };
    }

    // Create partnership (ensure consistent ordering: smaller ID as a_user_id)
    const aUserId = invitation.from_user_id < invitation.to_user_id ? 
      invitation.from_user_id : invitation.to_user_id;
    const bUserId = invitation.from_user_id < invitation.to_user_id ? 
      invitation.to_user_id : invitation.from_user_id;

    const { data: partnership, error: partnershipError } = await supabase
      .from('synergy_partners')
      .insert({
        a_user_id: aUserId,
        b_user_id: bUserId,
        partnership_status: 'active',
        engagement_score: 0
      })
      .select()
      .single();

    if (partnershipError) {
      console.error('Error creating partnership:', partnershipError);
      return {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: 'Failed to create partnership' }),
      };
    }

    console.log("Partnership created successfully:", partnership.id);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        success: true,
        partnershipId: partnership.id,
        message: 'Invitation accepted and partnership created'
      }),
    };
  } catch (error) {
    console.error('Error in acceptInvitation:', error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: 'Failed to accept invitation',
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

    console.log(`User ${userId} declining invitation ${invitationId}`);

    const { error } = await supabase
      .from('synergy_invitations')
      .update({ 
        invitation_status: 'declined',
        responded_at: new Date().toISOString()
      })
      .eq('id', invitationId)
      .eq('to_user_id', userId)
      .eq('invitation_status', 'pending');

    if (error) {
      console.error('Error declining invitation:', error);
      return {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: 'Failed to decline invitation' }),
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
        message: 'Invitation declined'
      }),
    };
  } catch (error) {
    console.error('Error in declineInvitation:', error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: 'Failed to decline invitation',
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

    console.log(`User ${userId} removing partner ${partnerId}`);

    const { error } = await supabase
      .from('synergy_partners')
      .update({ partnership_status: 'ended' })
      .or(`and(a_user_id.eq.${userId},b_user_id.eq.${partnerId}),and(a_user_id.eq.${partnerId},b_user_id.eq.${userId})`)
      .eq('partnership_status', 'active');

    if (error) {
      console.error('Error removing partner:', error);
      return {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: 'Failed to remove partner' }),
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
        message: 'Partnership ended successfully'
      }),
    };
  } catch (error) {
    console.error('Error in removePartner:', error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: 'Failed to remove partner',
        details: error.message
      }),
    };
  }
}
/**
 * Netlify Function: synergy-invitations
 * Manages synergy partner invitations
 */

export default async function handler(event, context) {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return new Response("", {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      }
    });
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    if (event.httpMethod === "GET") {
      // Get user's invitations (received)
      return await getUserInvitations(supabase, event);
    } else if (event.httpMethod === "POST") {
      // Handle invitation actions
      return await handleInvitationAction(supabase, event);
    } else {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

  } catch (error) {
    console.error("Synergy invitations error:", error);
    
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

/**
 * Get user's received invitations
 */
async function getUserInvitations(supabase, event) {
  try {
    const url = new URL(event.rawUrl);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return new Response(JSON.stringify({ error: "userId parameter is required" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    console.log(`Getting invitations for user: ${userId}`);

    // Get pending invitations received by this user
    const { data: receivedInvitations, error: receivedError } = await supabase
      .from('synergy_invitations')
      .select(`
        id,
        message,
        invitation_status,
        created_at,
        from_user:from_user_id(id, name, email, avatar_url, headline, industry, location)
      `)
      .eq('to_user_id', userId)
      .eq('invitation_status', 'pending')
      .order('created_at', { ascending: false });

    if (receivedError) {
      throw new Error(`Failed to get received invitations: ${receivedError.message}`);
    }

    // Get sent invitations by this user
    const { data: sentInvitations, error: sentError } = await supabase
      .from('synergy_invitations')
      .select(`
        id,
        message,
        invitation_status,
        created_at,
        to_user:to_user_id(id, name, email, avatar_url, headline, industry, location)
      `)
      .eq('from_user_id', userId)
      .in('invitation_status', ['pending', 'accepted', 'declined'])
      .order('created_at', { ascending: false })
      .limit(10);

    if (sentError) {
      throw new Error(`Failed to get sent invitations: ${sentError.message}`);
    }

    const processedReceived = receivedInvitations?.map(inv => ({
      id: inv.id,
      type: 'received',
      message: inv.message,
      status: inv.invitation_status,
      createdAt: inv.created_at,
      user: {
        id: inv.from_user.id,
        name: inv.from_user.name,
        email: inv.from_user.email,
        avatarUrl: inv.from_user.avatar_url,
        headline: inv.from_user.headline,
        industry: inv.from_user.industry,
        location: inv.from_user.location
      }
    })) || [];

    const processedSent = sentInvitations?.map(inv => ({
      id: inv.id,
      type: 'sent',
      message: inv.message,
      status: inv.invitation_status,
      createdAt: inv.created_at,
      user: {
        id: inv.to_user.id,
        name: inv.to_user.name,
        email: inv.to_user.email,
        avatarUrl: inv.to_user.avatar_url,
        headline: inv.to_user.headline,
        industry: inv.to_user.industry,
        location: inv.to_user.location
      }
    })) || [];

    console.log(`Found ${processedReceived.length} received and ${processedSent.length} sent invitations`);

    return new Response(JSON.stringify({
      received: processedReceived,
      sent: processedSent,
      receivedCount: processedReceived.length,
      sentCount: processedSent.length,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });

  } catch (error) {
    console.error("Get invitations error:", error);
    throw error;
  }
}

/**
 * Handle invitation actions (accept, decline)
 */
async function handleInvitationAction(supabase, event) {
  try {
    const { action, invitationId, userId } = JSON.parse(event.body || '{}');

    switch (action) {
      case 'accept':
        return await acceptInvitation(supabase, invitationId, userId);
      
      case 'decline':
        return await declineInvitation(supabase, invitationId, userId);
      
      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
    }

  } catch (error) {
    console.error("Invitation action error:", error);
    throw error;
  }
}

/**
 * Accept invitation and create partnership
 */
async function acceptInvitation(supabase, invitationId, userId) {
  console.log(`User ${userId} accepting invitation ${invitationId}`);

  // Get and validate invitation
  const { data: invitation, error: invError } = await supabase
    .from('synergy_invitations')
    .select('*')
    .eq('id', invitationId)
    .eq('to_user_id', userId)
    .eq('invitation_status', 'pending')
    .single();

  if (invError || !invitation) {
    throw new Error('Invitation not found or already processed');
  }

  // Update invitation status
  const { error: updateError } = await supabase
    .from('synergy_invitations')
    .update({ 
      invitation_status: 'accepted',
      responded_at: new Date().toISOString()
    })
    .eq('id', invitationId);

  if (updateError) {
    throw new Error(`Failed to update invitation: ${updateError.message}`);
  }

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
      partnership_status: 'active',
      partnership_type: 'mutual'
    })
    .select()
    .single();

  if (partnershipError) {
    throw new Error(`Failed to create partnership: ${partnershipError.message}`);
  }

  console.log(`✅ Partnership created between users ${aUserId} and ${bUserId}`);

  return new Response(JSON.stringify({
    success: true,
    partnership,
    message: "Partnership created successfully"
  }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}

/**
 * Decline invitation
 */
async function declineInvitation(supabase, invitationId, userId) {
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
    throw new Error(`Failed to decline invitation: ${error.message}`);
  }

  return new Response(JSON.stringify({
    success: true,
    message: "Invitation declined"
  }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}/**
 * Netlify Function: synergy-invitations
 * Manages synergy partner invitations
 */

export default async function handler(event, context) {
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
      // Get user's invitations (received)
      return await getUserInvitations(supabase, event);
    } else if (event.httpMethod === "POST") {
      // Handle invitation actions
      return await handleInvitationAction(supabase, event);
    } else {
      return {
        statusCode: 405,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Method not allowed" }),
      };
    }

  } catch (error) {
    console.error("Synergy invitations error:", error);
    
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString()
      }),
    };
  }
}

/**
 * Get user's received invitations
 */
async function getUserInvitations(supabase, event) {
  try {
    const url = new URL(event.rawUrl);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "userId parameter is required" }),
      };
    }

    console.log(`Getting invitations for user: ${userId}`);

    // Get pending invitations received by this user
    const { data: receivedInvitations, error: receivedError } = await supabase
      .from('synergy_invitations')
      .select(`
        id,
        message,
        invitation_status,
        created_at,
        from_user:from_user_id(id, name, email, avatar_url, headline, industry, location)
      `)
      .eq('to_user_id', userId)
      .eq('invitation_status', 'pending')
      .order('created_at', { ascending: false });

    if (receivedError) {
      throw new Error(`Failed to get received invitations: ${receivedError.message}`);
    }

    // Get sent invitations by this user
    const { data: sentInvitations, error: sentError } = await supabase
      .from('synergy_invitations')
      .select(`
        id,
        message,
        invitation_status,
        created_at,
        to_user:to_user_id(id, name, email, avatar_url, headline, industry, location)
      `)
      .eq('from_user_id', userId)
      .in('invitation_status', ['pending', 'accepted', 'declined'])
      .order('created_at', { ascending: false })
      .limit(10);

    if (sentError) {
      throw new Error(`Failed to get sent invitations: ${sentError.message}`);
    }

    const processedReceived = receivedInvitations?.map(inv => ({
      id: inv.id,
      type: 'received',
      message: inv.message,
      status: inv.invitation_status,
      createdAt: inv.created_at,
      user: {
        id: inv.from_user.id,
        name: inv.from_user.name,
        email: inv.from_user.email,
        avatarUrl: inv.from_user.avatar_url,
        headline: inv.from_user.headline,
        industry: inv.from_user.industry,
        location: inv.from_user.location
      }
    })) || [];

    const processedSent = sentInvitations?.map(inv => ({
      id: inv.id,
      type: 'sent',
      message: inv.message,
      status: inv.invitation_status,
      createdAt: inv.created_at,
      user: {
        id: inv.to_user.id,
        name: inv.to_user.name,
        email: inv.to_user.email,
        avatarUrl: inv.to_user.avatar_url,
        headline: inv.to_user.headline,
        industry: inv.to_user.industry,
        location: inv.to_user.location
      }
    })) || [];

    console.log(`Found ${processedReceived.length} received and ${processedSent.length} sent invitations`);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        received: processedReceived,
        sent: processedSent,
        receivedCount: processedReceived.length,
        sentCount: processedSent.length,
        timestamp: new Date().toISOString()
      }),
    };

  } catch (error) {
    console.error("Get invitations error:", error);
    throw error;
  }
}

/**
 * Handle invitation actions (accept, decline)
 */
async function handleInvitationAction(supabase, event) {
  try {
    const { action, invitationId, userId } = JSON.parse(event.body || '{}');

    switch (action) {
      case 'accept':
        return await acceptInvitation(supabase, invitationId, userId);
      
      case 'decline':
        return await declineInvitation(supabase, invitationId, userId);
      
      default:
        return {
          statusCode: 400,
          headers: { "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ error: "Invalid action" }),
        };
    }

  } catch (error) {
    console.error("Invitation action error:", error);
    throw error;
  }
}

/**
 * Accept invitation and create partnership
 */
async function acceptInvitation(supabase, invitationId, userId) {
  console.log(`User ${userId} accepting invitation ${invitationId}`);

  // Get and validate invitation
  const { data: invitation, error: invError } = await supabase
    .from('synergy_invitations')
    .select('*')
    .eq('id', invitationId)
    .eq('to_user_id', userId)
    .eq('invitation_status', 'pending')
    .single();

  if (invError || !invitation) {
    throw new Error('Invitation not found or already processed');
  }

  // Update invitation status
  const { error: updateError } = await supabase
    .from('synergy_invitations')
    .update({ 
      invitation_status: 'accepted',
      responded_at: new Date().toISOString()
    })
    .eq('id', invitationId);

  if (updateError) {
    throw new Error(`Failed to update invitation: ${updateError.message}`);
  }

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
      partnership_status: 'active',
      partnership_type: 'mutual'
    })
    .select()
    .single();

  if (partnershipError) {
    throw new Error(`Failed to create partnership: ${partnershipError.message}`);
  }

  console.log(`✅ Partnership created between users ${aUserId} and ${bUserId}`);

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
 * Decline invitation
 */
async function declineInvitation(supabase, invitationId, userId) {
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
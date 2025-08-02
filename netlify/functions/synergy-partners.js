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
  // For demo purposes, return a mock user ID
  // In production, decode JWT or validate with your auth system
  return "550e8400-e29b-41d4-a716-446655440001";
}

async function getPartnersAndInvitations(userId) {
  try {
    // In production, query Supabase here
    // For now, return empty arrays since we're removing mock data
    const partners = [];
    const pendingInvitations = [];

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
    throw new Error(`Failed to get partners: ${error.message}`);
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

    // In production, insert invitation into Supabase
    console.log(`Sending invitation from ${fromUserId} to ${toUserId}`);

    return {
      statusCode: 201,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ 
        success: true,
        message: "Partnership invitation sent successfully"
      }),
    };
  } catch (error) {
    throw new Error(`Failed to send invitation: ${error.message}`);
  }
}

async function acceptInvitation(userId, invitationId) {
  try {
    // In production, update invitation status in Supabase
    console.log(`User ${userId} accepting invitation ${invitationId}`);
    
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
    throw new Error(`Failed to accept invitation: ${error.message}`);
  }
}

async function declineInvitation(userId, invitationId) {
  try {
    // In production, update invitation status in Supabase
    console.log(`User ${userId} declining invitation ${invitationId}`);
    
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
    throw new Error(`Failed to decline invitation: ${error.message}`);
  }
}

async function removePartner(userId, partnerId) {
  try {
    // In production, delete partnership from Supabase
    console.log(`Removing partnership between ${userId} and ${partnerId}`);

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
    throw new Error(`Failed to remove partner: ${error.message}`);
  }
}
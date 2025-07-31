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
    // Extract user ID from token (you'll need to implement this based on your auth system)
    const userId = await getUserIdFromToken(authorization);
    
    if (!userId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Invalid token" }),
      };
    }

    if (event.httpMethod === "GET") {
      return await getPartners(userId);
    } else if (event.httpMethod === "POST") {
      const { partnerId } = JSON.parse(event.body || "{}");
      return await addPartner(userId, partnerId);
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
  // This is a placeholder - implement based on your auth system
  // For now, we'll use a simple approach
  try {
    // You might decode JWT or validate with Supabase
    // For this example, we'll assume the token contains user info
    return "user-123"; // Replace with actual user ID extraction
  } catch (error) {
    console.error("Error extracting user ID:", error);
    return null;
  }
}

async function getPartners(userId) {
  try {
    // In a real implementation, you'd query Supabase here
    // For now, return mock data
    const partners = [
      {
        id: "partner-1",
        name: "Sarah Johnson",
        email: "sarah@example.com",
        avatarUrl: "https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=1",
        linkedinMemberUrn: "urn:li:person:sarah123",
        dmaActive: true,
        createdAt: new Date().toISOString()
      },
      {
        id: "partner-2", 
        name: "Michael Chen",
        email: "michael@example.com",
        avatarUrl: "https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=1",
        linkedinMemberUrn: "urn:li:person:michael456",
        dmaActive: true,
        createdAt: new Date().toISOString()
      }
    ];

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ partners }),
    };
  } catch (error) {
    throw new Error(`Failed to get partners: ${error.message}`);
  }
}

async function addPartner(userId, partnerId) {
  try {
    if (!partnerId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Partner ID is required" }),
      };
    }

    // In a real implementation, you'd:
    // 1. Validate that partnerId exists and has DMA consent
    // 2. Create the partnership in Supabase
    // 3. Return the updated partner list

    // Mock response for now
    const newPartnership = {
      id: `partnership-${Date.now()}`,
      aUserId: userId,
      bUserId: partnerId,
      createdAt: new Date().toISOString()
    };

    return {
      statusCode: 201,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ 
        success: true,
        partnership: newPartnership,
        message: "Partner added successfully"
      }),
    };
  } catch (error) {
    throw new Error(`Failed to add partner: ${error.message}`);
  }
}

async function removePartner(userId, partnerId) {
  try {
    if (!partnerId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Partner ID is required" }),
      };
    }

    // In a real implementation, you'd delete the partnership from Supabase

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
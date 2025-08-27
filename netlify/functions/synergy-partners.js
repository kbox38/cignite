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
    // Identity verification: get verified user ID from DMA token
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
      const { action, partnerId, invitationId } = JSON.parse(
        event.body || "{}"
      );

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
        details: error.message,
      }),
    };
  }
}

// Identity verification function - uses DMA token to verify user identity
async function getUserIdFromToken(authorization) {
  try {
    console.log("Verifying user identity from DMA token...");

    // Use LinkedIn DMA Member Authorization API for identity verification
    const response = await fetch(
      "https://api.linkedin.com/rest/memberAuthorizations?q=memberAndApplication",
      {
        headers: {
          Authorization: authorization,
          "LinkedIn-Version": "202312",
          "X-Restli-Protocol-Version": "2.0.0",
        },
      }
    );

    if (!response.ok) {
      console.error(
        "LinkedIn member auth error:",
        response.status,
        response.statusText
      );
      throw new Error(`Failed to verify user identity: ${response.status}`);
    }

    const authData = await response.json();
    console.log("Member auth verification successful");

    // Extract member URN from the authorizations response
    if (!authData.elements || authData.elements.length === 0) {
      throw new Error("No member authorization found");
    }

    const memberAuth = authData.elements[0];
    const personUrn = memberAuth.memberComplianceAuthorizationKey.member;
    console.log("Verified person URN:", personUrn);

    // Look up user in database by LinkedIn DMA URN
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: user, error } = await supabase
      .from("users")
      .select("id, name, linkedin_dma_member_urn")
      .eq("linkedin_dma_member_urn", personUrn)
      .single();

    if (error || !user) {
      console.error("User not found in database:", error);
      return null;
    }

    console.log("Identity verified for user:", user.name, "ID:", user.id);
    return user.id;
  } catch (error) {
    console.error("Error verifying user identity:", error);
    return null;
  }
}

async function getPartnersAndInvitations(userId) {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log("Fetching partners and invitations for user:", userId);

    // Get active partnerships
    const { data: partnerships, error: partnershipsError } = await supabase
      .from("synergy_partners")
      .select(
        `
        id,
        a_user_id,
        b_user_id,
        partnership_status,
        engagement_score,
        last_interaction,
        created_at,
        a_user:users!synergy_partners_a_user_id_fkey(
          id, name, email, avatar_url, headline, industry, location, linkedin_dma_member_urn, dma_active
        ),
        b_user:users!synergy_partners_b_user_id_fkey(
          id, name, email, avatar_url, headline, industry, location, linkedin_dma_member_urn, dma_active
        )
      `
      )
      .or(`a_user_id.eq.${userId},b_user_id.eq.${userId}`)
      .eq("partnership_status", "active");

    if (partnershipsError) {
      console.error("Error fetching partnerships:", partnershipsError);
    }

    // Get pending invitations
    const { data: invitations, error: invitationsError } = await supabase
      .from("synergy_invitations")
      .select(
        `
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
      `
      )
      .eq("to_user_id", userId)
      .eq("invitation_status", "pending");

    if (invitationsError) {
      console.error("Error fetching invitations:", invitationsError);
    }

    // Format partners (return the partner user, not the current user)
    const partners =
      partnerships?.map((partnership) => {
        const partner =
          partnership.a_user_id === userId
            ? partnership.b_user
            : partnership.a_user;

        return {
          id: partner.id,
          name: partner.name || "LinkedIn User",
          email: partner.email,
          avatarUrl:
            partner.avatar_url ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(
              partner.name || "User"
            )}&background=0ea5e9&color=fff`,
          headline: partner.headline || "LinkedIn Professional",
          industry: partner.industry || "Professional Services",
          location: partner.location || "Location not specified",
          linkedinDmaUrn: partner.linkedin_dma_member_urn,
          dmaActive: partner.dma_active,
          partnershipId: partnership.id,
          engagementScore: partnership.engagement_score,
          lastInteraction: partnership.last_interaction,
          partnershipDate: partnership.created_at,
        };
      }) || [];

    // Format invitations
    const formattedInvitations =
      invitations?.map((invitation) => ({
        id: invitation.id,
        fromUser: {
          id: invitation.from_user.id,
          name: invitation.from_user.name || "LinkedIn User",
          avatarUrl:
            invitation.from_user.avatar_url ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(
              invitation.from_user.name || "User"
            )}&background=0ea5e9&color=fff`,
          headline: invitation.from_user.headline || "LinkedIn Professional",
        },
        message: invitation.message,
        createdAt: invitation.created_at,
        status: invitation.invitation_status,
      })) || [];

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        partners,
        invitations: formattedInvitations,
        totalPartners: partners.length,
        pendingInvitations: formattedInvitations.length,
      }),
    };
  } catch (error) {
    console.error("Error fetching partners and invitations:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Failed to fetch partners and invitations",
        details: error.message,
      }),
    };
  }
}

async function sendPartnerInvitation(fromUserId, toUserId) {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log(
      "Sending partner invitation from:",
      fromUserId,
      "to:",
      toUserId
    );

    // Check if invitation already exists
    const { data: existingInvitation } = await supabase
      .from("synergy_invitations")
      .select("id")
      .eq("from_user_id", fromUserId)
      .eq("to_user_id", toUserId)
      .eq("invitation_status", "pending")
      .single();

    if (existingInvitation) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: "Invitation already sent" }),
      };
    }

    // Create new invitation
    const { data: invitation, error } = await supabase
      .from("synergy_invitations")
      .insert({
        from_user_id: fromUserId,
        to_user_id: toUserId,
        invitation_status: "pending",
        message: "Would you like to become Synergy partners?",
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating invitation:", error);
      throw error;
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        success: true,
        invitationId: invitation.id,
        message: "Invitation sent successfully",
      }),
    };
  } catch (error) {
    console.error("Error sending invitation:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Failed to send invitation",
        details: error.message,
      }),
    };
  }
}

async function acceptInvitation(userId, invitationId) {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log("Accepting invitation:", invitationId, "by user:", userId);

    // Get invitation details
    const { data: invitation, error: invitationError } = await supabase
      .from("synergy_invitations")
      .select("from_user_id, to_user_id")
      .eq("id", invitationId)
      .eq("to_user_id", userId)
      .eq("invitation_status", "pending")
      .single();

    if (invitationError || !invitation) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: "Invitation not found or not pending" }),
      };
    }

    // Create partnership (ensure consistent ordering)
    const aUserId =
      invitation.from_user_id < invitation.to_user_id
        ? invitation.from_user_id
        : invitation.to_user_id;
    const bUserId =
      invitation.from_user_id < invitation.to_user_id
        ? invitation.to_user_id
        : invitation.from_user_id;

    const { error: partnershipError } = await supabase
      .from("synergy_partners")
      .insert({
        a_user_id: aUserId,
        b_user_id: bUserId,
        partnership_status: "active",
        engagement_score: 0,
      });

    if (partnershipError) {
      console.error("Error creating partnership:", partnershipError);
      throw partnershipError;
    }

    // Update invitation status
    const { error: updateError } = await supabase
      .from("synergy_invitations")
      .update({
        invitation_status: "accepted",
        responded_at: new Date().toISOString(),
      })
      .eq("id", invitationId);

    if (updateError) {
      console.error("Error updating invitation:", updateError);
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        success: true,
        message: "Partnership created successfully",
      }),
    };
  } catch (error) {
    console.error("Error accepting invitation:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Failed to accept invitation",
        details: error.message,
      }),
    };
  }
}

async function declineInvitation(userId, invitationId) {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log("Declining invitation:", invitationId, "by user:", userId);

    // Update invitation status
    const { error } = await supabase
      .from("synergy_invitations")
      .update({
        invitation_status: "declined",
        responded_at: new Date().toISOString(),
      })
      .eq("id", invitationId)
      .eq("to_user_id", userId)
      .eq("invitation_status", "pending");

    if (error) {
      console.error("Error declining invitation:", error);
      throw error;
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        success: true,
        message: "Invitation declined successfully",
      }),
    };
  } catch (error) {
    console.error("Error declining invitation:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Failed to decline invitation",
        details: error.message,
      }),
    };
  }
}

async function removePartner(userId, partnerId) {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log("Removing partner:", partnerId, "for user:", userId);

    // Update partnership status to ended
    const { error } = await supabase
      .from("synergy_partners")
      .update({ partnership_status: "ended" })
      .or(`a_user_id.eq.${userId},b_user_id.eq.${userId}`)
      .or(`a_user_id.eq.${partnerId},b_user_id.eq.${partnerId}`)
      .eq("partnership_status", "active");

    if (error) {
      console.error("Error removing partner:", error);
      throw error;
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        success: true,
        message: "Partnership ended successfully",
      }),
    };
  } catch (error) {
    console.error("Error removing partner:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Failed to remove partner",
        details: error.message,
      }),
    };
  }
}

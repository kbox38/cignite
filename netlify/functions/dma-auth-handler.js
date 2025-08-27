// netlify/functions/dma-auth-handler.js
export async function handler(event, context) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
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
    console.log("Processing DMA authentication...");

    // Get DMA member URN from LinkedIn
    const dmaUrn = await getDmaUrnFromToken(authorization);

    if (!dmaUrn) {
      return {
        statusCode: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: "Failed to get DMA URN from token" }),
      };
    }

    // Update or create user with DMA URN
    const user = await updateUserWithDmaUrn(dmaUrn, authorization);

    if (!user) {
      return {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: "Failed to update user with DMA URN" }),
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
        userId: user.id,
        dmaUrn: user.linkedin_dma_member_urn,
        dmaActive: user.dma_active,
        message: "DMA authentication successful",
      }),
    };
  } catch (error) {
    console.error("DMA auth handler error:", error);
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

// Get DMA URN from LinkedIn token
async function getDmaUrnFromToken(authorization) {
  try {
    console.log("Getting DMA URN from LinkedIn...");

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
      throw new Error(`Failed to get DMA URN: ${response.status}`);
    }

    const authData = await response.json();
    console.log("Member auth verification successful");

    if (!authData.elements || authData.elements.length === 0) {
      throw new Error("No member authorization found");
    }

    const memberAuth = authData.elements[0];
    const dmaUrn = memberAuth.memberComplianceAuthorizationKey.member;
    console.log("Retrieved DMA URN:", dmaUrn);

    return dmaUrn;
  } catch (error) {
    console.error("Error getting DMA URN:", error);
    return null;
  }
}

// Update user with DMA URN or create if doesn't exist
async function updateUserWithDmaUrn(dmaUrn, authorization) {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log("Updating user with DMA URN:", dmaUrn);

    // First, try to find user by DMA URN
    let { data: existingUser, error: findError } = await supabase
      .from("users")
      .select("*")
      .eq("linkedin_dma_member_urn", dmaUrn)
      .single();

    if (existingUser) {
      console.log("User found with DMA URN, updating DMA status...");

      // Update existing user's DMA status
      const { data: updatedUser, error: updateError } = await supabase
        .from("users")
        .update({
          dma_active: true,
          dma_consent_date: new Date().toISOString(),
          last_login: new Date().toISOString(),
        })
        .eq("id", existingUser.id)
        .select()
        .single();

      if (updateError) {
        console.error("Error updating user DMA status:", updateError);
        throw updateError;
      }

      return updatedUser;
    }

    // If not found by DMA URN, get profile info and find by regular URN or email
    const profileInfo = await getProfileInfo(authorization);

    if (profileInfo) {
      // Try to find user by regular LinkedIn URN or email
      const { data: userByProfile } = await supabase
        .from("users")
        .select("*")
        .or(
          `linkedin_member_urn.eq.${profileInfo.linkedinUrn},email.eq.${profileInfo.email}`
        )
        .single();

      if (userByProfile) {
        console.log("User found by profile, adding DMA URN...");

        // Update existing user with DMA URN
        const { data: updatedUser, error: updateError } = await supabase
          .from("users")
          .update({
            linkedin_dma_member_urn: dmaUrn,
            dma_active: true,
            dma_consent_date: new Date().toISOString(),
            last_login: new Date().toISOString(),
            // Update profile info if available
            ...(profileInfo.name && { name: profileInfo.name }),
            ...(profileInfo.headline && { headline: profileInfo.headline }),
            ...(profileInfo.avatarUrl && { avatar_url: profileInfo.avatarUrl }),
          })
          .eq("id", userByProfile.id)
          .select()
          .single();

        if (updateError) {
          console.error("Error updating user with DMA URN:", updateError);
          throw updateError;
        }

        return updatedUser;
      }
    }

    // If no existing user found, create new user
    console.log("Creating new user with DMA URN...");

    const { data: newUser, error: createError } = await supabase
      .from("users")
      .insert({
        email: profileInfo?.email || `dma-user-${Date.now()}@example.com`,
        name: profileInfo?.name || "DMA User",
        linkedin_dma_member_urn: dmaUrn,
        linkedin_member_urn: profileInfo?.linkedinUrn,
        avatar_url: profileInfo?.avatarUrl,
        headline: profileInfo?.headline,
        dma_active: true,
        dma_consent_date: new Date().toISOString(),
        account_status: "active",
      })
      .select()
      .single();

    if (createError) {
      console.error("Error creating user:", createError);
      throw createError;
    }

    console.log("New user created with ID:", newUser.id);
    return newUser;
  } catch (error) {
    console.error("Error updating user with DMA URN:", error);
    return null;
  }
}

// Get basic profile info from LinkedIn (optional, for user creation)
async function getProfileInfo(authorization) {
  try {
    console.log("Getting basic profile info...");

    // Try to get basic profile info using standard LinkedIn API
    const response = await fetch(
      "https://api.linkedin.com/v2/people/~:(id,firstName,lastName,emailAddress,headline,profilePicture(displayImage~:playableStreams))",
      {
        headers: {
          Authorization: authorization,
          "X-Restli-Protocol-Version": "2.0.0",
        },
      }
    );

    if (!response.ok) {
      console.log("Standard profile API not available, using DMA only");
      return null;
    }

    const profile = await response.json();

    const profileInfo = {
      linkedinUrn: profile.id ? `urn:li:person:${profile.id}` : null,
      name:
        profile.firstName && profile.lastName
          ? `${profile.firstName.localized.en_US} ${profile.lastName.localized.en_US}`
          : null,
      email: profile.emailAddress || null,
      headline: profile.headline?.localized?.en_US || null,
      avatarUrl:
        profile.profilePicture?.displayImage?.elements?.[0]?.identifiers?.[0]
          ?.identifier || null,
    };

    console.log("Profile info retrieved:", profileInfo);
    return profileInfo;
  } catch (error) {
    console.log("Could not get profile info:", error.message);
    return null;
  }
}

export async function handler(event, context) {
  console.log("OAuth callback called with:", event.queryStringParameters);

  const { code, state } = event.queryStringParameters || {};

  if (!code) {
    console.error("No authorization code provided");
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "No authorization code provided" }),
    };
  }

  try {
    // Determine which client credentials to use based on state
    const clientId =
      state === "dma"
        ? process.env.LINKEDIN_DMA_CLIENT_ID
        : process.env.LINKEDIN_CLIENT_ID;
    const clientSecret =
      state === "dma"
        ? process.env.LINKEDIN_DMA_CLIENT_SECRET
        : process.env.LINKEDIN_CLIENT_SECRET;

    console.log("Using client ID:", clientId, "for state:", state);

    if (!clientId || !clientSecret) {
      console.error("Missing client credentials for state:", state);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing client credentials" }),
      };
    }

    const tokenResponse = await fetch(
      "https://www.linkedin.com/oauth/v2/accessToken",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: `${process.env.URL}/.netlify/functions/linkedin-oauth-callback`,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      }
    );

    const tokens = await tokenResponse.json();
    console.log("Token response:", tokens);

    if (tokens.error) {
      console.error("Token error:", tokens);
      throw new Error(tokens.error_description || tokens.error);
    }

    // If this is a DMA token, capture the DMA URN and get userId
    let userId = null;
    if (state === "dma") {
      console.log("Processing DMA token - capturing DMA URN...");
      const user = await captureDmaUrnOnFirstSignIn(
        `Bearer ${tokens.access_token}`
      );
      userId = user?.id;
    }

    // Store token type based on state
    const tokenType = state === "dma" ? "dma_token" : "access_token";
    const baseUrl =
      process.env.NODE_ENV === "development"
        ? "http://localhost:5173"
        : process.env.URL || "https://localhost:5173";

    // Include userId in redirect if available
    const redirectUrl = userId
      ? `${baseUrl}/?${tokenType}=${tokens.access_token}&user_id=${userId}`
      : `${baseUrl}/?${tokenType}=${tokens.access_token}`;
    console.log("Redirecting to:", redirectUrl);

    return {
      statusCode: 302,
      headers: {
        Location: redirectUrl,
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    };
  } catch (error) {
    console.error("OAuth callback error:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: error.message }),
    };
  }
}

// Capture DMA URN on first sign in
async function captureDmaUrnOnFirstSignIn(authorization) {
  try {
    console.log("Capturing DMA URN on first sign in...");

    // Get DMA URN from LinkedIn
    const dmaUrn = await getDmaUrnFromToken(authorization);

    if (!dmaUrn) {
      console.error("Failed to get DMA URN");
      return null;
    }

    // Update or create user with DMA URN
    const user = await updateUserWithDmaUrn(dmaUrn, authorization);

    if (user) {
      console.log("Successfully captured DMA URN for user:", user.id);
      return user; // Return the user object so we can access user.id
    } else {
      console.error("Failed to update user with DMA URN");
      return null;
    }
  } catch (error) {
    console.error("Error capturing DMA URN:", error);
    // Don't throw error here - we don't want to break the OAuth flow
    return null;
  }
}

// Get DMA URN from LinkedIn token
async function getDmaUrnFromToken(authorization) {
  try {
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
      return null;
    }

    const authData = await response.json();

    if (!authData.elements || authData.elements.length === 0) {
      console.error("No member authorization found");
      return null;
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
    let { data: existingUser } = await supabase
      .from("users")
      .select("*")
      .eq("linkedin_dma_member_urn", dmaUrn)
      .single();

    if (existingUser) {
      console.log("User found with DMA URN, updating DMA status...");

      const { data: updatedUser, error } = await supabase
        .from("users")
        .update({
          dma_active: true,
          dma_consent_date: new Date().toISOString(),
          last_login: new Date().toISOString(),
        })
        .eq("id", existingUser.id)
        .select()
        .single();

      return error ? null : updatedUser;
    }

    // If not found by DMA URN, get profile info and find by regular URN or email
    const profileInfo = await getBasicProfileInfo(authorization);

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

        const { data: updatedUser, error } = await supabase
          .from("users")
          .update({
            linkedin_dma_member_urn: dmaUrn,
            dma_active: true,
            dma_consent_date: new Date().toISOString(),
            last_login: new Date().toISOString(),
          })
          .eq("id", userByProfile.id)
          .select()
          .single();

        return error ? null : updatedUser;
      }
    }

    // Create new user if none found
    console.log("Creating new user with DMA URN...");

    const { data: newUser, error } = await supabase
      .from("users")
      .insert({
        email: profileInfo?.email || `dma-user-${Date.now()}@temp.com`,
        name: profileInfo?.name || "DMA User",
        linkedin_dma_member_urn: dmaUrn,
        linkedin_member_urn: profileInfo?.linkedinUrn,
        dma_active: true,
        dma_consent_date: new Date().toISOString(),
        account_status: "active",
      })
      .select()
      .single();

    return error ? null : newUser;
  } catch (error) {
    console.error("Error updating user with DMA URN:", error);
    return null;
  }
}

// Get basic profile info (optional, may fail with DMA-only tokens)
async function getBasicProfileInfo(authorization) {
  try {
    const response = await fetch(
      "https://api.linkedin.com/v2/people/~:(id,firstName,lastName,emailAddress)",
      {
        headers: {
          Authorization: authorization,
          "X-Restli-Protocol-Version": "2.0.0",
        },
      }
    );

    if (!response.ok) {
      console.log("Standard profile API not available with DMA token");
      return null;
    }

    const profile = await response.json();

    return {
      linkedinUrn: profile.id ? `urn:li:person:${profile.id}` : null,
      name:
        profile.firstName && profile.lastName
          ? `${profile.firstName.localized.en_US} ${profile.lastName.localized.en_US}`
          : null,
      email: profile.emailAddress || null,
    };
  } catch (error) {
    console.log("Could not get profile info:", error.message);
    return null;
  }
}

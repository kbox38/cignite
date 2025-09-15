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
      body: JSON.stringify({ error: "No authorization token" }),
    };
  }

  try {
    console.log("=== USER REGISTRATION START ===");

    // Get user info from LinkedIn
    const response = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: {
        'Authorization': authorization,
        'LinkedIn-Version': '202312'
      }
    });

    if (!response.ok) {
      console.error("LinkedIn API error:", response.status, response.statusText);
      throw new Error('Failed to get user info from LinkedIn');
    }

    const userInfo = await response.json();
    console.log("LinkedIn user info received:", {
      sub: userInfo.sub,
      name: userInfo.name,
      email: userInfo.email,
      given_name: userInfo.given_name,
      family_name: userInfo.family_name
    });

    const linkedinUrn = `urn:li:person:${userInfo.sub}`;
    
    // CRITICAL: Get DMA URN for synergy functionality
    let dmaUrn = null;
    try {
      console.log("Fetching DMA URN for synergy system...");
      const dmaResponse = await fetch(
        "https://api.linkedin.com/rest/memberAuthorizations?q=memberAndApplication",
        {
          headers: {
            Authorization: authorization,
            "LinkedIn-Version": "202312",
            "X-Restli-Protocol-Version": "2.0.0",
          },
        }
      );

      if (dmaResponse.ok) {
        const dmaData = await dmaResponse.json();
        if (dmaData.elements && dmaData.elements.length > 0) {
          dmaUrn = dmaData.elements[0].memberComplianceAuthorizationKey.member;
          console.log("DMA URN captured:", dmaUrn);
        }
      }
    } catch (dmaError) {
      console.warn("Could not fetch DMA URN:", dmaError.message);
    }

    // Connect to Supabase
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log("Supabase client initialized");

    // Check if user already exists
    let { data: existingUser, error: lookupError } = await supabase
      .from('users')
      .select('id, dma_active, name, email')
      .eq('linkedin_member_urn', linkedinUrn)
      .single();

    // If not found by regular URN, try DMA URN
    if (!existingUser && dmaUrn) {
      const { data: dmaUser } = await supabase
        .from('users')
        .select('id, dma_active, name, email')
        .eq('linkedin_dma_member_urn', dmaUrn)
        .single();
      
      if (dmaUser) {
        existingUser = dmaUser;
        console.log("User found by DMA URN:", dmaUser.id);
      }
    }
    if (existingUser) {
      console.log("User already exists:", existingUser.id, existingUser.name);
      
      // Update DMA status and last login
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          dma_active: true,
          linkedin_dma_member_urn: dmaUrn, // CRITICAL: Ensure DMA URN is stored
          dma_consent_date: new Date().toISOString(),
          last_login: new Date().toISOString(),
          name: userInfo.name,
          given_name: userInfo.given_name,
          family_name: userInfo.family_name,
          avatar_url: userInfo.picture,
          headline: userInfo.headline || '',
          industry: userInfo.industry || '',
          location: userInfo.location || ''
        })
        .eq('id', existingUser.id);

      if (updateError) {
        console.error('Error updating user:', updateError);
      } else {
        console.log("User updated successfully");
        
        // Log activity
        await supabase.rpc('log_user_activity', {
          p_user_id: existingUser.id,
          p_activity_type: 'login',
          p_description: 'User logged in and updated profile'
        });
      }

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ 
          success: true,
          message: "User updated successfully",
          userId: existingUser.id,
          isNewUser: false
        }),
      };
    }

    // Create new user if not found
    console.log("Creating new user...");
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        email: userInfo.email,
        name: userInfo.name,
        given_name: userInfo.given_name,
        family_name: userInfo.family_name,
        avatar_url: userInfo.picture,
        linkedin_member_urn: linkedinUrn,
        linkedin_dma_member_urn: dmaUrn, // CRITICAL: Store DMA URN for synergy
        headline: userInfo.headline || '',
        industry: userInfo.industry || '',
        location: userInfo.location || '',
        dma_active: true,
        dma_consent_date: new Date().toISOString(),
        onboarding_completed: false,
        terms_accepted: true,
        privacy_policy_accepted: true
      })
      .select('id, name, email')
      .single();

    if (createError) {
      console.error('Error creating user:', createError);
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          error: "Failed to create user",
          details: createError.message 
        }),
      };
    }

    console.log("User created successfully:", newUser.id, newUser.name);

    // Log activity for new user
    await supabase.rpc('log_user_activity', {
      p_user_id: newUser.id,
      p_activity_type: 'login',
      p_description: 'New user registered and logged in'
    });

    return {
      statusCode: 201,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ 
        success: true,
        message: "User registered successfully",
        userId: newUser.id,
        isNewUser: true
      }),
    };

  } catch (error) {
    console.error("User registration error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Failed to register user",
        details: error.message,
        stack: error.stack
      }),
    };
  }
}
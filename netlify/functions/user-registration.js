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

    // Connect to Supabase
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log("Supabase client initialized");

    // Check if user already exists
    const { data: existingUser, error: lookupError } = await supabase
      .from('users')
      .select('id, dma_active, name, email')
      .eq('linkedin_member_urn', linkedinUrn)
      .single();

    if (existingUser) {
      console.log("User already exists:", existingUser.id, existingUser.name);
      
      // Update DMA status and last login
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          dma_active: true,
          dma_consent_date: new Date().toISOString(),
          last_login: new Date().toISOString(),
          // Update profile info in case it changed
          name: userInfo.name,
          given_name: userInfo.given_name,
          family_name: userInfo.family_name,
          avatar_url: userInfo.picture
        })
        .eq('id', existingUser.id);

      if (updateError) {
        console.error('Error updating user:', updateError);
      } else {
        console.log("User updated successfully");
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
        headline: userInfo.headline || '',
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
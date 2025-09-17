// Fixed LinkedIn OAuth Callback - netlify/functions/linkedin-oauth-callback.js
export async function handler(event, context) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders
    };
  }

  try {
    const { code, state, error } = event.queryStringParameters || {};

    console.log('=== OAUTH CALLBACK DEBUG ===');
    console.log('Code:', code ? `${code.substring(0, 20)}...` : 'missing');
    console.log('State:', state);
    console.log('Error:', error);

    if (error) {
      console.error('OAuth error received:', error);
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: `OAuth error: ${error}` })
      };
    }

    if (!code) {
      console.error('No authorization code provided');
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'No authorization code provided' })
      };
    }

    // FIXED: Determine OAuth type and use correct credentials
    const isDMA = state === 'dma';
    const clientId = isDMA ? process.env.LINKEDIN_DMA_CLIENT_ID : process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = isDMA ? process.env.LINKEDIN_DMA_CLIENT_SECRET : process.env.LINKEDIN_CLIENT_SECRET;

    console.log('OAuth Type:', isDMA ? 'DMA' : 'Basic');
    console.log('Client ID:', clientId ? `${clientId.substring(0, 10)}...` : 'MISSING');
    console.log('Client Secret:', clientSecret ? 'Present' : 'MISSING');

    if (!clientId || !clientSecret) {
      console.error('Missing client credentials for OAuth type:', isDMA ? 'DMA' : 'Basic');
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Missing OAuth configuration' })
      };
    }

    // FIXED: Use same redirect URI logic as oauth-start
    const baseRedirectUri = `${process.env.URL}/.netlify/functions/linkedin-oauth-callback`;
    const redirectUri = process.env.NODE_ENV === 'development'
      ? 'http://localhost:8888/.netlify/functions/linkedin-oauth-callback'
      : baseRedirectUri;

    console.log('Redirect URI used:', redirectUri);

    // Exchange code for access token
    const tokenRequestBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    });

    console.log('Token request body:', tokenRequestBody.toString());

    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: tokenRequestBody,
    });

    console.log('Token response status:', tokenResponse.status);
    console.log('Token response headers:', Object.fromEntries(tokenResponse.headers));

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        body: errorText
      });
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ 
          error: 'Failed to exchange authorization code',
          details: errorText,
          status: tokenResponse.status
        })
      };
    }

    const tokenData = await tokenResponse.json();
    console.log('Token exchange successful, expires_in:', tokenData.expires_in);

    // Get profile info based on OAuth type
    let profileInfo = null;
    let dmaUrn = null;

    if (isDMA) {
      console.log('Processing DMA OAuth...');
      // For DMA flow, get DMA URN first
      dmaUrn = await getDmaUrn(tokenData.access_token);
      console.log('DMA URN retrieved:', dmaUrn || 'None');
      
      // Try to get basic profile info (may fail for DMA-only tokens)
      profileInfo = await getBasicProfileInfo(tokenData.access_token);
      
      if (!profileInfo && dmaUrn) {
        // Create minimal profile info from DMA URN
        const personId = dmaUrn.replace('urn:li:person:', '');
        profileInfo = {
          linkedinId: personId,
          linkedinUrn: dmaUrn,
          name: 'LinkedIn User',
          email: `dma-user-${personId}@linkedin.com`
        };
        console.log('Created minimal profile from DMA URN');
      }
    } else {
      console.log('Processing Basic OAuth...');
      // For basic OAuth, get profile info first
      profileInfo = await getBasicProfileInfo(tokenData.access_token);
      if (!profileInfo) {
        console.error('Failed to get profile information');
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Failed to get profile information' })
        };
      }

      // Try to get DMA URN (will likely be null for basic OAuth)
      dmaUrn = await getDmaUrn(tokenData.access_token);
      console.log('DMA URN from basic OAuth:', dmaUrn || 'None (expected for basic OAuth)');
    }

    // ENHANCED: Create or update user with better error handling
    const user = await createOrUpdateUser(profileInfo, tokenData.access_token, dmaUrn, isDMA);
    if (!user) {
      console.error('Failed to create or update user');
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Failed to create or update user' })
      };
    }

    console.log('User created/updated:', user.id);

    // Enable changelog generation for DMA users
    if (dmaUrn) {
      await enableChangelogGeneration(tokenData.access_token);
      console.log('Changelog generation enabled for DMA user');
    }

    // ENHANCED: Better response with debugging info
    const response = {
      success: true,
      oauth_type: isDMA ? 'dma' : 'basic',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url,
        dma_active: user.dma_active,
        linkedin_dma_member_urn: user.linkedin_dma_member_urn,
        linkedin_member_urn: user.linkedin_member_urn
      },
      tokens: {
        access_token: tokenData.access_token,
        expires_in: tokenData.expires_in
      }
    };

    console.log('=== OAUTH SUCCESS ===');
    console.log('User ID:', user.id);
    console.log('OAuth Type:', isDMA ? 'DMA' : 'Basic');
    console.log('DMA URN:', user.linkedin_dma_member_urn || 'None');

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(response)
    };

  } catch (error) {
    console.error('=== OAUTH CALLBACK ERROR ===');
    console.error('Error message:', error.message);
    console.error('Stack trace:', error.stack);
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
}

// Get basic profile information
async function getBasicProfileInfo(accessToken) {
  try {
    console.log('Fetching basic profile info...');
    
    const response = await fetch('https://api.linkedin.com/v2/people/~?projection=(id,firstName,lastName,emailAddress,profilePicture(displayImage~:playableStreams))', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'LinkedIn-Version': '202312'
      }
    });

    if (!response.ok) {
      console.error('Profile fetch failed:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Profile error details:', errorText);
      return null;
    }

    const profile = await response.json();
    console.log('Basic profile retrieved:', profile.id);

    return {
      linkedinId: profile.id,
      linkedinUrn: `urn:li:person:${profile.id}`,
      name: `${profile.firstName.localized.en_US} ${profile.lastName.localized.en_US}`,
      given_name: profile.firstName.localized.en_US,
      family_name: profile.lastName.localized.en_US,
      email: profile.emailAddress,
      picture: profile.profilePicture?.displayImage?.elements?.[0]?.identifiers?.[0]?.identifier || null
    };
  } catch (error) {
    console.error('Error fetching basic profile:', error);
    return null;
  }
}

// Get DMA URN from LinkedIn API
async function getDmaUrn(accessToken) {
  try {
    console.log('Fetching DMA URN...');
    
    const response = await fetch('https://api.linkedin.com/rest/memberAuthorizations?q=memberAndApplication', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'LinkedIn-Version': '202312'
      }
    });

    if (!response.ok) {
      console.log('DMA URN fetch failed (expected for basic OAuth):', response.status, response.statusText);
      return null;
    }

    const authData = await response.json();
    console.log('DMA authorization response received');

    if (!authData.elements || authData.elements.length === 0) {
      console.log('No DMA authorization found');
      return null;
    }

    const memberAuth = authData.elements[0];
    const dmaUrn = memberAuth.memberComplianceAuthorizationKey?.member;
    
    if (!dmaUrn) {
      console.log('No member URN in DMA response');
      return null;
    }

    console.log('DMA URN extracted:', dmaUrn);
    return dmaUrn;
  } catch (error) {
    console.error('Error fetching DMA URN:', error);
    return null;
  }
}

// Enable changelog generation for DMA users
async function enableChangelogGeneration(accessToken) {
  try {
    console.log('Enabling changelog generation...');
    
    const response = await fetch('https://api.linkedin.com/rest/memberAuthorizations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'LinkedIn-Version': '202312',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    if (!response.ok) {
      console.error('Failed to enable changelog:', response.status, response.statusText);
    } else {
      console.log('Changelog generation enabled');
    }
  } catch (error) {
    console.error('Error enabling changelog:', error);
  }
}

// ENHANCED: Create or update user with DMA URN support and better error handling
async function createOrUpdateUser(profileInfo, accessToken, dmaUrn, isDmaFlow = false) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('Creating/updating user...');
    console.log('Profile info available:', !!profileInfo);
    console.log('DMA URN available:', !!dmaUrn);
    console.log('Is DMA flow:', isDmaFlow);

    if (!profileInfo) {
      console.error('No profile info available');
      return null;
    }

    // Try to find existing user by multiple methods
    let existingUser = null;

    // 1. First try to find by DMA URN if available
    if (dmaUrn) {
      console.log('Looking for user by DMA URN...');
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('linkedin_dma_member_urn', dmaUrn)
        .single();
      
      if (data) {
        existingUser = data;
        console.log('User found by DMA URN:', existingUser.id);
      }
    }

    // 2. If not found, try by regular LinkedIn URN
    if (!existingUser && profileInfo.linkedinUrn) {
      console.log('Looking for user by LinkedIn URN...');
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('linkedin_member_urn', profileInfo.linkedinUrn)
        .single();
      
      if (data) {
        existingUser = data;
        console.log('User found by LinkedIn URN:', existingUser.id);
      }
    }

    // 3. If still not found, try by email
    if (!existingUser && profileInfo.email) {
      console.log('Looking for user by email...');
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('email', profileInfo.email)
        .single();
      
      if (data) {
        existingUser = data;
        console.log('User found by email:', existingUser.id);
      }
    }

    const now = new Date().toISOString();

    if (existingUser) {
      // Update existing user
      console.log('Updating existing user:', existingUser.id);
      
      const updateData = {
        name: profileInfo.name,
        given_name: profileInfo.given_name,
        family_name: profileInfo.family_name,
        avatar_url: profileInfo.picture,
        linkedin_member_urn: profileInfo.linkedinUrn,
        last_login: now,
        updated_at: now
      };

      // FIXED: Always update DMA URN if available and different from current
      if (dmaUrn && dmaUrn !== existingUser.linkedin_dma_member_urn) {
        updateData.linkedin_dma_member_urn = dmaUrn;
        updateData.dma_active = true;
        updateData.dma_consent_date = now;
        console.log('Adding/updating DMA URN for existing user');
      }

      const { data: updatedUser, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', existingUser.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating user:', error);
        return null;
      }

      console.log('User updated successfully');
      return updatedUser;
    } else {
      // Create new user
      console.log('Creating new user');
      
      const newUserData = {
        email: profileInfo.email,
        name: profileInfo.name,
        given_name: profileInfo.given_name,
        family_name: profileInfo.family_name,
        avatar_url: profileInfo.picture,
        linkedin_member_urn: profileInfo.linkedinUrn,
        account_status: 'active',
        last_login: now,
        created_at: now
      };

      // Add DMA URN if available
      if (dmaUrn) {
        newUserData.linkedin_dma_member_urn = dmaUrn;
        newUserData.dma_active = true;
        newUserData.dma_consent_date = now;
        console.log('Creating new user with DMA URN');
      }

      const { data: newUser, error } = await supabase
        .from('users')
        .insert(newUserData)
        .select()
        .single();

      if (error) {
        console.error('Error creating user:', error);
        console.error('Error details:', error.details);
        console.error('Error hint:', error.hint);
        console.error('User data attempted:', newUserData);
        return null;
      }

      console.log('New user created successfully:', newUser.id);
      return newUser;
    }
  } catch (error) {
    console.error('Error in createOrUpdateUser:', error);
    return null;
  }
}
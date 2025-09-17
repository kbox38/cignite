// netlify/functions/linkedin-oauth-callback.js - Simplified DMA-only version
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
    const { code, error } = event.queryStringParameters || {};

    console.log('=== DMA-ONLY OAUTH CALLBACK ===');
    console.log('Code:', code ? `${code.substring(0, 20)}...` : 'missing');

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

    // Always use DMA credentials
    const clientId = process.env.LINKEDIN_DMA_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_DMA_CLIENT_SECRET;

    console.log('Using DMA credentials');
    console.log('Client ID:', clientId ? `${clientId.substring(0, 10)}...` : 'MISSING');
    console.log('Client Secret:', clientSecret ? 'Present' : 'MISSING');

    if (!clientId || !clientSecret) {
      console.error('Missing DMA client credentials');
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Missing DMA OAuth configuration' })
      };
    }

    // Use same redirect URI logic
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

    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: tokenRequestBody,
    });

    console.log('Token response status:', tokenResponse.status);

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', {
        status: tokenResponse.status,
        body: errorText
      });
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ 
          error: 'Failed to exchange authorization code',
          details: errorText
        })
      };
    }

    const tokenData = await tokenResponse.json();
    console.log('✅ Token exchange successful');

    // Get DMA URN (this should work with DMA token)
    const dmaUrn = await getDmaUrn(tokenData.access_token);
    console.log('DMA URN retrieved:', dmaUrn || 'None');

    // Get basic profile info (fallback methods)
    const profileInfo = await getBasicProfileInfo(tokenData.access_token);
    
    if (!profileInfo) {
      console.log('Creating minimal profile from DMA URN only');
      if (dmaUrn) {
        const personId = dmaUrn.replace('urn:li:person:', '');
        profileInfo = {
          linkedinId: personId,
          linkedinUrn: dmaUrn,
          name: 'LinkedIn User',
          given_name: 'LinkedIn',
          family_name: 'User',
          email: `user-${personId}@linkedin.placeholder.com`,
          picture: null
        };
      } else {
        console.error('❌ No profile info and no DMA URN');
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Unable to retrieve user information' })
        };
      }
    }

    console.log('Profile ready:', profileInfo.name);

    // Create or update user (simplified for DMA-only)
    const user = await createOrUpdateUser(profileInfo, dmaUrn);
    if (!user) {
      console.error('Failed to create or update user');
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Failed to create or update user' })
      };
    }

    console.log('✅ User ready:', user.id);

    // Enable changelog generation
    await enableChangelogGeneration(tokenData.access_token);

    // Redirect back to app with DMA token
    const appBaseUrl = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:5173' 
      : process.env.URL.replace('/.netlify/functions/linkedin-oauth-callback', '');

    const redirectUrl = `${appBaseUrl}?dma_token=${encodeURIComponent(tokenData.access_token)}&user_id=${encodeURIComponent(user.id)}`;

    console.log('✅ Redirecting to app:', redirectUrl.substring(0, 100) + '...');

    return {
      statusCode: 302,
      headers: {
        ...corsHeaders,
        Location: redirectUrl
      }
    };

  } catch (error) {
    console.error('=== DMA OAUTH ERROR ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message
      })
    };
  }
}

// Simplified user creation for DMA-only flow
async function createOrUpdateUser(profileInfo, dmaUrn) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('=== DMA-ONLY USER CREATION ===');

    // Try to find existing user by multiple methods
    let existingUser = null;

    // 1. Try by DMA URN first
    if (dmaUrn) {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('linkedin_dma_member_urn', dmaUrn)
        .single();
      
      if (data) {
        existingUser = data;
        console.log('✅ Found user by DMA URN:', existingUser.id);
      }
    }

    // 2. Try by LinkedIn URN (for existing users)
    if (!existingUser && profileInfo.linkedinUrn) {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('linkedin_member_urn', profileInfo.linkedinUrn)
        .single();
      
      if (data) {
        existingUser = data;
        console.log('✅ Found user by LinkedIn URN:', existingUser.id);
      }
    }

    // 3. Try by email (skip placeholders)
    if (!existingUser && profileInfo.email && !profileInfo.email.includes('linkedin.placeholder.com')) {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('email', profileInfo.email)
        .single();
      
      if (data) {
        existingUser = data;
        console.log('✅ Found user by email:', existingUser.id);
      }
    }

    const now = new Date().toISOString();

    if (existingUser) {
      // Update existing user with DMA info
      console.log('Updating existing user with DMA permissions');
      
      const updateData = {
        name: profileInfo.name,
        given_name: profileInfo.given_name,
        family_name: profileInfo.family_name,
        avatar_url: profileInfo.picture,
        linkedin_member_urn: profileInfo.linkedinUrn,
        linkedin_dma_member_urn: dmaUrn || profileInfo.linkedinUrn,
        dma_active: true,
        dma_consent_date: now,
        last_login: now,
        updated_at: now
      };

      const { data: updatedUser, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', existingUser.id)
        .select()
        .single();

      if (error) {
        console.error('❌ Error updating user:', error);
        return null;
      }

      console.log('✅ User updated with DMA permissions');
      return updatedUser;
    } else {
      // Create new user with DMA permissions
      console.log('Creating new user with DMA permissions');
      
      const newUserData = {
        email: profileInfo.email,
        name: profileInfo.name,
        given_name: profileInfo.given_name,
        family_name: profileInfo.family_name,
        avatar_url: profileInfo.picture,
        linkedin_member_urn: profileInfo.linkedinUrn,
        linkedin_dma_member_urn: dmaUrn || profileInfo.linkedinUrn,
        dma_active: true,
        dma_consent_date: now,
        account_status: 'active',
        last_login: now,
        created_at: now
      };

      const { data: newUser, error } = await supabase
        .from('users')
        .insert(newUserData)
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating user:', error);
        return null;
      }

      console.log('✅ New user created with DMA permissions');
      return newUser;
    }
  } catch (error) {
    console.error('Error in createOrUpdateUser:', error);
    return null;
  }
}

// Get DMA URN (same as before)
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
      console.log('DMA URN fetch failed:', response.status);
      return null;
    }

    const authData = await response.json();
    if (!authData.elements || authData.elements.length === 0) {
      console.log('No DMA authorization found');
      return null;
    }

    const memberAuth = authData.elements[0];
    const dmaUrn = memberAuth.memberComplianceAuthorizationKey?.member;
    
    if (dmaUrn) {
      console.log('✅ DMA URN extracted:', dmaUrn);
      return dmaUrn;
    }

    return null;
  } catch (error) {
    console.error('Error fetching DMA URN:', error);
    return null;
  }
}

// Get basic profile info with fallbacks (same as before but simplified)
async function getBasicProfileInfo(accessToken) {
  // Try userinfo first
  try {
    const response = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'LinkedIn-Version': '202312'
      }
    });

    if (response.ok) {
      const userinfo = await response.json();
      return {
        linkedinId: userinfo.sub,
        linkedinUrn: `urn:li:person:${userinfo.sub}`,
        name: userinfo.name || 'LinkedIn User',
        given_name: userinfo.given_name,
        family_name: userinfo.family_name,
        email: userinfo.email,
        picture: userinfo.picture
      };
    }
  } catch (error) {
    console.log('Userinfo failed:', error.message);
  }

  console.log('Could not get profile info from any method');
  return null;
}

// Enable changelog generation (same as before)
async function enableChangelogGeneration(accessToken) {
  try {
    const response = await fetch('https://api.linkedin.com/rest/memberAuthorizations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'LinkedIn-Version': '202312',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    if (response.ok) {
      console.log('✅ Changelog generation enabled');
    } else {
      console.log('⚠️  Changelog generation failed:', response.status);
    }
  } catch (error) {
    console.error('Error enabling changelog:', error);
  }
}
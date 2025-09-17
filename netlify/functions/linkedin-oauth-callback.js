// netlify/functions/linkedin-oauth-callback.js - Restored two-step flow with fixes
export async function handler(event, context) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders };
  }

  try {
    const { code, state, error } = event.queryStringParameters || {};

    console.log('=== OAUTH CALLBACK START ===');
    console.log('OAuth Type:', state || 'basic');
    console.log('Code:', code ? `${code.substring(0, 20)}...` : 'missing');

    if (error) {
      console.error('OAuth error:', error);
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: `OAuth error: ${error}` })
      };
    }

    if (!code) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'No authorization code provided' })
      };
    }

    // Determine OAuth type and use correct credentials
    const isDMA = state === 'dma';
    const clientId = isDMA ? process.env.LINKEDIN_DMA_CLIENT_ID : process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = isDMA ? process.env.LINKEDIN_DMA_CLIENT_SECRET : process.env.LINKEDIN_CLIENT_SECRET;

    console.log('Using credentials for:', isDMA ? 'DMA' : 'Basic', 'OAuth');

    if (!clientId || !clientSecret) {
      console.error('Missing client credentials for OAuth type:', isDMA ? 'DMA' : 'Basic');
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: `Missing ${isDMA ? 'DMA' : 'Basic'} OAuth configuration` })
      };
    }

    // Use same redirect URI logic as oauth-start
    const baseRedirectUri = `${process.env.URL}/.netlify/functions/linkedin-oauth-callback`;
    const redirectUri = process.env.NODE_ENV === 'development'
      ? 'http://localhost:8888/.netlify/functions/linkedin-oauth-callback'
      : baseRedirectUri;

    console.log('Using redirect URI:', redirectUri);

    // Exchange code for access token
    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
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
    console.log('✅ Token exchange successful for', isDMA ? 'DMA' : 'Basic');

    // Get profile info and DMA URN based on OAuth type
    let profileInfo = null;
    let dmaUrn = null;

    if (isDMA) {
      console.log('=== PROCESSING DMA OAUTH ===');
      
      // For DMA flow, get DMA URN first
      dmaUrn = await getDmaUrn(tokenData.access_token);
      console.log('DMA URN retrieved:', dmaUrn || 'None');
      
      // Try to get basic profile info (may be limited for DMA-only tokens)
      profileInfo = await getBasicProfileInfo(tokenData.access_token);
      
      if (!profileInfo && dmaUrn) {
        // Create minimal profile info from DMA URN
        const personId = dmaUrn.replace('urn:li:person:', '');
        profileInfo = {
          linkedinId: personId,
          linkedinUrn: dmaUrn,
          name: 'LinkedIn User',
          given_name: 'LinkedIn',
          family_name: 'User',
          email: null,
          picture: null
        };
        console.log('Created minimal profile from DMA URN');
      }
    } else {
      console.log('=== PROCESSING BASIC OAUTH ===');
      
      // For basic OAuth, get full profile info
      profileInfo = await getBasicProfileInfo(tokenData.access_token);
      if (!profileInfo) {
        console.error('Failed to get profile information for basic OAuth');
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Failed to get profile information' })
        };
      }

      // Try to get DMA URN (will likely be null for basic OAuth, that's expected)
      dmaUrn = await getDmaUrn(tokenData.access_token);
      console.log('DMA URN from basic OAuth:', dmaUrn || 'None (expected for basic OAuth)');
    }

    // FIXED: Create or update user with enhanced matching and DMA URN population
    const user = await createOrUpdateUser(profileInfo, tokenData.access_token, dmaUrn, isDMA);
    if (!user) {
      console.error('Failed to create or update user');
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Failed to create or update user' })
      };
    }

    console.log('✅ User processed:', {
      id: user.id,
      name: user.name,
      email: user.email,
      dmaUrn: user.linkedin_dma_member_urn || 'None'
    });

    // Enable changelog generation for DMA users
    if (dmaUrn) {
      await enableChangelogGeneration(tokenData.access_token);
      console.log('Changelog generation enabled');
    }

    // Redirect back to app with appropriate token
    const appBaseUrl = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:5173' 
      : process.env.URL.replace('/.netlify/functions/linkedin-oauth-callback', '');

    let redirectUrl;
    
    if (isDMA) {
      // For DMA OAuth, redirect with DMA token
      redirectUrl = `${appBaseUrl}?dma_token=${encodeURIComponent(tokenData.access_token)}&user_id=${encodeURIComponent(user.id)}`;
    } else {
      // For basic OAuth, redirect with access token
      redirectUrl = `${appBaseUrl}?access_token=${encodeURIComponent(tokenData.access_token)}&user_id=${encodeURIComponent(user.id)}`;
    }

    console.log('✅ Redirecting to app with', isDMA ? 'DMA' : 'access', 'token');

    return {
      statusCode: 302,
      headers: {
        ...corsHeaders,
        Location: redirectUrl
      }
    };

  } catch (error) {
    console.error('=== OAUTH CALLBACK ERROR ===');
    console.error(error);
    
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

// Get basic profile information with multiple fallback methods
async function getBasicProfileInfo(accessToken) {
  console.log('=== FETCHING PROFILE INFO ===');
  
  // Method 1: Try userinfo endpoint (OpenID Connect - most reliable for basic OAuth)
  try {
    console.log('Method 1: Trying userinfo endpoint...');
    const userinfoResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'LinkedIn-Version': '202312'
      }
    });

    if (userinfoResponse.ok) {
      const userinfo = await userinfoResponse.json();
      console.log('✅ Userinfo success:', userinfo.name);
      
      return {
        linkedinId: userinfo.sub,
        linkedinUrn: `urn:li:person:${userinfo.sub}`,
        name: userinfo.name || `${userinfo.given_name || ''} ${userinfo.family_name || ''}`.trim(),
        given_name: userinfo.given_name,
        family_name: userinfo.family_name,
        email: userinfo.email,
        picture: userinfo.picture
      };
    } else {
      console.log('❌ Userinfo failed:', userinfoResponse.status);
    }
  } catch (error) {
    console.log('❌ Userinfo error:', error.message);
  }

  // Method 2: Try people endpoint with full projection
  try {
    console.log('Method 2: Trying people endpoint...');
    const peopleResponse = await fetch('https://api.linkedin.com/v2/people/~?projection=(id,firstName,lastName,emailAddress,profilePicture(displayImage~:playableStreams))', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0'
      }
    });

    if (peopleResponse.ok) {
      const profile = await peopleResponse.json();
      console.log('✅ People API success:', profile.id);
      
      return {
        linkedinId: profile.id,
        linkedinUrn: `urn:li:person:${profile.id}`,
        name: `${profile.firstName?.localized?.en_US || ''} ${profile.lastName?.localized?.en_US || ''}`.trim() || 'LinkedIn User',
        given_name: profile.firstName?.localized?.en_US,
        family_name: profile.lastName?.localized?.en_US,
        email: profile.emailAddress,
        picture: profile.profilePicture?.displayImage?.elements?.[0]?.identifiers?.[0]?.identifier || null
      };
    } else {
      console.log('❌ People API failed:', peopleResponse.status);
    }
  } catch (error) {
    console.log('❌ People API error:', error.message);
  }

  console.log('❌ All profile methods failed');
  return null;
}

// ENHANCED: Create or update user with proper DMA URN handling
async function createOrUpdateUser(profileInfo, accessToken, dmaUrn, isDmaFlow = false) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('=== USER MANAGEMENT ===');
    console.log('Profile available:', !!profileInfo);
    console.log('DMA URN available:', !!dmaUrn);
    console.log('Is DMA flow:', isDmaFlow);

    if (!profileInfo) {
      console.error('No profile info available');
      return null;
    }

    // ENHANCED: Find existing user with multiple strategies
    let existingUser = null;

    // Strategy 1: Find by DMA URN if available
    if (dmaUrn) {
      console.log('Looking for user by DMA URN:', dmaUrn);
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('linkedin_dma_member_urn', dmaUrn)
        .single();
      
      if (data) {
        existingUser = data;
        console.log('✅ Found user by DMA URN:', data.name);
      }
    }

    // Strategy 2: Find by LinkedIn URN
    if (!existingUser && profileInfo.linkedinUrn) {
      console.log('Looking for user by LinkedIn URN:', profileInfo.linkedinUrn);
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('linkedin_member_urn', profileInfo.linkedinUrn)
        .single();
      
      if (data) {
        existingUser = data;
        console.log('✅ Found user by LinkedIn URN:', data.name);
      }
    }

    // Strategy 3: Find by email (skip placeholder emails)
    if (!existingUser && profileInfo.email && !profileInfo.email.includes('placeholder')) {
      console.log('Looking for user by email:', profileInfo.email);
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('email', profileInfo.email)
        .single();
      
      if (data) {
        existingUser = data;
        console.log('✅ Found user by email:', data.name);
      }
    }

    // Strategy 4: For DMA flows, try name matching to connect existing users
    if (!existingUser && isDmaFlow && profileInfo.name && profileInfo.name !== 'LinkedIn User') {
      console.log('Looking for user by name match for DMA flow...');
      const { data: nameMatches } = await supabase
        .from('users')
        .select('*')
        .ilike('name', `%${profileInfo.name.split(' ')[0]}%`) // Match first name
        .order('last_login', { ascending: false })
        .limit(3);
      
      if (nameMatches && nameMatches.length > 0) {
        existingUser = nameMatches[0];
        console.log('✅ Found user by name match:', existingUser.name);
      }
    }

    const now = new Date().toISOString();

    if (existingUser) {
      console.log('=== UPDATING EXISTING USER ===');
      console.log('Current user:', existingUser.name, existingUser.email);
      
      const updateData = {
        // Preserve existing data if new data is not better
        name: (profileInfo.name && profileInfo.name !== 'LinkedIn User') ? profileInfo.name : existingUser.name,
        given_name: profileInfo.given_name || existingUser.given_name,
        family_name: profileInfo.family_name || existingUser.family_name,
        avatar_url: profileInfo.picture || existingUser.avatar_url,
        email: profileInfo.email || existingUser.email,
        linkedin_member_urn: profileInfo.linkedinUrn || existingUser.linkedin_member_urn,
        last_login: now,
        updated_at: now
      };

      // CRITICAL FIX: Always update DMA URN if available
      if (dmaUrn) {
        updateData.linkedin_dma_member_urn = dmaUrn;
        updateData.dma_active = true;
        updateData.dma_consent_date = now;
        console.log('✅ Updating DMA URN:', dmaUrn);
      } else if (isDmaFlow && profileInfo.linkedinUrn && !existingUser.linkedin_dma_member_urn) {
        // For DMA flows without explicit DMA URN, use LinkedIn URN
        updateData.linkedin_dma_member_urn = profileInfo.linkedinUrn;
        updateData.dma_active = true;
        updateData.dma_consent_date = now;
        console.log('✅ Setting DMA URN from LinkedIn URN:', profileInfo.linkedinUrn);
      }

      console.log('Update data summary:', {
        name: updateData.name,
        email: updateData.email,
        hasAvatar: !!updateData.avatar_url,
        dmaUrn: updateData.linkedin_dma_member_urn || 'unchanged'
      });

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

      console.log('✅ User updated successfully');
      return updatedUser;
    } else {
      console.log('=== CREATING NEW USER ===');
      
      const newUserData = {
        email: profileInfo.email || `user-${Date.now()}@placeholder.com`,
        name: profileInfo.name || 'LinkedIn User',
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
        console.log('✅ Creating user with DMA URN');
      } else if (isDmaFlow && profileInfo.linkedinUrn) {
        newUserData.linkedin_dma_member_urn = profileInfo.linkedinUrn;
        newUserData.dma_active = true;
        newUserData.dma_consent_date = now;
        console.log('✅ Creating user with LinkedIn URN as DMA URN');
      }

      const { data: newUser, error } = await supabase
        .from('users')
        .insert(newUserData)
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating user:', error);
        return null;
      }

      console.log('✅ New user created successfully');
      return newUser;
    }
  } catch (error) {
    console.error('Error in createOrUpdateUser:', error);
    return null;
  }
}

// Get DMA URN from LinkedIn API
async function getDmaUrn(accessToken) {
  try {
    const response = await fetch('https://api.linkedin.com/rest/memberAuthorizations?q=memberAndApplication', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'LinkedIn-Version': '202312'
      }
    });

    if (!response.ok) {
      console.log('DMA URN fetch failed (expected for basic OAuth):', response.status);
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
    }
    
    return dmaUrn;
  } catch (error) {
    console.error('Error fetching DMA URN:', error);
    return null;
  }
}

// Enable changelog generation for DMA users
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
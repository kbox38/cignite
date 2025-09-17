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

    console.log('=== PROFILE & DMA URN RETRIEVAL ===');

    if (isDMA) {
      console.log('Processing DMA OAuth flow...');
      
      // For DMA flow, get DMA URN first (this is critical)
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
          name: 'LinkedIn DMA User',
          given_name: 'LinkedIn',
          family_name: 'User',
          email: `dma-user-${personId}@linkedin.placeholder.com`,
          picture: null
        };
        console.log('✅ Created minimal profile from DMA URN');
      } else if (profileInfo) {
        console.log('✅ Got full profile info for DMA user');
      } else {
        console.log('❌ No profile info and no DMA URN');
      }
    } else {
      console.log('Processing Basic OAuth flow...');
      
      // For basic OAuth, get profile info first (this should work)
      profileInfo = await getBasicProfileInfo(tokenData.access_token);
      
      if (!profileInfo) {
        console.error('❌ CRITICAL: Failed to get profile information for basic OAuth');
        // Instead of failing completely, create a fallback profile
        console.log('Creating fallback profile...');
        profileInfo = {
          linkedinId: `fallback-${Date.now()}`,
          linkedinUrn: `urn:li:person:fallback-${Date.now()}`,
          name: 'LinkedIn User',
          given_name: 'LinkedIn',
          family_name: 'User', 
          email: `fallback-${Date.now()}@linkedin.placeholder.com`,
          picture: null
        };
        console.log('⚠️  Using fallback profile due to API issues');
      }

      // Try to get DMA URN (will likely be null for basic OAuth, that's OK)
      dmaUrn = await getDmaUrn(tokenData.access_token);
      console.log('DMA URN from basic OAuth:', dmaUrn || 'None (expected for basic OAuth)');
    }

    console.log('=== FINAL PROFILE STATUS ===');
    console.log('Profile available:', !!profileInfo);
    console.log('Profile name:', profileInfo?.name || 'None');
    console.log('DMA URN available:', !!dmaUrn);

    if (!profileInfo) {
      console.error('❌ FATAL: No profile information could be retrieved');
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ 
          error: 'Unable to retrieve user profile information',
          oauth_type: isDMA ? 'dma' : 'basic',
          details: 'All profile retrieval methods failed'
        })
      };
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

    // FIXED: Instead of returning JSON, redirect back to the app with tokens
    const appBaseUrl = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:5173' 
      : process.env.URL.replace('/.netlify/functions/linkedin-oauth-callback', '');

    let redirectUrl;
    
    if (isDMA) {
      // For DMA OAuth, redirect with DMA token and user ID
      redirectUrl = `${appBaseUrl}?dma_token=${encodeURIComponent(tokenData.access_token)}&user_id=${encodeURIComponent(user.id)}`;
    } else {
      // For basic OAuth, redirect with access token and user ID
      redirectUrl = `${appBaseUrl}?access_token=${encodeURIComponent(tokenData.access_token)}&user_id=${encodeURIComponent(user.id)}`;
    }

    console.log('Redirecting to:', redirectUrl);

    return {
      statusCode: 302,
      headers: {
        ...corsHeaders,
        Location: redirectUrl
      }
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

// Get basic profile information with multiple fallback methods
async function getBasicProfileInfo(accessToken) {
  console.log('=== PROFILE FETCH START ===');
  
  // Method 1: Try OpenID Connect userinfo endpoint (most reliable)
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
      console.log('✅ Userinfo success:', userinfo.sub);
      
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

  // Method 2: Try people endpoint without email (no email scope needed)
  try {
    console.log('Method 2: Trying people endpoint without email...');
    const peopleResponse = await fetch('https://api.linkedin.com/v2/people/~?projection=(id,firstName,lastName,profilePicture(displayImage~:playableStreams))', {
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
        email: `user-${profile.id}@linkedin.placeholder.com`, // Placeholder email
        picture: profile.profilePicture?.displayImage?.elements?.[0]?.identifiers?.[0]?.identifier || null
      };
    } else {
      const errorText = await peopleResponse.text();
      console.log('❌ People API failed:', peopleResponse.status, errorText);
    }
  } catch (error) {
    console.log('❌ People API error:', error.message);
  }

  // Method 3: Try basic profile with different headers
  try {
    console.log('Method 3: Trying basic profile with LinkedIn-Version...');
    const basicResponse = await fetch('https://api.linkedin.com/v2/people/~', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'LinkedIn-Version': '202312'
      }
    });

    if (basicResponse.ok) {
      const profile = await basicResponse.json();
      console.log('✅ Basic profile success:', profile.id);
      
      return {
        linkedinId: profile.id,
        linkedinUrn: `urn:li:person:${profile.id}`,
        name: profile.localizedFirstName && profile.localizedLastName 
          ? `${profile.localizedFirstName} ${profile.localizedLastName}`
          : 'LinkedIn User',
        given_name: profile.localizedFirstName,
        family_name: profile.localizedLastName,
        email: `user-${profile.id}@linkedin.placeholder.com`, // Placeholder email
        picture: null
      };
    } else {
      const errorText = await basicResponse.text();
      console.log('❌ Basic profile failed:', basicResponse.status, errorText);
    }
  } catch (error) {
    console.log('❌ Basic profile error:', error.message);
  }

  console.log('=== ALL PROFILE METHODS FAILED ===');
  return null;
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

    // ENHANCED: Try to find existing user by multiple methods with better matching
    let existingUser = null;

    // 1. First try to find by DMA URN if available
    if (dmaUrn) {
      console.log('Looking for user by DMA URN:', dmaUrn);
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('linkedin_dma_member_urn', dmaUrn)
        .single();
      
      if (data) {
        existingUser = data;
        console.log('✅ User found by DMA URN:', existingUser.id);
      }
    }

    // 2. If not found, try by regular LinkedIn URN
    if (!existingUser && profileInfo.linkedinUrn) {
      console.log('Looking for user by LinkedIn URN:', profileInfo.linkedinUrn);
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('linkedin_member_urn', profileInfo.linkedinUrn)
        .single();
      
      if (data) {
        existingUser = data;
        console.log('✅ User found by LinkedIn URN:', existingUser.id);
      }
    }

    // 3. ENHANCED: Try to find by email (but skip placeholder emails)
    if (!existingUser && profileInfo.email && !profileInfo.email.includes('linkedin.placeholder.com')) {
      console.log('Looking for user by email:', profileInfo.email);
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('email', profileInfo.email)
        .single();
      
      if (data) {
        existingUser = data;
        console.log('✅ User found by email:', existingUser.id);
      }
    }

    // 4. NEW: For DMA flows, try to find by name match if previous methods failed
    // This handles cases where LinkedIn gives different URNs for same user
    if (!existingUser && isDmaFlow && profileInfo.name && profileInfo.name !== 'LinkedIn DMA User') {
      console.log('Looking for user by name match for DMA flow:', profileInfo.name);
      const { data: nameMatches } = await supabase
        .from('users')
        .select('*')
        .eq('name', profileInfo.name)
        .limit(5);
      
      if (nameMatches && nameMatches.length > 0) {
        // If we have multiple matches, prefer the most recent one
        existingUser = nameMatches.sort((a, b) => 
          new Date(b.last_login || b.created_at).getTime() - new Date(a.last_login || a.created_at).getTime()
        )[0];
        console.log('✅ User found by name match:', existingUser.id);
      }
    }

    // 5. NEW: Last resort - for DMA flow, check if there's a recent user without DMA URN
    if (!existingUser && isDmaFlow) {
      console.log('Looking for recent user without DMA URN (last resort)...');
      const { data: recentUsers } = await supabase
        .from('users')
        .select('*')
        .is('linkedin_dma_member_urn', null)
        .order('last_login', { ascending: false })
        .limit(5);
      
      if (recentUsers && recentUsers.length > 0) {
        // Use the most recently active user
        existingUser = recentUsers[0];
        console.log('⚠️  Using most recent user without DMA URN:', existingUser.id, existingUser.name);
      }
    }

    const now = new Date().toISOString();

    if (existingUser) {
      // Update existing user
      console.log('=== UPDATING EXISTING USER ===');
      console.log('Found user:', existingUser.id, existingUser.name);
      console.log('Current DMA URN:', existingUser.linkedin_dma_member_urn || 'null');
      console.log('New DMA URN:', dmaUrn || 'null');
      
      // FIXED: Only set dma_active to true if we actually have a DMA URN
      const updateData = {
        name: profileInfo.name,
        given_name: profileInfo.given_name,
        family_name: profileInfo.family_name,
        avatar_url: profileInfo.picture,
        linkedin_member_urn: profileInfo.linkedinUrn,
        last_login: now,
        updated_at: now
      };

      // ENHANCED: Better DMA URN handling
      if (dmaUrn) {
        // Always update with real DMA URN from API
        updateData.linkedin_dma_member_urn = dmaUrn;
        updateData.dma_active = true;
        updateData.dma_consent_date = now;
        console.log('✅ Updating with real DMA URN from API');
      } else if (isDmaFlow) {
        // For DMA flow without explicit DMA URN, use LinkedIn URN
        if (profileInfo.linkedinUrn) {
          updateData.linkedin_dma_member_urn = profileInfo.linkedinUrn;
          updateData.dma_active = true;
          updateData.dma_consent_date = now;
          console.log('✅ Updating with LinkedIn URN as DMA URN');
        }
      } else {
        // For basic OAuth, only correct incorrect dma_active flags
        if (existingUser.dma_active && !existingUser.linkedin_dma_member_urn) {
          updateData.dma_active = false;
          console.log('⚠️  Correcting dma_active flag - was true but no DMA URN');
        }
      }

      console.log('Update data:', {
        name: updateData.name,
        linkedin_member_urn: updateData.linkedin_member_urn,
        linkedin_dma_member_urn: updateData.linkedin_dma_member_urn,
        dma_active: updateData.dma_active
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

      console.log('✅ User updated successfully:', updatedUser.id);
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

      // Add DMA URN if available, or derive from LinkedIn URN for DMA flows
      if (dmaUrn) {
        newUserData.linkedin_dma_member_urn = dmaUrn;
        newUserData.dma_active = true;
        newUserData.dma_consent_date = now;
        console.log('Creating new user with DMA URN');
      } else if (isDmaFlow && profileInfo.linkedinUrn) {
        // For DMA flows without explicit DMA URN, derive from LinkedIn URN
        newUserData.linkedin_dma_member_urn = profileInfo.linkedinUrn;
        newUserData.dma_active = true;
        newUserData.dma_consent_date = now;
        console.log('Creating new user with derived DMA URN from LinkedIn URN');
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
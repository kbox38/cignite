// netlify/functions/linkedin-oauth-callback.js - DMA-Only OAuth Callback
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

    console.log('=== DMA-ONLY OAUTH CALLBACK ===');
    console.log('Code:', code ? `${code.substring(0, 20)}...` : 'missing');
    console.log('State:', state);
    console.log('Error:', error);

    if (error) {
      console.error('OAuth error received:', error);
      return redirectToAppWithError(`OAuth error: ${error}`);
    }

    if (!code) {
      console.error('No authorization code provided');
      return redirectToAppWithError('No authorization code provided');
    }

    // Always use DMA credentials (no more type checking)
    const clientId = process.env.LINKEDIN_DMA_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_DMA_CLIENT_SECRET;

    console.log('Using DMA credentials');
    console.log('Client ID:', clientId ? `${clientId.substring(0, 10)}...` : 'MISSING');
    console.log('Client Secret:', clientSecret ? 'Present' : 'MISSING');

    if (!clientId || !clientSecret) {
      console.error('Missing DMA client credentials');
      return redirectToAppWithError('Missing DMA OAuth configuration');
    }

    // Determine redirect URI (same as oauth-start)
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

    console.log('Exchanging code for token...');

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
        statusText: tokenResponse.statusText,
        body: errorText
      });
      return redirectToAppWithError(`Failed to exchange authorization code: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();
    console.log('✅ Token exchange successful, expires_in:', tokenData.expires_in);

    // Get DMA URN (critical for synergy system)
    console.log('=== FETCHING DMA URN ===');
    const dmaUrn = await getDmaUrn(tokenData.access_token);
    console.log('DMA URN retrieved:', dmaUrn || 'None');

    // Get profile info with multiple fallback methods
    console.log('=== FETCHING PROFILE INFO ===');
    const profileInfo = await getProfileInfoWithFallbacks(tokenData.access_token, dmaUrn);
    console.log('Profile info retrieved:', !!profileInfo);

    if (!profileInfo) {
      console.error('❌ CRITICAL: No profile information could be retrieved');
      return redirectToAppWithError('Unable to retrieve user profile information');
    }

    // Create or update user with enhanced duplicate prevention
    console.log('=== CREATING/UPDATING USER ===');
    const user = await createOrUpdateUserEnhanced(profileInfo, tokenData.access_token, dmaUrn);
    
    if (!user) {
      console.error('Failed to create or update user');
      return redirectToAppWithError('Failed to create or update user account');
    }

    console.log('✅ User created/updated:', user.id, user.name);

    // Enable changelog generation for DMA users
    if (dmaUrn) {
      await enableChangelogGeneration(tokenData.access_token);
      console.log('✅ Changelog generation enabled');
    }

    // FIXED: Redirect to dashboard with DMA token
    const appBaseUrl = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:5173' 
      : process.env.URL.replace('/.netlify/functions/linkedin-oauth-callback', '');

    const redirectUrl = `${appBaseUrl}?dma_token=${encodeURIComponent(tokenData.access_token)}&user_id=${encodeURIComponent(user.id)}`;

    console.log('=== OAUTH SUCCESS - REDIRECTING TO DASHBOARD ===');
    console.log('User ID:', user.id);
    console.log('DMA URN:', user.linkedin_dma_member_urn || 'None');
    console.log('Redirect URL:', redirectUrl);

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
    
    return redirectToAppWithError(`Internal server error: ${error.message}`);
  }
}

// Enhanced DMA URN fetching
async function getDmaUrn(accessToken) {
  try {
    console.log('Fetching DMA URN from LinkedIn...');
    
    const response = await fetch('https://api.linkedin.com/rest/memberAuthorizations?q=memberAndApplication', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'LinkedIn-Version': '202312',
        'X-Restli-Protocol-Version': '2.0.0'
      }
    });

    if (!response.ok) {
      console.log('DMA URN fetch failed:', response.status, response.statusText);
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

    console.log('✅ DMA URN extracted:', dmaUrn);
    return dmaUrn;
  } catch (error) {
    console.error('Error fetching DMA URN:', error);
    return null;
  }
}

// Enhanced profile info fetching with multiple fallback methods
async function getProfileInfoWithFallbacks(accessToken, dmaUrn) {
  console.log('=== PROFILE FETCH WITH FALLBACKS ===');
  
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

  // Method 2: Try people endpoint without email scope
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
        email: `user-${profile.id}@linkedin.placeholder.com`,
        picture: profile.profilePicture?.displayImage?.elements?.[0]?.identifiers?.[0]?.identifier || null
      };
    } else {
      console.log('❌ People API failed:', peopleResponse.status);
    }
  } catch (error) {
    console.log('❌ People API error:', error.message);
  }

  // Method 3: Create minimal profile from DMA URN if available
  if (dmaUrn) {
    console.log('Method 3: Creating minimal profile from DMA URN...');
    const personId = dmaUrn.replace('urn:li:person:', '');
    
    return {
      linkedinId: personId,
      linkedinUrn: dmaUrn,
      name: 'LinkedIn DMA User',
      given_name: 'LinkedIn',
      family_name: 'User',
      email: `dma-user-${personId}@linkedin.placeholder.com`,
      picture: null
    };
  }

  console.log('=== ALL PROFILE METHODS FAILED ===');
  return null;
}

// Enhanced user creation with duplicate prevention
async function createOrUpdateUserEnhanced(profileInfo, accessToken, dmaUrn) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('=== ENHANCED USER CREATION/UPDATE ===');
    console.log('Profile info:', {
      name: profileInfo.name,
      email: profileInfo.email,
      linkedinUrn: profileInfo.linkedinUrn
    });
    console.log('DMA URN available:', !!dmaUrn);

    // Enhanced user lookup to prevent duplicates
    let existingUser = null;

    // 1. Find by DMA URN first (most reliable)
    if (dmaUrn) {
      console.log('1. Looking for user by DMA URN:', dmaUrn);
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('linkedin_dma_member_urn', dmaUrn)
        .single();
      
      if (data) {
        existingUser = data;
        console.log('✅ User found by DMA URN:', existingUser.id, existingUser.name);
      }
    }

    // 2. Find by regular LinkedIn URN
    if (!existingUser && profileInfo.linkedinUrn) {
      console.log('2. Looking for user by LinkedIn URN:', profileInfo.linkedinUrn);
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('linkedin_member_urn', profileInfo.linkedinUrn)
        .single();
      
      if (data) {
        existingUser = data;
        console.log('✅ User found by LinkedIn URN:', existingUser.id, existingUser.name);
      }
    }

    // 3. Find by email (skip placeholder emails)
    if (!existingUser && profileInfo.email && !profileInfo.email.includes('linkedin.placeholder.com')) {
      console.log('3. Looking for user by email:', profileInfo.email);
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('email', profileInfo.email)
        .single();
      
      if (data) {
        existingUser = data;
        console.log('✅ User found by email:', existingUser.id, existingUser.name);
      }
    }

    // 4. Find by name match (for DMA flows with different URNs)
    if (!existingUser && profileInfo.name && profileInfo.name !== 'LinkedIn DMA User') {
      console.log('4. Looking for user by name match:', profileInfo.name);
      const { data: nameMatches } = await supabase
        .from('users')
        .select('*')
        .eq('name', profileInfo.name)
        .limit(5);
      
      if (nameMatches && nameMatches.length > 0) {
        existingUser = nameMatches.sort((a, b) => 
          new Date(b.last_login || b.created_at).getTime() - new Date(a.last_login || a.created_at).getTime()
        )[0];
        console.log('✅ User found by name match:', existingUser.id, existingUser.name);
      }
    }

    const now = new Date().toISOString();

    if (existingUser) {
      // Update existing user
      console.log('=== UPDATING EXISTING USER ===');
      console.log('Current DMA URN:', existingUser.linkedin_dma_member_urn || 'null');
      console.log('New DMA URN:', dmaUrn || 'null');
      
      const updateData = {
        name: profileInfo.name,
        given_name: profileInfo.given_name,
        family_name: profileInfo.family_name,
        avatar_url: profileInfo.picture,
        linkedin_member_urn: profileInfo.linkedinUrn,
        linkedin_dma_member_urn: dmaUrn || profileInfo.linkedinUrn, // CRITICAL: Always populate DMA URN
        dma_active: true, // Always true for DMA-only OAuth
        dma_consent_date: now,
        last_login: now,
        updated_at: now
      };

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
      console.log('=== CREATING NEW USER ===');
      
      const newUserData = {
        email: profileInfo.email,
        name: profileInfo.name,
        given_name: profileInfo.given_name,
        family_name: profileInfo.family_name,
        avatar_url: profileInfo.picture,
        linkedin_member_urn: profileInfo.linkedinUrn,
        linkedin_dma_member_urn: dmaUrn || profileInfo.linkedinUrn, // CRITICAL: Always populate DMA URN
        dma_active: true, // Always true for DMA-only OAuth
        dma_consent_date: now,
        account_status: 'active',
        onboarding_completed: false,
        terms_accepted: true,
        privacy_policy_accepted: true,
        last_login: now,
        created_at: now
      };

      console.log('New user data:', {
        name: newUserData.name,
        email: newUserData.email,
        linkedin_member_urn: newUserData.linkedin_member_urn,
        linkedin_dma_member_urn: newUserData.linkedin_dma_member_urn,
        dma_active: newUserData.dma_active
      });

      const { data: newUser, error } = await supabase
        .from('users')
        .insert(newUserData)
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating user:', error);
        console.error('Error details:', error.details);
        console.error('Error hint:', error.hint);
        return null;
      }

      console.log('✅ New user created successfully:', newUser.id);
      return newUser;
    }
  } catch (error) {
    console.error('Error in createOrUpdateUserEnhanced:', error);
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
      console.log('✅ Changelog generation enabled');
    }
  } catch (error) {
    console.error('Error enabling changelog:', error);
  }
}

// Helper function to redirect to app with error
function redirectToAppWithError(errorMessage) {
  const appBaseUrl = process.env.NODE_ENV === 'development' 
    ? 'http://localhost:5173' 
    : process.env.URL.replace('/.netlify/functions/linkedin-oauth-callback', '');

  const redirectUrl = `${appBaseUrl}?error=${encodeURIComponent(errorMessage)}`;

  return {
    statusCode: 302,
    headers: {
      'Access-Control-Allow-Origin': '*',
      Location: redirectUrl
    }
  };
}
// netlify/functions/linkedin-oauth-callback.js - Fixed version
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
    const { code, error } = event.queryStringParameters || {};

    console.log('=== DMA OAUTH CALLBACK START ===');
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

    // Always use DMA credentials
    const clientId = process.env.LINKEDIN_DMA_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_DMA_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('Missing DMA OAuth credentials');
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Missing DMA OAuth configuration' })
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
    console.log('✅ Token exchange successful');

    // Get DMA URN first
    const dmaUrn = await getDmaUrn(tokenData.access_token);
    console.log('DMA URN:', dmaUrn || 'None');

    // Get comprehensive profile information
    const profileInfo = await getComprehensiveProfileInfo(tokenData.access_token, dmaUrn);
    console.log('Profile info:', {
      name: profileInfo?.name || 'None',
      email: profileInfo?.email || 'None',
      hasAvatar: !!profileInfo?.picture
    });

    // Find and update existing user or create new one
    const user = await findAndUpdateUser(profileInfo, dmaUrn);
    if (!user) {
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
      hasAvatar: !!user.avatar_url,
      dmaUrn: user.linkedin_dma_member_urn
    });

    // Enable changelog generation
    await enableChangelogGeneration(tokenData.access_token);

    // Redirect to app with DMA token
    const appBaseUrl = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:5173' 
      : process.env.URL.replace('/.netlify/functions/linkedin-oauth-callback', '');

    const redirectUrl = `${appBaseUrl}?dma_token=${encodeURIComponent(tokenData.access_token)}&user_id=${encodeURIComponent(user.id)}`;

    console.log('✅ Redirecting to app with user:', user.name);

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

// Enhanced profile information gathering
async function getComprehensiveProfileInfo(accessToken, dmaUrn) {
  console.log('=== GETTING COMPREHENSIVE PROFILE INFO ===');
  
  let profileInfo = null;

  // Method 1: Try userinfo endpoint (OpenID Connect)
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
      console.log('✅ Userinfo success');
      
      profileInfo = {
        linkedinId: userinfo.sub,
        linkedinUrn: `urn:li:person:${userinfo.sub}`,
        name: userinfo.name || `${userinfo.given_name || ''} ${userinfo.family_name || ''}`.trim(),
        given_name: userinfo.given_name,
        family_name: userinfo.family_name,
        email: userinfo.email,
        picture: userinfo.picture
      };
      
      if (profileInfo.name && profileInfo.email) {
        console.log('✅ Got complete profile from userinfo');
        return profileInfo;
      }
    }
  } catch (error) {
    console.log('❌ Userinfo method failed:', error.message);
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
      console.log('✅ People API success');
      
      profileInfo = {
        linkedinId: profile.id,
        linkedinUrn: `urn:li:person:${profile.id}`,
        name: `${profile.firstName?.localized?.en_US || ''} ${profile.lastName?.localized?.en_US || ''}`.trim() || 'LinkedIn User',
        given_name: profile.firstName?.localized?.en_US,
        family_name: profile.lastName?.localized?.en_US,
        email: profile.emailAddress,
        picture: profile.profilePicture?.displayImage?.elements?.[0]?.identifiers?.[0]?.identifier || null
      };
      
      if (profileInfo.name && profileInfo.name !== 'LinkedIn User') {
        console.log('✅ Got profile from people API');
        return profileInfo;
      }
    }
  } catch (error) {
    console.log('❌ People API method failed:', error.message);
  }

  // Method 3: Try basic people endpoint
  try {
    console.log('Method 3: Trying basic people endpoint...');
    const basicResponse = await fetch('https://api.linkedin.com/v2/people/~', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'LinkedIn-Version': '202312'
      }
    });

    if (basicResponse.ok) {
      const profile = await basicResponse.json();
      console.log('✅ Basic people API success');
      
      profileInfo = {
        linkedinId: profile.id,
        linkedinUrn: `urn:li:person:${profile.id}`,
        name: `${profile.localizedFirstName || ''} ${profile.localizedLastName || ''}`.trim() || 'LinkedIn User',
        given_name: profile.localizedFirstName,
        family_name: profile.localizedLastName,
        email: null, // Not available in basic endpoint
        picture: null
      };
      
      if (profileInfo.name && profileInfo.name !== 'LinkedIn User') {
        console.log('✅ Got basic profile info');
        return profileInfo;
      }
    }
  } catch (error) {
    console.log('❌ Basic people API failed:', error.message);
  }

  // Fallback: Create from DMA URN
  if (dmaUrn) {
    const personId = dmaUrn.replace('urn:li:person:', '');
    console.log('⚠️  Using DMA URN fallback');
    
    return {
      linkedinId: personId,
      linkedinUrn: dmaUrn,
      name: 'LinkedIn User',
      given_name: 'LinkedIn',
      family_name: 'User',
      email: null,
      picture: null
    };
  }

  console.log('❌ All profile methods failed');
  return null;
}

// Enhanced user finding and updating
async function findAndUpdateUser(profileInfo, dmaUrn) {
  if (!profileInfo) {
    console.error('No profile info provided');
    return null;
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('=== FINDING EXISTING USER ===');

    let existingUser = null;

    // Strategy 1: Find by DMA URN
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

    // Strategy 3: Find by email (if we have real email)
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

    // Strategy 4: CRITICAL - Find Kevin Box by name pattern
    if (!existingUser && profileInfo.name && profileInfo.name !== 'LinkedIn User') {
      console.log('Looking for user by name pattern...');
      const { data: nameMatches } = await supabase
        .from('users')
        .select('*')
        .or(`name.ilike.%kevin%,name.ilike.%box%`)
        .order('last_login', { ascending: false });
      
      if (nameMatches && nameMatches.length > 0) {
        existingUser = nameMatches[0]; // Take most recent
        console.log('✅ Found user by name pattern:', existingUser.name);
      }
    }

    // Strategy 5: Last resort - find recent user without DMA URN
    if (!existingUser) {
      console.log('Looking for recent users without DMA URN...');
      const { data: recentUsers } = await supabase
        .from('users')
        .select('*')
        .is('linkedin_dma_member_urn', null)
        .not('name', 'ilike', '%DMA User%')
        .order('last_login', { ascending: false })
        .limit(3);
      
      if (recentUsers && recentUsers.length > 0) {
        existingUser = recentUsers[0];
        console.log('⚠️  Found recent user without DMA URN:', existingUser.name);
      }
    }

    const now = new Date().toISOString();

    if (existingUser) {
      console.log('=== UPDATING EXISTING USER ===');
      console.log('Existing user:', existingUser.name, existingUser.email);
      
      const updateData = {
        // Keep the best data from both sources
        name: profileInfo.name && profileInfo.name !== 'LinkedIn User' ? profileInfo.name : existingUser.name,
        given_name: profileInfo.given_name || existingUser.given_name,
        family_name: profileInfo.family_name || existingUser.family_name,
        email: profileInfo.email || existingUser.email,
        avatar_url: profileInfo.picture || existingUser.avatar_url,
        
        // Update LinkedIn URNs
        linkedin_member_urn: profileInfo.linkedinUrn || existingUser.linkedin_member_urn,
        linkedin_dma_member_urn: dmaUrn || profileInfo.linkedinUrn || existingUser.linkedin_member_urn,
        
        // Update DMA status
        dma_active: true,
        dma_consent_date: now,
        last_login: now,
        updated_at: now
      };

      console.log('Update data:', {
        name: updateData.name,
        email: updateData.email,
        hasAvatar: !!updateData.avatar_url,
        dmaUrn: updateData.linkedin_dma_member_urn
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

      console.log('✅ User updated successfully:', updatedUser.name);
      return updatedUser;
    } else {
      console.log('=== CREATING NEW USER ===');
      
      const newUserData = {
        name: profileInfo.name || 'LinkedIn User',
        given_name: profileInfo.given_name,
        family_name: profileInfo.family_name,
        email: profileInfo.email || `user-${Date.now()}@linkedin.placeholder.com`,
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

      console.log('✅ New user created:', newUser.name);
      return newUser;
    }
  } catch (error) {
    console.error('Error in findAndUpdateUser:', error);
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
    
    return dmaUrn;
  } catch (error) {
    console.error('Error fetching DMA URN:', error);
    return null;
  }
}

// Enable changelog generation
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
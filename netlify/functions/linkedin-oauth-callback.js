// netlify/functions/linkedin-oauth-callback.js - DEBUG VERSION with enhanced logging
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

    console.log('🔍 DEBUG: OAuth Flow Type:', isDMA ? 'DMA' : 'Basic');
    console.log('🔍 DEBUG: Client ID exists:', !!clientId);
    console.log('🔍 DEBUG: Client Secret exists:', !!clientSecret);

    if (!clientId || !clientSecret) {
      console.error('❌ Missing client credentials for OAuth type:', isDMA ? 'DMA' : 'Basic');
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

    console.log('🔍 DEBUG: Redirect URI:', redirectUri);

    // Exchange code for access token
    console.log('🔄 Exchanging code for access token...');
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

    console.log('🔍 DEBUG: Token response status:', tokenResponse.status);

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('❌ Token exchange failed:', errorText);
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
    console.log('🔍 DEBUG: Token type:', tokenData.token_type);
    console.log('🔍 DEBUG: Access token length:', tokenData.access_token?.length || 0);
    console.log('🔍 DEBUG: Scope:', tokenData.scope);

    // Get profile info and DMA URN based on OAuth type
    let profileInfo = null;
    let dmaUrn = null;

    if (isDMA) {
      console.log('=== PROCESSING DMA OAUTH ===');
      
      // For DMA flow, get DMA URN first
      console.log('🔄 Attempting to get DMA URN...');
      dmaUrn = await getDmaUrn(tokenData.access_token);
      console.log('🔍 DEBUG: DMA URN result:', dmaUrn || 'NULL');
      
      if (!dmaUrn) {
        console.warn('⚠️  DMA URN extraction failed - this is critical for DMA flow');
      }
      
      // Try to get basic profile info (may be limited for DMA-only tokens)
      console.log('🔄 Attempting to get profile info for DMA token...');
      profileInfo = await getBasicProfileInfo(tokenData.access_token);
      console.log('🔍 DEBUG: Profile info from DMA token:', profileInfo ? 'SUCCESS' : 'FAILED');
      
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
        console.log('✅ Created minimal profile from DMA URN:', personId);
      }
    } else {
      console.log('=== PROCESSING BASIC OAUTH ===');
      
      // For basic OAuth, get full profile info
      console.log('🔄 Getting profile info for basic token...');
      profileInfo = await getBasicProfileInfo(tokenData.access_token);
      
      if (!profileInfo) {
        console.error('❌ Failed to get profile information for basic OAuth');
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Failed to get profile information' })
        };
      }
      
      console.log('✅ Profile info retrieved for basic OAuth');
      console.log('🔍 DEBUG: Profile name:', profileInfo.name);
      console.log('🔍 DEBUG: Profile email:', profileInfo.email);
      console.log('🔍 DEBUG: LinkedIn URN:', profileInfo.linkedinUrn);

      // Try to get DMA URN (will likely be null for basic OAuth, that's expected)
      console.log('🔄 Checking for DMA URN with basic token...');
      dmaUrn = await getDmaUrn(tokenData.access_token);
      console.log('🔍 DEBUG: DMA URN from basic OAuth:', dmaUrn || 'None (expected for basic OAuth)');
    }

    // Validate we have minimum required info
    if (!profileInfo) {
      console.error('❌ No profile information available');
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Unable to retrieve profile information' })
      };
    }

    // Create or update user with enhanced matching and DMA URN population
    console.log('🔄 Creating or updating user...');
    const user = await createOrUpdateUser(profileInfo, tokenData.access_token, dmaUrn, isDMA);
    
    if (!user) {
      console.error('❌ Failed to create or update user');
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Failed to create or update user' })
      };
    }

    console.log('✅ User processed successfully');
    console.log('🔍 DEBUG: User ID:', user.id);
    console.log('🔍 DEBUG: User name:', user.name);
    console.log('🔍 DEBUG: User email:', user.email);
    console.log('🔍 DEBUG: LinkedIn URN:', user.linkedin_member_urn);
    console.log('🔍 DEBUG: DMA URN:', user.linkedin_dma_member_urn || 'None');
    console.log('🔍 DEBUG: DMA Active:', user.dma_active);

    // Enable changelog generation for DMA users
    if (dmaUrn) {
      console.log('🔄 Enabling changelog generation...');
      await enableChangelogGeneration(tokenData.access_token);
      console.log('✅ Changelog generation enabled');
    }

    // Redirect back to app with appropriate token
    const appBaseUrl = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:5173' 
      : process.env.URL.replace('/.netlify/functions/linkedin-oauth-callback', '');

    let redirectUrl;
    
    if (isDMA) {
      // For DMA OAuth, redirect with DMA token
      redirectUrl = `${appBaseUrl}?dma_token=${encodeURIComponent(tokenData.access_token)}&user_id=${encodeURIComponent(user.id)}`;
      console.log('🔍 DEBUG: DMA redirect URL generated');
    } else {
      // For basic OAuth, redirect with access token
      redirectUrl = `${appBaseUrl}?access_token=${encodeURIComponent(tokenData.access_token)}&user_id=${encodeURIComponent(user.id)}`;
      console.log('🔍 DEBUG: Basic redirect URL generated');
    }

    console.log('🔍 DEBUG: Final redirect URL:', redirectUrl.substring(0, 100) + '...');
    console.log('✅ OAuth callback completed successfully');

    return {
      statusCode: 302,
      headers: {
        ...corsHeaders,
        Location: redirectUrl
      }
    };

  } catch (error) {
    console.error('💥 CRITICAL ERROR in OAuth callback:', error);
    console.error('💥 Error stack:', error.stack);
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Internal server error during OAuth callback',
        details: error.message
      })
    };
  }
}

// Enhanced DMA URN extraction with debugging
async function getDmaUrn(accessToken) {
  console.log('🔄 getDmaUrn: Starting DMA URN extraction...');
  console.log('🔍 DEBUG: Access token length:', accessToken?.length || 0);
  
  try {
    const url = 'https://api.linkedin.com/rest/memberAuthorizations?q=memberAndApplication';
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'LinkedIn-Version': '202312'
    };
    
    console.log('🔍 DEBUG: Request URL:', url);
    console.log('🔍 DEBUG: Request headers:', JSON.stringify(headers, null, 2));
    
    const response = await fetch(url, { headers });
    
    console.log('🔍 DEBUG: Response status:', response.status);
    console.log('🔍 DEBUG: Response headers:', JSON.stringify([...response.headers.entries()], null, 2));

    if (!response.ok) {
      const errorText = await response.text();
      console.log('⚠️  DMA URN fetch failed (may be expected for basic OAuth)');
      console.log('🔍 DEBUG: Error response:', errorText);
      return null;
    }

    const authData = await response.json();
    console.log('🔍 DEBUG: Full auth data response:', JSON.stringify(authData, null, 2));
    
    if (!authData.elements || authData.elements.length === 0) {
      console.log('⚠️  No DMA authorization elements found');
      return null;
    }

    const memberAuth = authData.elements[0];
    console.log('🔍 DEBUG: First member auth element:', JSON.stringify(memberAuth, null, 2));
    
    const dmaUrn = memberAuth.memberComplianceAuthorizationKey?.member;
    
    if (dmaUrn) {
      console.log('✅ DMA URN successfully extracted:', dmaUrn);
    } else {
      console.log('❌ DMA URN extraction failed - memberComplianceAuthorizationKey.member not found');
    }
    
    return dmaUrn;
  } catch (error) {
    console.error('💥 Error in getDmaUrn:', error);
    console.error('💥 Error stack:', error.stack);
    return null;
  }
}

// Enhanced profile info retrieval with debugging
async function getBasicProfileInfo(accessToken) {
  console.log('🔄 getBasicProfileInfo: Starting profile extraction...');
  
  try {
    const response = await fetch('https://api.linkedin.com/rest/people/me?projection=(id,firstName,lastName,emailAddress,profilePicture(displayImage~digitalmediaAsset:playableStreams))', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'LinkedIn-Version': '202212'
      }
    });

    console.log('🔍 DEBUG: Profile API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ Profile fetch failed:', errorText);
      return null;
    }

    const profileData = await response.json();
    console.log('🔍 DEBUG: Raw profile data:', JSON.stringify(profileData, null, 2));

    const profileInfo = {
      linkedinId: profileData.id,
      linkedinUrn: `urn:li:person:${profileData.id}`,
      name: `${profileData.firstName?.localized?.en_US || ''} ${profileData.lastName?.localized?.en_US || ''}`.trim(),
      given_name: profileData.firstName?.localized?.en_US,
      family_name: profileData.lastName?.localized?.en_US,
      email: profileData.emailAddress,
      picture: profileData.profilePicture?.displayImage?.elements?.[0]?.identifiers?.[0]?.identifier
    };

    console.log('✅ Profile info processed:', JSON.stringify(profileInfo, null, 2));
    return profileInfo;
    
  } catch (error) {
    console.error('💥 Error in getBasicProfileInfo:', error);
    return null;
  }
}

// Enhanced user creation/update with debugging
async function createOrUpdateUser(profileInfo, accessToken, dmaUrn, isDmaFlow) {
  console.log('🔄 createOrUpdateUser: Starting user processing...');
  console.log('🔍 DEBUG: Profile info:', JSON.stringify(profileInfo, null, 2));
  console.log('🔍 DEBUG: DMA URN:', dmaUrn);
  console.log('🔍 DEBUG: Is DMA flow:', isDmaFlow);

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const now = new Date().toISOString();

    // Try to find existing user by LinkedIn URN or email
    console.log('🔄 Searching for existing user...');
    const { data: existingUser, error: findError } = await supabase
      .from('users')
      .select('*')
      .or(`linkedin_member_urn.eq.${profileInfo.linkedinUrn},email.eq.${profileInfo.email}`)
      .single();

    if (findError && findError.code !== 'PGRST116') {
      console.error('❌ Database error finding user:', findError);
      throw findError;
    }

    if (existingUser) {
      console.log('✅ Found existing user:', existingUser.id);
      console.log('🔍 DEBUG: Existing user data:', JSON.stringify(existingUser, null, 2));
      
      // Update existing user
      const updateData = {
        name: profileInfo.name || existingUser.name,
        given_name: profileInfo.given_name || existingUser.given_name,
        family_name: profileInfo.family_name || existingUser.family_name,
        avatar_url: profileInfo.picture || existingUser.avatar_url,
        email: profileInfo.email || existingUser.email,
        linkedin_member_urn: profileInfo.linkedinUrn || existingUser.linkedin_member_urn,
        last_login: now,
        updated_at: now
      };

      // CRITICAL: Always update DMA URN if available
      if (dmaUrn) {
        updateData.linkedin_dma_member_urn = dmaUrn;
        updateData.dma_active = true;
        updateData.dma_consent_date = now;
        console.log('✅ Adding DMA URN to update:', dmaUrn);
      } else if (isDmaFlow && profileInfo.linkedinUrn && !existingUser.linkedin_dma_member_urn) {
        // For DMA flows without explicit DMA URN, use LinkedIn URN
        updateData.linkedin_dma_member_urn = profileInfo.linkedinUrn;
        updateData.dma_active = true;
        updateData.dma_consent_date = now;
        console.log('✅ Setting DMA URN from LinkedIn URN for DMA flow:', profileInfo.linkedinUrn);
      }

      console.log('🔍 DEBUG: Update data:', JSON.stringify(updateData, null, 2));

      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', existingUser.id)
        .select()
        .single();

      if (updateError) {
        console.error('❌ Error updating user:', updateError);
        throw updateError;
      }

      console.log('✅ User updated successfully');
      console.log('🔍 DEBUG: Updated user data:', JSON.stringify(updatedUser, null, 2));
      return updatedUser;
    } else {
      console.log('📝 Creating new user...');
      
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
        console.log('✅ Creating user with DMA URN:', dmaUrn);
      } else if (isDmaFlow && profileInfo.linkedinUrn) {
        newUserData.linkedin_dma_member_urn = profileInfo.linkedinUrn;
        newUserData.dma_active = true;
        newUserData.dma_consent_date = now;
        console.log('✅ Creating user with LinkedIn URN as DMA URN for DMA flow');
      }

      console.log('🔍 DEBUG: New user data:', JSON.stringify(newUserData, null, 2));

      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert(newUserData)
        .select()
        .single();

      if (createError) {
        console.error('❌ Error creating user:', createError);
        throw createError;
      }

      console.log('✅ New user created successfully');
      console.log('🔍 DEBUG: New user data:', JSON.stringify(newUser, null, 2));
      return newUser;
    }
  } catch (error) {
    console.error('💥 Error in createOrUpdateUser:', error);
    console.error('💥 Error stack:', error.stack);
    return null;
  }
}

// Enhanced changelog generation with debugging
async function enableChangelogGeneration(accessToken) {
  console.log('🔄 enableChangelogGeneration: Starting...');
  
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

    console.log('🔍 DEBUG: Changelog generation response status:', response.status);

    if (response.ok) {
      console.log('✅ Changelog generation enabled successfully');
    } else {
      const errorText = await response.text();
      console.log('⚠️  Changelog generation failed:', response.status, errorText);
    }
  } catch (error) {
    console.error('💥 Error enabling changelog:', error);
  }
}
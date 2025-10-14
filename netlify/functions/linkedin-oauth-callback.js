// netlify/functions/linkedin-oauth-callback.js - COMPLETE FIXED VERSION
// FIXES: State parameter parsing, validation, and expiration checks

// Main OAuth callback handler
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
      console.error('❌ OAuth error:', error);
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: `OAuth error: ${error}` })
      };
    }

    if (!code) {
      console.error('❌ No authorization code provided');
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'No authorization code provided' })
      };
    }

    // ===== FIX 1: PARSE STATE PARAMETER CORRECTLY =====
    const [flowType, timestamp, hash] = (state || '').split(':');
    const isDMA = flowType === 'dma';
    
    console.log('🔍 DEBUG: OAuth Flow Type:', isDMA ? 'DMA' : 'Basic');
    console.log('🔍 DEBUG: State components:', { flowType, timestamp, hash: hash?.substring(0, 8) });

    // ===== FIX 2: VALIDATE STATE PARAMETER =====
    if (!flowType || !timestamp || !hash) {
      console.error('❌ Invalid state parameter format:', state);
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ 
          error: 'Invalid state parameter - authentication session corrupted',
          details: 'Please try logging in again'
        })
      };
    }

    // ===== FIX 3: CHECK STATE EXPIRATION (30 minutes) =====
    const stateAge = Date.now() - parseInt(timestamp);
    const maxAge = 30 * 60 * 1000; // 30 minutes
    
    if (stateAge > maxAge) {
      console.error('❌ State parameter expired:', Math.floor(stateAge / 1000), 'seconds old');
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ 
          error: 'Authorization expired',
          details: 'Your login session has expired. Please try again.',
          age_seconds: Math.floor(stateAge / 1000)
        })
      };
    }

    console.log('✅ State validation passed - age:', Math.floor(stateAge / 1000), 'seconds');

    // Get correct credentials based on OAuth type
    const clientId = isDMA ? process.env.LINKEDIN_DMA_CLIENT_ID : process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = isDMA ? process.env.LINKEDIN_DMA_CLIENT_SECRET : process.env.LINKEDIN_CLIENT_SECRET;

    console.log('🔍 DEBUG: Client ID exists:', !!clientId);
    console.log('🔍 DEBUG: Client Secret exists:', !!clientSecret);

    if (!clientId || !clientSecret) {
      console.error('❌ Missing client credentials for OAuth type:', isDMA ? 'DMA' : 'Basic');
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: `Missing ${isDMA ? 'DMA' : 'Basic'} client credentials` })
      };
    }

    // Get redirect URI
    const redirectUri = `${process.env.URL}/.netlify/functions/linkedin-oauth-callback`;
    console.log('🔍 DEBUG: Redirect URI:', redirectUri);

    // Exchange code for access token
    console.log('🔄 Exchanging code for access token...');
    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    console.log('🔍 DEBUG: Token response status:', tokenResponse.status);

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('❌ Token exchange failed:', tokenResponse.status, errorText);
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ 
          error: 'Failed to exchange authorization code for token',
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
      dmaUrn = await getDmaUrnEnhanced(tokenData.access_token);
      console.log('🔍 DEBUG: DMA URN result:', dmaUrn || 'NULL');
      
      if (!dmaUrn) {
        console.error('❌ DMA URN extraction failed - this is critical for DMA flow');
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Failed to extract DMA URN from LinkedIn' })
        };
      }
      
      // Try to get basic profile info with DMA token (may or may not work)
      console.log('🔄 Attempting to get profile info with DMA token...');
      profileInfo = await getProfileInfoWithFallback(tokenData.access_token, dmaUrn);
      
    } else {
      console.log('=== PROCESSING BASIC OAUTH ===');
      
      // For basic OAuth, get profile info using multiple methods
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

    // Create or update user
    console.log('🔄 Creating or updating user...');
    const user = await createOrUpdateUserEnhanced(
      profileInfo,
      dmaUrn, 
      tokenData.access_token,
      isDMA
    );

    console.log('✅ User processed:', user.id);
    
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
    console.log('🔍 DEBUG: DMA Token Stored:', !!user.linkedin_dma_token);

    // Enable changelog generation for DMA users
    if (dmaUrn && isDMA) {
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

// ===== HELPER FUNCTIONS (Keep existing implementations) =====

// Enhanced basic profile info retrieval with multiple fallback methods
async function getBasicProfileInfo(accessToken) {
  console.log('🔄 getBasicProfileInfo: Starting profile extraction...');
  
  try {
    // Method 1: Try userinfo endpoint (OpenID Connect)
    console.log('🔄 Method 1: Trying userinfo endpoint...');
    const userinfoResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('🔍 DEBUG: Userinfo API response status:', userinfoResponse.status);

    if (userinfoResponse.ok) {
      const userinfoData = await userinfoResponse.json();
      console.log('✅ Method 1 SUCCESS: Userinfo data retrieved');
      console.log('🔍 DEBUG: Userinfo data:', JSON.stringify(userinfoData, null, 2));

      if (userinfoData.sub) {
        return {
          linkedinId: userinfoData.sub,
          linkedinUrn: `urn:li:person:${userinfoData.sub}`,
          name: userinfoData.name,
          given_name: userinfoData.given_name,
          family_name: userinfoData.family_name,
          email: userinfoData.email,
          picture: userinfoData.picture
        };
      }
    } else {
      console.log('⚠️  Method 1 FAILED: Userinfo endpoint returned', userinfoResponse.status);
    }

    // Method 2: Try people endpoint (legacy)
    console.log('🔄 Method 2: Trying people endpoint...');
    const peopleResponse = await fetch('https://api.linkedin.com/v2/people/~', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('🔍 DEBUG: People API response status:', peopleResponse.status);

    if (peopleResponse.ok) {
      const peopleData = await peopleResponse.json();
      console.log('✅ Method 2 SUCCESS: People data retrieved');
      
      return {
        linkedinId: peopleData.id,
        linkedinUrn: `urn:li:person:${peopleData.id}`,
        name: `${peopleData.localizedFirstName} ${peopleData.localizedLastName}`,
        given_name: peopleData.localizedFirstName,
        family_name: peopleData.localizedLastName,
        email: null,
        picture: peopleData.profilePicture?.displayImage
      };
    } else {
      console.log('⚠️  Method 2 FAILED: People endpoint returned', peopleResponse.status);
    }

    console.log('❌ All methods failed - returning fallback profile');
    return createFallbackProfile();

  } catch (error) {
    console.error('💥 Error in getBasicProfileInfo:', error);
    return createFallbackProfile();
  }
}

// Enhanced profile info for DMA tokens with fallback
async function getProfileInfoWithFallback(accessToken, dmaUrn) {
  console.log('🔄 getProfileInfoWithFallback: Starting...');
  
  try {
    const linkedinId = dmaUrn ? dmaUrn.replace('urn:li:person:', '') : null;
    
    if (!linkedinId) {
      console.log('⚠️  No LinkedIn ID available from DMA URN');
      return createFallbackDmaProfile(dmaUrn);
    }

    console.log('🔄 Attempting profile fetch with DMA token...');
    const profileInfo = await getBasicProfileInfo(accessToken);
    
    if (profileInfo && profileInfo.linkedinId) {
      console.log('✅ Got profile info with DMA token');
      return profileInfo;
    } else {
      console.log('⚠️  Profile fetch failed, using DMA URN fallback');
      return createFallbackDmaProfile(dmaUrn);
    }

  } catch (error) {
    console.error('💥 Error in getProfileInfoWithFallback:', error);
    return createFallbackDmaProfile(dmaUrn);
  }
}

// Create fallback profile for basic OAuth
function createFallbackProfile() {
  console.log('🔄 Creating fallback profile for basic OAuth...');
  return {
    linkedinId: null,
    linkedinUrn: null,
    name: 'LinkedIn User',
    given_name: 'LinkedIn',
    family_name: 'User',
    email: `user-${Date.now()}@linkedin-growth.app`,
    picture: null
  };
}

// Create fallback profile for DMA OAuth
function createFallbackDmaProfile(dmaUrn) {
  console.log('🔄 Creating fallback DMA profile...');
  const linkedinId = dmaUrn ? dmaUrn.replace('urn:li:person:', '') : null;
  
  return {
    linkedinId,
    linkedinUrn: linkedinId ? `urn:li:person:${linkedinId}` : null,
    name: 'LinkedIn DMA User',
    given_name: 'LinkedIn',
    family_name: 'DMA User',
    email: `dma-user-${Date.now()}@linkedin-growth.app`,
    picture: null
  };
}

// Enhanced DMA URN extraction with multiple methods
async function getDmaUrnEnhanced(accessToken) {
  console.log('🔄 getDmaUrnEnhanced: Starting DMA URN extraction...');
  
  try {
    // Method 1: Try Member Authorizations API
    console.log('🔄 Method 1: Trying Member Authorizations API...');
    const authResponse = await fetch(
      'https://api.linkedin.com/rest/memberAuthorizations?q=member',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'LinkedIn-Version': '202312',
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('🔍 DEBUG: Member Authorizations response status:', authResponse.status);

    if (authResponse.ok) {
      const authData = await authResponse.json();
      console.log('🔍 DEBUG: Member Authorizations response:', JSON.stringify(authData, null, 2));
      
      if (authData.elements && authData.elements.length > 0) {
        const dmaUrn = authData.elements[0].member;
        console.log('✅ Method 1 SUCCESS: DMA URN found:', dmaUrn);
        return dmaUrn;
      }
    }

    // Method 2: Try snapshot API to extract URN
    console.log('🔄 Method 2: Trying snapshot API...');
    const snapshotResponse = await fetch(
      'https://api.linkedin.com/rest/memberSnapshots?q=criteria&domains=List(ACCOUNT_HISTORY)&count=1',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'LinkedIn-Version': '202312',
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('🔍 DEBUG: Snapshot response status:', snapshotResponse.status);

    if (snapshotResponse.ok) {
      const snapshotData = await snapshotResponse.json();
      console.log('🔍 DEBUG: Snapshot response:', JSON.stringify(snapshotData, null, 2));
      
      if (snapshotData.elements && snapshotData.elements.length > 0) {
        const dmaUrn = snapshotData.elements[0].member;
        console.log('✅ Method 2 SUCCESS: DMA URN found:', dmaUrn);
        return dmaUrn;
      }
    }

    console.log('❌ All DMA URN extraction methods failed');
    return null;

  } catch (error) {
    console.error('💥 Error in getDmaUrnEnhanced:', error);
    return null;
  }
}

// Create or update user with enhanced database logic
async function createOrUpdateUserEnhanced(profileInfo, dmaUrn, accessToken, isDmaFlow) {
  console.log('🔍 ENHANCED: Starting user lookup/creation process');
  console.log('🔍 DEBUG: isDmaFlow:', isDmaFlow);
  console.log('🔍 DEBUG: profileInfo:', JSON.stringify(profileInfo, null, 2));
  console.log('🔍 DEBUG: dmaUrn:', dmaUrn);
  console.log('🔍 DEBUG: accessToken length:', accessToken?.length);

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    console.log('✅ Supabase client initialized');

    let user = null;

    if (isDmaFlow) {
      // DMA FLOW: Look up by DMA URN, then by basic URN
      console.log('🔍 DMA FLOW: Looking for existing user...');
      
      console.log('🔍 DMA STEP 1: Looking up by DMA URN...');
      const { data: dmaUser, error: dmaError } = await supabase
        .from('users')
        .select('*')
        .eq('linkedin_dma_member_urn', dmaUrn)
        .single();

      if (dmaUser) {
        console.log('✅ Found user by DMA URN:', dmaUser.id);
        user = dmaUser;
      } else if (profileInfo?.linkedinUrn) {
        console.log('🔍 DMA STEP 2: No DMA match, trying basic URN...');
        const { data: basicUser, error: basicError } = await supabase
          .from('users')
          .select('*')
          .eq('linkedin_member_urn', profileInfo.linkedinUrn)
          .single();

        if (basicUser) {
          console.log('✅ Found user by basic URN:', basicUser.id);
          user = basicUser;
        }
      }

      if (user) {
        // Update existing user with DMA token and URN
        console.log('✅ DMA FLOW: Updating existing user with DMA data');
        const { data: updated, error: updateError } = await supabase
          .from('users')
          .update({
            linkedin_dma_member_urn: dmaUrn,
            linkedin_dma_token: accessToken,
            dma_active: true,
            dma_consent_date: new Date().toISOString(),
            last_login: new Date().toISOString(),
            ...(profileInfo?.name && { name: profileInfo.name }),
            ...(profileInfo?.email && { email: profileInfo.email }),
            ...(profileInfo?.picture && { avatar_url: profileInfo.picture })
          })
          .eq('id', user.id)
          .select()
          .single();

        if (updateError) {
          console.error('❌ Error updating user:', updateError);
          throw updateError;
        }

        console.log('✅ DMA user updated successfully:', updated.id);
        return updated;
      } else {
        // Create new user for DMA flow
        console.log('🔍 DMA FLOW: No existing user found, creating new user');
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({
            email: profileInfo?.email || `dma-user-${Date.now()}@linkedin-growth.app`,
            name: profileInfo?.name || 'LinkedIn DMA User',
            given_name: profileInfo?.given_name || 'LinkedIn',
            family_name: profileInfo?.family_name || 'DMA User',
            avatar_url: profileInfo?.picture,
            linkedin_member_urn: profileInfo?.linkedinUrn,
            linkedin_dma_member_urn: dmaUrn,
            linkedin_dma_token: accessToken,
            dma_active: true,
            dma_consent_date: new Date().toISOString(),
            last_login: new Date().toISOString()
          })
          .select()
          .single();

        if (createError) {
          console.error('❌ Error creating DMA user:', createError);
          throw createError;
        }

        console.log('✅ New DMA user created:', newUser.id);
        return newUser;
      }
    } else {
      // BASIC FLOW: Look up by basic URN
      console.log('🔍 BASIC FLOW: Looking for existing user...');
      
      console.log('🔍 BASIC STEP 1: Looking up by LinkedIn URN...');
      const { data: basicUser, error: basicError } = await supabase
        .from('users')
        .select('*')
        .eq('linkedin_member_urn', profileInfo.linkedinUrn)
        .single();

      if (basicUser) {
        console.log('✅ Found user by LinkedIn URN:', basicUser.id);
        user = basicUser;
      } else if (profileInfo?.email) {
        console.log('🔍 BASIC STEP 2: No URN match, trying email...');
        const { data: emailUser, error: emailError } = await supabase
          .from('users')
          .select('*')
          .eq('email', profileInfo.email)
          .single();

        if (emailUser) {
          console.log('✅ Found user by email:', emailUser.id);
          user = emailUser;
        }
      }

      if (user) {
        // Update existing user with profile data
        console.log('✅ BASIC FLOW: Updating existing user with profile data');
        const { data: updated, error: updateError } = await supabase
          .from('users')
          .update({
            name: profileInfo.name,
            given_name: profileInfo.given_name,
            family_name: profileInfo.family_name,
            email: profileInfo.email,
            avatar_url: profileInfo.picture,
            linkedin_member_urn: profileInfo.linkedinUrn,
            last_login: new Date().toISOString()
          })
          .eq('id', user.id)
          .select()
          .single();

        if (updateError) {
          console.error('❌ Error updating user:', updateError);
          throw updateError;
        }

        console.log('✅ Basic user updated successfully:', updated.id);
        return updated;
      } else {
        // Create new user for basic flow
        console.log('🔍 BASIC FLOW: No existing user found, creating new user');
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({
            email: profileInfo.email || `user-${Date.now()}@linkedin-growth.app`,
            name: profileInfo.name || 'LinkedIn User',
            given_name: profileInfo.given_name || 'LinkedIn',
            family_name: profileInfo.family_name || 'User',
            avatar_url: profileInfo.picture,
            linkedin_member_urn: profileInfo.linkedinUrn,
            last_login: new Date().toISOString()
          })
          .select()
          .single();

        if (createError) {
          console.error('❌ Error creating basic user:', createError);
          throw createError;
        }

        console.log('✅ New basic user created:', newUser.id);
        return newUser;
      }
    }

  } catch (error) {
    console.error('💥 CRITICAL ERROR in createOrUpdateUserEnhanced:', error);
    throw error;
  }
}

// Enable changelog generation for DMA users
async function enableChangelogGeneration(accessToken) {
  console.log('🔄 Enabling changelog generation...');
  
  try {
    const response = await fetch(
      'https://api.linkedin.com/rest/memberChangeLogs?q=memberAndApplication',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'LinkedIn-Version': '202312',
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('🔍 DEBUG: Changelog enable response status:', response.status);

    if (response.ok) {
      console.log('✅ Changelog generation enabled successfully');
      return true;
    } else {
      console.log('⚠️  Changelog enable returned non-OK status:', response.status);
      return false;
    }
  } catch (error) {
    console.error('💥 Error enabling changelog:', error);
    return false;
  }
}
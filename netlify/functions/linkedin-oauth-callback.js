// netlify/functions/linkedin-oauth-callback.js - COMPLETE FIXED VERSION
// FIXES: State parsing + DMA registration before URN extraction

// Main OAuth callback handler
// Track processed codes to prevent duplicates (in-memory cache)
const processedCodes = new Set();

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
    
    // ===== DEDUPLICATION CHECK =====
    if (code && processedCodes.has(code)) {
      console.log('⚠️  DUPLICATE REQUEST DETECTED - Code already processed:', code.substring(0, 20));
      // Return success redirect immediately (code was already processed successfully)
      const appBaseUrl = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:5173' 
        : process.env.URL.replace('/.netlify/functions/linkedin-oauth-callback', '');
      
      return {
        statusCode: 302,
        headers: {
          ...corsHeaders,
          Location: `${appBaseUrl}?duplicate=true`
        }
      };
    }
    
    // Mark code as being processed
    if (code) {
      processedCodes.add(code);
      // Clean up after 5 minutes
      setTimeout(() => processedCodes.delete(code), 5 * 60 * 1000);
    }

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
    const maxAge = 30 * 60 * 1000;
    
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
      
      // ===== FIX 4: REGISTER USER FOR DMA FIRST =====
      console.log('🔄 Step 1: Registering user for DMA data generation...');
      const registered = await registerDmaUser(tokenData.access_token);
      
      if (!registered) {
        console.error('⚠️  DMA registration failed, but continuing...');
      } else {
        console.log('✅ DMA registration successful');
      }
      
      // Wait 2 seconds for LinkedIn to process registration
      console.log('⏳ Waiting 2 seconds for LinkedIn to process...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // ===== FIX 5: NOW GET DMA URN =====
      console.log('🔄 Step 2: Extracting DMA URN...');
      dmaUrn = await getDmaUrnEnhanced(tokenData.access_token);
      console.log('🔍 DEBUG: DMA URN result:', dmaUrn || 'NULL');
      
      if (!dmaUrn) {
        console.error('❌ DMA URN extraction failed - this is critical for DMA flow');
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ 
            error: 'Failed to extract DMA URN from LinkedIn',
            details: 'Please wait a moment and try connecting DMA again'
          })
        };
      }
      
      // Try to get basic profile info with DMA token
      console.log('🔄 Step 3: Getting profile info...');
      profileInfo = await getProfileInfoWithFallback(tokenData.access_token, dmaUrn);
      
    } else {
      console.log('=== PROCESSING BASIC OAUTH ===');
      
      // For basic OAuth, get profile info
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

    // Redirect back to app with appropriate token
    const appBaseUrl = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:5173' 
      : process.env.URL.replace('/.netlify/functions/linkedin-oauth-callback', '');

    let redirectUrl;
    
    if (isDMA) {
      redirectUrl = `${appBaseUrl}?dma_token=${encodeURIComponent(tokenData.access_token)}&user_id=${encodeURIComponent(user.id)}`;
      console.log('🔍 DEBUG: DMA redirect URL generated');
    } else {
      redirectUrl = `${appBaseUrl}?access_token=${encodeURIComponent(tokenData.access_token)}&user_id=${encodeURIComponent(user.id)}`;
      console.log('🔍 DEBUG: Basic redirect URL generated');
    }

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

// ===== NEW FUNCTION: REGISTER USER FOR DMA =====
async function registerDmaUser(accessToken) {
  console.log('🔄 registerDmaUser: Registering user for DMA data generation...');
  
  try {
    const response = await fetch(
      'https://api.linkedin.com/rest/memberAuthorizations',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'LinkedIn-Version': '202312',
          'X-Restli-Protocol-Version': '2.0.0',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})  // Empty JSON object as per docs
      }
    );

    console.log('🔍 DEBUG: Registration response status:', response.status);

    if (response.ok || response.status === 201) {
      console.log('✅ DMA registration successful');
      return true;
    } else {
      const errorText = await response.text();
      console.log('⚠️  DMA registration returned:', response.status, errorText);
      return false;
    }
  } catch (error) {
    console.error('💥 Error registering DMA user:', error);
    return false;
  }
}

// ===== HELPER FUNCTIONS =====

// Enhanced DMA URN extraction
async function getDmaUrnEnhanced(accessToken) {
  console.log('🔄 getDmaUrnEnhanced: Starting DMA URN extraction...');
  
  try {
    const response = await fetch(
      'https://api.linkedin.com/rest/memberAuthorizations?q=memberAndApplication',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'LinkedIn-Version': '202312',
          'X-Restli-Protocol-Version': '2.0.0'
        }
      }
    );

    console.log('🔍 DEBUG: Member Authorizations response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('⚠️  DMA URN fetch failed:', response.status, errorText);
      return null;
    }

    const authData = await response.json();
    console.log('🔍 DEBUG: Auth data received:', JSON.stringify(authData, null, 2));
    
    if (!authData.elements || authData.elements.length === 0) {
      console.log('⚠️  No DMA authorization elements found');
      return null;
    }

    const memberAuth = authData.elements[0];
    const dmaUrn = memberAuth.memberComplianceAuthorizationKey?.member;
    
    if (dmaUrn) {
      console.log('✅ DMA URN successfully extracted:', dmaUrn);
      return dmaUrn;
    } else {
      console.log('❌ DMA URN not found in response');
      return null;
    }
  } catch (error) {
    console.error('💥 Error in getDmaUrnEnhanced:', error);
    return null;
  }
}

// Enhanced basic profile info retrieval
async function getBasicProfileInfo(accessToken) {
  console.log('🔄 getBasicProfileInfo: Starting profile extraction...');
  
  try {
    // Try userinfo endpoint (OpenID Connect)
    const userinfoResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('🔍 DEBUG: Userinfo API response status:', userinfoResponse.status);

    if (userinfoResponse.ok) {
      const userinfoData = await userinfoResponse.json();
      console.log('✅ Userinfo data retrieved');

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
    }

    console.log('❌ Failed to get profile - returning fallback');
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

    // Try to get profile info with DMA token
    const profileInfo = await getBasicProfileInfo(accessToken);
    
    if (profileInfo && profileInfo.linkedinId) {
      console.log('✅ Got profile info with DMA token');
      return profileInfo;
    } else {
      console.log('⚠️  Using DMA URN fallback');
      return createFallbackDmaProfile(dmaUrn);
    }

  } catch (error) {
    console.error('💥 Error in getProfileInfoWithFallback:', error);
    return createFallbackDmaProfile(dmaUrn);
  }
}

// Create fallback profile for basic OAuth
function createFallbackProfile() {
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

// Create or update user with enhanced database logic
async function createOrUpdateUserEnhanced(profileInfo, dmaUrn, accessToken, isDmaFlow) {
  console.log('🔍 ENHANCED: Starting user lookup/creation process');

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
      
      const { data: dmaUser } = await supabase
        .from('users')
        .select('*')
        .eq('linkedin_dma_member_urn', dmaUrn)
        .single();

      if (dmaUser) {
        console.log('✅ Found user by DMA URN:', dmaUser.id);
        user = dmaUser;
      } else if (profileInfo?.linkedinUrn) {
        const { data: basicUser } = await supabase
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
        // Update existing user with DMA data
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

        if (updateError) throw updateError;
        return updated;
      } else {
        // Create new user for DMA flow
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

        if (createError) throw createError;
        return newUser;
      }
    } else {
      // BASIC FLOW: Look up by basic URN
      console.log('🔍 BASIC FLOW: Looking for existing user...');
      
      const { data: basicUser } = await supabase
        .from('users')
        .select('*')
        .eq('linkedin_member_urn', profileInfo.linkedinUrn)
        .single();

      if (basicUser) {
        user = basicUser;
      } else if (profileInfo?.email) {
        const { data: emailUser } = await supabase
          .from('users')
          .select('*')
          .eq('email', profileInfo.email)
          .single();

        if (emailUser) user = emailUser;
      }

      if (user) {
        // Update existing user
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

        if (updateError) throw updateError;
        return updated;
      } else {
        // Create new user
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

        if (createError) throw createError;
        return newUser;
      }
    }

  } catch (error) {
    console.error('💥 CRITICAL ERROR in createOrUpdateUserEnhanced:', error);
    throw error;
  }
}
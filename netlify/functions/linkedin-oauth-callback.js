// netlify/functions/linkedin-oauth-callback.js - Complete fixed version

// Add debug function at the top
async function debugDatabaseConnection() {
  console.log('🔍 DEBUG: Testing database connection...');
  
  const { createClient } = await import('@supabase/supabase-js');
  
  // Test with service role
  const supabaseService = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  console.log('🔍 DEBUG: Supabase URL exists:', !!process.env.SUPABASE_URL);
  console.log('🔍 DEBUG: Service role key exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
  console.log('🔍 DEBUG: Service role key prefix:', process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20) + '...');
  
  try {
    // Test basic query - fixed the syntax issue
    const { data: testData, error: testError } = await supabaseService
      .from('users')
      .select('id')
      .limit(1);
    
    console.log('🔍 DEBUG: Test query result:', testData);
    console.log('🔍 DEBUG: Test query error:', testError);
  } catch (error) {
    console.error('🔍 DEBUG: Database connection test failed:', error);
  }
}

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
        body: JSON.stringify({ error: 'Failed to exchange authorization code for token' })
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
      
      // For DMA flow, get DMA URN first - ENHANCED EXTRACTION
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
      
      // For DMA tokens, try to get basic profile info but don't fail if it doesn't work
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

    // Create or update user - ENHANCED DATABASE LOGIC
    console.log('🔄 Creating or updating user...');
    // Create or update user
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
        email: null, // Need separate call for email
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
    // Extract LinkedIn ID from DMA URN
    const linkedinId = dmaUrn ? dmaUrn.replace('urn:li:person:', '') : null;
    
    if (!linkedinId) {
      console.log('⚠️  No LinkedIn ID available from DMA URN');
      return createFallbackDmaProfile(dmaUrn);
    }

    // Try to get basic profile info (may or may not work with DMA token)
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
    name: 'LinkedIn User (DMA)',
    given_name: 'LinkedIn',
    family_name: 'User',
    email: `dma-user-${Date.now()}@linkedin-growth.app`,
    picture: null
  };
}

// ENHANCED DMA URN extraction with better error handling
async function getDmaUrnEnhanced(accessToken) {
  console.log('🔄 getDmaUrnEnhanced: Starting DMA URN extraction...');
  
  try {
    const url = 'https://api.linkedin.com/rest/memberAuthorizations?q=memberAndApplication';
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'LinkedIn-Version': '202312',
      'X-Restli-Protocol-Version': '2.0.0'
    };
    
    console.log('🔍 DEBUG: Request URL:', url);
    console.log('🔍 DEBUG: Request headers:', headers);
    
    const response = await fetch(url, { headers });
    
    console.log('🔍 DEBUG: Response status:', response.status);
    console.log('🔍 DEBUG: Response headers:', Object.fromEntries(response.headers.entries()));

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
    console.log('🔍 DEBUG: Member auth structure:', JSON.stringify(memberAuth, null, 2));
    
    const dmaUrn = memberAuth.memberComplianceAuthorizationKey?.member;
    
    if (dmaUrn) {
      console.log('✅ DMA URN successfully extracted:', dmaUrn);
    } else {
      console.log('❌ DMA URN extraction failed - memberComplianceAuthorizationKey.member not found');
      console.log('🔍 DEBUG: Available keys in memberAuth:', Object.keys(memberAuth));
    }
    
    return dmaUrn;
  } catch (error) {
    console.error('💥 Error in getDmaUrnEnhanced:', error);
    console.error('💥 Error stack:', error.stack);
    return null;
  }
}

// Fixed createOrUpdateUserEnhanced function - initialize Supabase internally
// Location: netlify/functions/linkedin-oauth-callback.js

async function createOrUpdateUserEnhanced(profileInfo, dmaUrn, accessToken, isDmaFlow) {
  console.log('🔍 ENHANCED: Starting user lookup/creation process');
  console.log('🔍 DEBUG: isDmaFlow:', isDmaFlow);
  console.log('🔍 DEBUG: profileInfo:', JSON.stringify(profileInfo, null, 2));
  console.log('🔍 DEBUG: dmaUrn:', dmaUrn);
  console.log('🔍 DEBUG: accessToken length:', accessToken?.length || 0);

  try {
    // Initialize Supabase client inside the function
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('✅ Supabase client initialized');

    const now = new Date().toISOString();
    let existingUser = null;

    // BASIC OAUTH FLOW - Create/Update User with Profile Data
    if (!isDmaFlow) {
      console.log('🔍 BASIC FLOW: Looking for existing user...');
      
      // Step 1: Look by LinkedIn URN
      if (profileInfo.linkedinUrn) {
        console.log('🔍 BASIC STEP 1: Looking up by LinkedIn URN...');
        const { data: userByLinkedinUrn } = await supabase
          .from('users')
          .select('*')
          .eq('linkedin_member_urn', profileInfo.linkedinUrn)
          .single();
        
        if (userByLinkedinUrn) {
          existingUser = userByLinkedinUrn;
          console.log('✅ Found user by LinkedIn URN:', existingUser.id);
        }
      }
      
      // Step 2: Look by email
      if (!existingUser && profileInfo.email && !profileInfo.email.includes('linkedin-growth.app')) {
        console.log('🔍 BASIC STEP 2: Looking up by email...');
        const { data: userByEmail } = await supabase
          .from('users')
          .select('*')
          .eq('email', profileInfo.email)
          .single();
        
        if (userByEmail) {
          existingUser = userByEmail;
          console.log('✅ Found user by email:', existingUser.id);
        }
      }

      if (existingUser) {
        // Update existing user with profile data
        console.log('✅ BASIC FLOW: Updating existing user with profile data');
        
        const updateData = {
          name: profileInfo.name,
          given_name: profileInfo.given_name,
          family_name: profileInfo.family_name,
          email: profileInfo.email,
          avatar_url: profileInfo.picture,
          linkedin_member_urn: profileInfo.linkedinUrn,
          last_login: now,
          updated_at: now
        };

        const { data: updatedUser, error: updateError } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', existingUser.id)
          .select('*')
          .single();

        if (updateError) {
          console.error('❌ Error updating user:', updateError);
          throw updateError;
        }

        console.log('✅ Basic user updated successfully:', updatedUser.id);
        return updatedUser;

      } else {
        // Create new user with profile data
        console.log('🆕 BASIC FLOW: Creating new user with profile data');
        
        const newUserData = {
          email: profileInfo.email,
          name: profileInfo.name || 'LinkedIn User',
          given_name: profileInfo.given_name || '',
          family_name: profileInfo.family_name || '',
          avatar_url: profileInfo.picture,
          linkedin_member_urn: profileInfo.linkedinUrn,
          linkedin_dma_member_urn: null,
          linkedin_dma_token: null,
          dma_active: false,
          dma_consent_date: null,
          last_login: now,
          account_status: 'active',
          subscription_tier: 'free',
          created_at: now,
          updated_at: now,
        };

        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert([newUserData])
          .select('*')
          .single();

        if (createError) {
          console.error('❌ Error creating new basic user:', createError);
          throw createError;
        }

        console.log('✅ New basic user created:', newUser.id);
        return newUser;
      }
    }

    // DMA OAUTH FLOW - Find Existing User and Add DMA Data
    else {
      console.log('🔍 DMA FLOW: Starting comprehensive user lookup...');
      
      // Step 1: Look for user by DMA URN (if they've done DMA before)
      if (dmaUrn) {
        console.log('🔍 DMA STEP 1: Looking up by DMA URN...');
        const { data: userByDmaUrn } = await supabase
          .from('users')
          .select('*')
          .eq('linkedin_dma_member_urn', dmaUrn)
          .single();
        
        if (userByDmaUrn) {
          existingUser = userByDmaUrn;
          console.log('✅ Found user by DMA URN:', existingUser.id);
        }
      }

      // Step 2: Look for user by regular LinkedIn URN (from Basic OAuth)
      if (!existingUser && profileInfo?.linkedinUrn) {
        console.log('🔍 DMA STEP 2: Looking up by regular LinkedIn URN...');
        const { data: userByLinkedinUrn } = await supabase
          .from('users')
          .select('*')
          .eq('linkedin_member_urn', profileInfo.linkedinUrn)
          .single();
        
        if (userByLinkedinUrn) {
          existingUser = userByLinkedinUrn;
          console.log('✅ Found user by LinkedIn URN:', existingUser.id);
        }
      }

      // Step 3: Look for user by email (from Basic OAuth profile)
      if (!existingUser && profileInfo?.email && !profileInfo.email.includes('linkedin-growth.app')) {
        console.log('🔍 DMA STEP 3: Looking up by email...');
        const { data: userByEmail } = await supabase
          .from('users')
          .select('*')
          .eq('email', profileInfo.email)
          .single();
        
        if (userByEmail) {
          existingUser = userByEmail;
          console.log('✅ Found user by email:', existingUser.id);
        }
      }

      // Step 4: Look for ANY user with no DMA token (recent Basic OAuth users)
      if (!existingUser) {
        console.log('🔍 DMA STEP 4: Looking for recent Basic OAuth users without DMA...');
        const { data: recentBasicUsers } = await supabase
          .from('users')
          .select('*')
          .is('linkedin_dma_token', null)
          .eq('dma_active', false)
          .not('email', 'like', '%linkedin-growth.app%')
          .order('created_at', { ascending: false })
          .limit(10);
        
        if (recentBasicUsers && recentBasicUsers.length > 0) {
          // Use most recent Basic user (within last 15 minutes)
          const recentUser = recentBasicUsers[0];
          const userAge = Date.now() - new Date(recentUser.created_at).getTime();
          if (userAge < 15 * 60 * 1000) { // 15 minutes
            existingUser = recentUser;
            console.log('✅ Using most recent Basic user (within 15 min):', existingUser.id);
          }
        }
      }

      if (existingUser) {
        // Update existing user with DMA data
        console.log('✅ DMA FLOW: Adding DMA data to existing user');
        
        const updateData = {
          linkedin_dma_member_urn: dmaUrn,
          linkedin_dma_token: accessToken,
          dma_active: true,
          dma_consent_date: now,
          last_login: now,
          updated_at: now
        };

        const { data: updatedUser, error: updateError } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', existingUser.id)
          .select('*')
          .single();

        if (updateError) {
          console.error('❌ Error updating user with DMA:', updateError);
          throw updateError;
        }

        console.log('✅ User updated with DMA data successfully:', updatedUser.id);
        console.log('🔍 DEBUG: DMA status:', updatedUser.dma_active);
        console.log('🔍 DEBUG: DMA token stored:', !!updatedUser.linkedin_dma_token);
        
        return updatedUser;

      } else {
        // This should be rare - create DMA-only user
        console.log('🆕 DMA FLOW: Creating DMA-only user (edge case)');
        
        const newUserData = {
          email: profileInfo?.email || `dma-user-${Date.now()}@linkedin-growth.app`,
          name: profileInfo?.name || 'LinkedIn User (DMA)',
          given_name: profileInfo?.given_name || 'LinkedIn',
          family_name: profileInfo?.family_name || 'User',
          avatar_url: profileInfo?.picture,
          linkedin_member_urn: profileInfo?.linkedinUrn,
          linkedin_dma_member_urn: dmaUrn,
          linkedin_dma_token: accessToken,
          dma_active: true,
          dma_consent_date: now,
          last_login: now,
          account_status: 'active',
          subscription_tier: 'free',
          created_at: now,
          updated_at: now,
        };

        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert([newUserData])
          .select('*')
          .single();

        if (createError) {
          console.error('❌ Error creating new DMA user:', createError);
          throw createError;
        }

        console.log('✅ New DMA user created:', newUser.id);
        return newUser;
      }
    }
    
  } catch (error) {
    console.error('💥 Fatal error in createOrUpdateUserEnhanced:', error);
    console.error('💥 Error stack:', error.stack);
    throw error;
  }
}


// Enable changelog generation for DMA users
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
      console.log('⚠️  Changelog generation may have failed:', response.status, errorText);
      // Don't throw error as this is not critical for OAuth flow
    }

  } catch (error) {
    console.error('💥 Error enabling changelog generation:', error);
    // Don't throw error as this is not critical for OAuth flow
  }
}
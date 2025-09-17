// netlify/functions/linkedin-oauth-callback.js - COMPLETE DEBUG VERSION
// Fixed DMA URN extraction and database updates with full debugging

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
    // Test basic query
    const { data: testData, error: testError } = await supabaseService
      .from('users')
      .select('count(*)')
      .limit(1);
    
    console.log('🔍 DEBUG: Test query result:', testData);
    console.log('🔍 DEBUG: Test query error:', testError);
  } catch (error) {
    console.error('🔍 DEBUG: Database connection test failed:', error);
  }
}

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

    // Exchange authorization code for access token
    console.log('🔄 Exchanging code for access token...');
    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenResponse.ok) {
      const tokenError = await tokenResponse.text();
      console.error('❌ Token exchange failed:', tokenError);
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Failed to exchange code for token', details: tokenError })
      };
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    console.log('✅ Access token obtained');

    let profileInfo = null;
    let dmaUrn = null;

    // Get profile info and handle DMA URN extraction
    if (isDMA) {
      console.log('🔄 DMA flow: Getting DMA URN and profile info...');
      
      // Extract DMA URN first
      dmaUrn = await getDmaUrn(accessToken);
      if (!dmaUrn) {
        console.error('❌ Failed to extract DMA URN');
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Failed to extract DMA URN' })
        };
      }
      console.log('✅ DMA URN successfully extracted:', dmaUrn);

      // Get profile info with DMA token
      profileInfo = await getProfileInfoWithFallback(accessToken, null, dmaUrn);
    } else {
      console.log('🔄 Basic flow: Getting profile info...');
      profileInfo = await getProfileInfoWithFallback(null, accessToken, null);
    }

    if (!profileInfo) {
      console.error('❌ Failed to get profile information');
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Failed to get profile information' })
      };
    }

    console.log('✅ Profile info obtained');

    // Create or update user
    console.log('🔄 Creating or updating user...');
    const user = await createOrUpdateUserEnhanced(profileInfo, dmaUrn, isDMA);
    
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
    console.log('🔍 DEBUG: DMA URN:', user.linkedin_dma_member_urn);
    console.log('🔍 DEBUG: DMA Active:', user.dma_active);

    // Enable changelog generation for DMA users
    if (isDMA && accessToken) {
      console.log('🔄 Enabling changelog generation...');
      await enableChangelogGeneration(accessToken);
      console.log('✅ Changelog generation enabled');
    }

    // Generate redirect URL using the same logic as the original
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

// MODIFIED: Enhanced user creation/update function with extensive debugging
async function createOrUpdateUserEnhanced(profileInfo, dmaUrn, isDmaFlow) {
  console.log('🔄 createOrUpdateUserEnhanced: Starting user processing...');
  console.log('🔍 DEBUG: Profile info:', JSON.stringify(profileInfo, null, 2));
  console.log('🔍 DEBUG: DMA URN:', dmaUrn);
  console.log('🔍 DEBUG: Is DMA flow:', isDmaFlow);

  // Test database connection first
  await debugDatabaseConnection();

  try {
    const { createClient } = await import('@supabase/supabase-js');
    
    // CRITICAL: Use SERVICE_ROLE_KEY to bypass RLS policies
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const now = new Date().toISOString();

    // Enhanced user lookup to prevent duplicates
    console.log('🔄 Searching for existing user...');
    
    let existingUser = null;
    
    // Step 1: Try to find by DMA URN if available
    if (dmaUrn) {
      console.log('🔍 Step 1: Looking up by DMA URN:', dmaUrn);
      const { data: userByDmaUrn, error: dmaLookupError } = await supabase
        .from('users')
        .select('*')
        .eq('linkedin_dma_member_urn', dmaUrn)
        .single();
      
      console.log('🔍 DEBUG: DMA lookup result:', userByDmaUrn);
      console.log('🔍 DEBUG: DMA lookup error:', dmaLookupError);
      
      if (dmaLookupError && dmaLookupError.code !== 'PGRST116') {
        console.error('❌ Error looking up by DMA URN:', dmaLookupError);
      }
      
      if (userByDmaUrn) {
        existingUser = userByDmaUrn;
        console.log('✅ Found user by DMA URN:', existingUser.id);
      }
    }
    
    // Step 2: Try to find by LinkedIn URN if not found by DMA URN
    if (!existingUser && profileInfo.linkedinUrn) {
      console.log('🔍 Step 2: Looking up by LinkedIn URN:', profileInfo.linkedinUrn);
      const { data: userByLinkedinUrn, error: linkedinLookupError } = await supabase
        .from('users')
        .select('*')
        .eq('linkedin_member_urn', profileInfo.linkedinUrn)
        .single();
      
      console.log('🔍 DEBUG: LinkedIn URN lookup result:', userByLinkedinUrn);
      console.log('🔍 DEBUG: LinkedIn URN lookup error:', linkedinLookupError);
      
      if (linkedinLookupError && linkedinLookupError.code !== 'PGRST116') {
        console.error('❌ Error looking up by LinkedIn URN:', linkedinLookupError);
      }
      
      if (userByLinkedinUrn) {
        existingUser = userByLinkedinUrn;
        console.log('✅ Found user by LinkedIn URN:', existingUser.id);
      }
    }
    
    // Step 3: Try to find by email if available and not a placeholder
    if (!existingUser && profileInfo.email && !profileInfo.email.includes('linkedin-growth.app')) {
      console.log('🔍 Step 3: Looking up by email:', profileInfo.email);
      const { data: userByEmail, error: emailLookupError } = await supabase
        .from('users')
        .select('*')
        .eq('email', profileInfo.email)
        .single();
      
      console.log('🔍 DEBUG: Email lookup result:', userByEmail);
      console.log('🔍 DEBUG: Email lookup error:', emailLookupError);
      
      if (emailLookupError && emailLookupError.code !== 'PGRST116') {
        console.error('❌ Error looking up by email:', emailLookupError);
      }
      
      if (userByEmail) {
        existingUser = userByEmail;
        console.log('✅ Found user by email:', existingUser.id);
      }
    }

    if (existingUser) {
      console.log('✅ Found existing user:', existingUser.id);
      console.log('🔍 DEBUG: Current user DMA status:', existingUser.dma_active);
      console.log('🔍 DEBUG: Current user DMA URN:', existingUser.linkedin_dma_member_urn);
      
      // Prepare update data
      const updateData = {
        name: profileInfo.name || existingUser.name,
        given_name: profileInfo.given_name || existingUser.given_name,
        family_name: profileInfo.family_name || existingUser.family_name,
        avatar_url: profileInfo.picture || existingUser.avatar_url,
        linkedin_member_urn: profileInfo.linkedinUrn || existingUser.linkedin_member_urn,
        last_login: now,
        updated_at: now
      };

      // Only update email if we have a real email (not placeholder)
      if (profileInfo.email && !profileInfo.email.includes('linkedin-growth.app')) {
        updateData.email = profileInfo.email;
      }

      // CRITICAL: Handle DMA URN and activation properly
      if (isDmaFlow && dmaUrn) {
        // This is the DMA step - activate DMA and set URN
        updateData.linkedin_dma_member_urn = dmaUrn;
        updateData.dma_active = true;
        updateData.dma_consent_date = now;
        console.log('✅ DMA STEP: Setting DMA active and URN:', dmaUrn);
      } else if (!isDmaFlow) {
        // This is basic OAuth step - don't activate DMA yet
        console.log('✅ BASIC STEP: Keeping DMA inactive until DMA OAuth completed');
      }

      console.log('🔍 DEBUG: Final update data:', JSON.stringify(updateData, null, 2));
      console.log('🔍 DEBUG: Updating user ID:', existingUser.id);

      // CRITICAL DEBUG: Test the exact update query
      console.log('🔄 Executing database update...');
      
      const updateResult = await supabase
        .from('users')
        .update(updateData)
        .eq('id', existingUser.id)
        .select('*');

      console.log('🔍 DEBUG: Raw update result:', JSON.stringify(updateResult, null, 2));
      console.log('🔍 DEBUG: Update data returned:', updateResult.data);
      console.log('🔍 DEBUG: Update error:', updateResult.error);
      console.log('🔍 DEBUG: Update status:', updateResult.status);
      console.log('🔍 DEBUG: Update statusText:', updateResult.statusText);

      if (updateResult.error) {
        console.error('❌ CRITICAL: Database update failed with error:', updateResult.error);
        console.error('❌ Error code:', updateResult.error.code);
        console.error('❌ Error message:', updateResult.error.message);
        console.error('❌ Error details:', updateResult.error.details);
        console.error('❌ Error hint:', updateResult.error.hint);
        throw new Error(`Database update failed: ${JSON.stringify(updateResult.error)}`);
      }

      if (!updateResult.data || updateResult.data.length === 0) {
        console.error('❌ CRITICAL: Update returned no data');
        console.error('❌ This suggests RLS is still blocking the update');
        
        // Test if we can read the user after update attempt
        const { data: readTest, error: readError } = await supabase
          .from('users')
          .select('*')
          .eq('id', existingUser.id)
          .single();
        
        console.log('🔍 DEBUG: Post-update read test:', readTest);
        console.log('🔍 DEBUG: Post-update read error:', readError);
        
        throw new Error('Update operation returned no data - possible RLS or permission issue');
      }

      const updatedUser = updateResult.data[0];
      console.log('✅ User updated successfully');
      console.log('🔍 DEBUG: Updated user DMA status:', updatedUser.dma_active);
      console.log('🔍 DEBUG: Updated user DMA URN:', updatedUser.linkedin_dma_member_urn);
      
      // VERIFICATION: Double-check the update worked
      const { data: verificationUser, error: verifyError } = await supabase
        .from('users')
        .select('dma_active, linkedin_dma_member_urn')
        .eq('id', existingUser.id)
        .single();
      
      if (verifyError) {
        console.error('❌ Verification query failed:', verifyError);
      } else {
        console.log('🔍 VERIFICATION: DB shows dma_active =', verificationUser.dma_active);
        console.log('🔍 VERIFICATION: DB shows linkedin_dma_member_urn =', verificationUser.linkedin_dma_member_urn);
      }
      
      return updatedUser;
    } else {
      console.log('📝 Creating new user...');
      
      const newUserData = {
        email: profileInfo.email || `user-${Date.now()}@linkedin-growth.app`,
        name: profileInfo.name || 'LinkedIn User',
        given_name: profileInfo.given_name || 'LinkedIn',
        family_name: profileInfo.family_name || 'User',
        avatar_url: profileInfo.picture,
        linkedin_member_urn: profileInfo.linkedinUrn,
        account_status: 'active',
        last_login: now,
        created_at: now
      };

      // Handle DMA URN for new users
      if (isDmaFlow && dmaUrn) {
        // Creating user during DMA step
        newUserData.linkedin_dma_member_urn = dmaUrn;
        newUserData.dma_active = true;
        newUserData.dma_consent_date = now;
        console.log('✅ Creating new user with DMA active:', dmaUrn);
      } else {
        // Creating user during basic step
        newUserData.dma_active = false;
        console.log('✅ Creating new user with DMA inactive (awaiting DMA step)');
      }

      console.log('🔍 DEBUG: New user data:', JSON.stringify(newUserData, null, 2));

      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert(newUserData)
        .select('*')
        .single();

      if (createError) {
        console.error('❌ CRITICAL ERROR: User creation failed:', createError);
        console.error('❌ Creation error details:', JSON.stringify(createError, null, 2));
        console.error('❌ Attempted user data:', JSON.stringify(newUserData, null, 2));
        throw new Error(`User creation failed: ${createError.message}`);
      }

      console.log('✅ New user created successfully');
      console.log('🔍 DEBUG: New user DMA status:', newUser.dma_active);
      console.log('🔍 DEBUG: New user DMA URN:', newUser.linkedin_dma_member_urn);
      return newUser;
    }
  } catch (error) {
    console.error('💥 FATAL ERROR in createOrUpdateUserEnhanced:', error);
    console.error('💥 Error name:', error.name);
    console.error('💥 Error message:', error.message);
    console.error('💥 Error stack:', error.stack);
    return null;
  }
}

// Enhanced DMA URN extraction
async function getDmaUrn(accessToken) {
  console.log('🔄 getDmaUrn: Starting DMA URN extraction...');
  
  try {
    const response = await fetch('https://api.linkedin.com/rest/memberCompliance?q=member', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'LinkedIn-Version': '202312',
        'X-RestLi-Protocol-Version': '2.0.0'
      }
    });

    console.log('🔍 DEBUG: Response status:', response.status);
    console.log('🔍 DEBUG: Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ DMA URN request failed:', response.status, errorText);
      return null;
    }

    const authData = await response.json();
    console.log('🔍 DEBUG: Auth data received:', JSON.stringify(authData, null, 2));

    if (!authData.elements || authData.elements.length === 0) {
      console.error('❌ No member authorization found');
      return null;
    }

    const memberAuth = authData.elements[0];
    console.log('🔍 DEBUG: Member auth structure:', JSON.stringify(memberAuth, null, 2));
    
    const personUrn = memberAuth.memberComplianceAuthorizationKey?.member;
    if (!personUrn) {
      console.error('❌ No person URN found in member authorization');
      return null;
    }

    console.log('✅ DMA URN successfully extracted:', personUrn);
    console.log('🔍 DEBUG: DMA URN result:', personUrn);
    return personUrn;
  } catch (error) {
    console.error('💥 Error extracting DMA URN:', error);
    return null;
  }
}

// Enhanced profile info extraction with fallback
async function getProfileInfoWithFallback(dmaToken, basicToken, dmaUrn) {
  console.log('🔄 getProfileInfoWithFallback: Starting profile extraction...');
  
  try {
    let profileInfo = null;

    if (dmaToken) {
      console.log('🔄 Attempting to get profile info with DMA token...');
      profileInfo = await getBasicProfileInfo(dmaToken);
    } else if (basicToken) {
      console.log('🔄 Attempting to get profile info with basic token...');  
      profileInfo = await getBasicProfileInfo(basicToken);
    }

    if (!profileInfo && dmaUrn) {
      console.log('🔄 Creating profile from DMA URN...');
      profileInfo = createProfileFromDmaUrn(dmaUrn);
      console.log('✅ Created profile from DMA URN');
    }

    return profileInfo;
  } catch (error) {
    console.error('💥 Error in getProfileInfoWithFallback:', error);
    return null;
  }
}

// Enhanced basic profile info retrieval with multiple fallback methods
async function getBasicProfileInfo(accessToken) {
  console.log('🔄 getBasicProfileInfo: Starting profile extraction...');
  
  // Method 1: Try userinfo endpoint (works with openid scope)
  try {
    console.log('🔄 Method 1: Trying userinfo endpoint...');
    const userinfoResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'cache-control': 'no-cache'
      }
    });

    console.log('🔍 DEBUG: Userinfo API response status:', userinfoResponse.status);

    if (userinfoResponse.ok) {
      const userinfoData = await userinfoResponse.json();
      console.log('✅ Method 1 SUCCESS: Userinfo data retrieved');
      console.log('🔍 DEBUG: Userinfo data:', JSON.stringify(userinfoData, null, 2));

      return {
        linkedinId: userinfoData.sub,
        linkedinUrn: `urn:li:person:${userinfoData.sub}`,
        name: userinfoData.name || `${userinfoData.given_name || ''} ${userinfoData.family_name || ''}`.trim(),
        given_name: userinfoData.given_name,
        family_name: userinfoData.family_name,
        email: userinfoData.email,
        picture: userinfoData.picture
      };
    } else {
      const errorText = await userinfoResponse.text();
      console.log('⚠️  Method 1 FAILED: Userinfo endpoint error:', errorText);
    }
  } catch (error) {
    console.log('⚠️  Method 1 ERROR:', error.message);
  }

  // Method 2: Try v2/people endpoint with profile projection
  try {
    console.log('🔄 Method 2: Trying people endpoint...');
    const peopleResponse = await fetch('https://api.linkedin.com/v2/people/~?(projection=(id,firstName,lastName,emailAddress,profilePicture(displayImage~:playableStreams)))', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'LinkedIn-Version': '202312'
      }
    });

    console.log('🔍 DEBUG: People API response status:', peopleResponse.status);

    if (peopleResponse.ok) {
      const peopleData = await peopleResponse.json();
      console.log('✅ Method 2 SUCCESS: People data retrieved');
      console.log('🔍 DEBUG: People data:', JSON.stringify(peopleData, null, 2));

      return {
        linkedinId: peopleData.id,
        linkedinUrn: `urn:li:person:${peopleData.id}`,
        name: `${peopleData.firstName?.localized?.en_US || ''} ${peopleData.lastName?.localized?.en_US || ''}`.trim(),
        given_name: peopleData.firstName?.localized?.en_US || '',
        family_name: peopleData.lastName?.localized?.en_US || '',
        email: peopleData.emailAddress,
        picture: peopleData.profilePicture?.displayImage?.elements?.[0]?.identifiers?.[0]?.identifier
      };
    } else {
      const errorText = await peopleResponse.text();
      console.log('⚠️  Method 2 FAILED: People endpoint error:', errorText);
    }
  } catch (error) {
    console.log('⚠️  Method 2 ERROR:', error.message);
  }

  console.log('❌ All profile methods failed');
  return null;
}

// Create minimal profile info from DMA URN
function createProfileFromDmaUrn(dmaUrn) {
  console.log('🔄 Creating minimal profile from DMA URN...');
  
  const linkedinId = dmaUrn.replace('urn:li:person:', '');
  return {
    linkedinId,
    linkedinUrn: dmaUrn,
    name: 'LinkedIn User (DMA)',
    given_name: 'LinkedIn',
    family_name: 'User',
    email: `dma-user-${linkedinId}@linkedin-growth.app`,
    picture: null
  };
}

// Enhanced changelog generation
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
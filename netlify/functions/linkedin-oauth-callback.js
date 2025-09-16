// Updated LinkedIn OAuth Callback with DMA URN Population Fix
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

    console.log('Processing OAuth callback with code:', code.substring(0, 20) + '...');

    // Exchange code for access token
    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Failed to exchange authorization code' })
      };
    }

    const tokenData = await tokenResponse.json();
    console.log('Token exchange successful');

    // Get basic profile info
    const profileInfo = await getBasicProfileInfo(tokenData.access_token);
    if (!profileInfo) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Failed to get profile information' })
      };
    }

    // Get DMA URN (new functionality)
    const dmaUrn = await getDmaUrn(tokenData.access_token);
    console.log('DMA URN retrieved:', dmaUrn ? dmaUrn : 'None');

    // Create or update user with DMA URN
    const user = await createOrUpdateUser(profileInfo, tokenData.access_token, dmaUrn);
    if (!user) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Failed to create or update user' })
      };
    }

    // Enable changelog event generation for DMA users
    if (dmaUrn) {
      await enableChangelogGeneration(tokenData.access_token);
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar_url: user.avatar_url,
          dma_active: user.dma_active,
          linkedin_dma_member_urn: user.linkedin_dma_member_urn
        },
        tokens: {
          access_token: tokenData.access_token,
          expires_in: tokenData.expires_in
        }
      })
    };

  } catch (error) {
    console.error('OAuth callback error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error', details: error.message })
    };
  }
}

// Get basic profile information
async function getBasicProfileInfo(accessToken) {
  try {
    console.log('Fetching basic profile info...');
    
    const response = await fetch('https://api.linkedin.com/v2/people/~?projection=(id,firstName,lastName,emailAddress,profilePicture(displayImage~:playableStreams))', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'LinkedIn-Version': '202312'
      }
    });

    if (!response.ok) {
      console.error('Profile fetch failed:', response.status, response.statusText);
      return null;
    }

    const profile = await response.json();
    console.log('Basic profile retrieved:', profile.id);

    return {
      linkedinId: profile.id,
      linkedinUrn: `urn:li:person:${profile.id}`,
      name: `${profile.firstName.localized.en_US} ${profile.lastName.localized.en_US}`,
      given_name: profile.firstName.localized.en_US,
      family_name: profile.lastName.localized.en_US,
      email: profile.emailAddress,
      picture: profile.profilePicture?.displayImage?.elements?.[0]?.identifiers?.[0]?.identifier || null
    };
  } catch (error) {
    console.error('Error fetching basic profile:', error);
    return null;
  }
}

// NEW: Get DMA URN from LinkedIn API
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
      console.error('DMA URN fetch failed:', response.status, response.statusText);
      return null;
    }

    const authData = await response.json();
    console.log('DMA authorization response:', authData);

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

// NEW: Enable changelog generation for DMA users
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

// UPDATED: Create or update user with DMA URN support
async function createOrUpdateUser(profileInfo, accessToken, dmaUrn) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('Creating/updating user with DMA URN...');

    // Try to find existing user by multiple methods
    let existingUser = null;

    // 1. First try to find by DMA URN if available
    if (dmaUrn) {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('linkedin_dma_member_urn', dmaUrn)
        .single();
      
      if (data) {
        existingUser = data;
        console.log('User found by DMA URN');
      }
    }

    // 2. If not found, try by regular LinkedIn URN
    if (!existingUser && profileInfo.linkedinUrn) {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('linkedin_member_urn', profileInfo.linkedinUrn)
        .single();
      
      if (data) {
        existingUser = data;
        console.log('User found by LinkedIn URN');
      }
    }

    // 3. If still not found, try by email
    if (!existingUser && profileInfo.email) {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('email', profileInfo.email)
        .single();
      
      if (data) {
        existingUser = data;
        console.log('User found by email');
      }
    }

    const now = new Date().toISOString();

    if (existingUser) {
      // Update existing user
      console.log('Updating existing user:', existingUser.id);
      
      const updateData = {
        name: profileInfo.name,
        given_name: profileInfo.given_name,
        family_name: profileInfo.family_name,
        avatar_url: profileInfo.picture,
        linkedin_member_urn: profileInfo.linkedinUrn,
        last_login: now,
        updated_at: now
      };

      // Add DMA URN if available and not already set
      if (dmaUrn && !existingUser.linkedin_dma_member_urn) {
        updateData.linkedin_dma_member_urn = dmaUrn;
        updateData.dma_active = true;
        updateData.dma_consent_date = now;
        console.log('Adding DMA URN to existing user');
      }

      const { data: updatedUser, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', existingUser.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating user:', error);
        return null;
      }

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
        last_login: now
      };

      // Add DMA URN if available
      if (dmaUrn) {
        newUserData.linkedin_dma_member_urn = dmaUrn;
        newUserData.dma_active = true;
        newUserData.dma_consent_date = now;
        console.log('Creating new user with DMA URN');
      }

      const { data: newUser, error } = await supabase
        .from('users')
        .insert(newUserData)
        .select()
        .single();

      if (error) {
        console.error('Error creating user:', error);
        return null;
      }

      console.log('New user created:', newUser.id);
      return newUser;
    }
  } catch (error) {
    console.error('Error in createOrUpdateUser:', error);
    return null;
  }
}
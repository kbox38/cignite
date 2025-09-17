// netlify/functions/debug-dma-setup.js - Debug DMA setup issues
export async function handler(event, context) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders };
  }

  const { authorization } = event.headers;
  const { userEmail, action = 'verify' } = event.queryStringParameters || {};

  if (!authorization) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'No authorization token' })
    };
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    if (action === 'verify' && userEmail) {
      // Verify DMA setup for specific user
      const { data: verification, error } = await supabase
        .rpc('verify_dma_setup', { user_email: userEmail });

      if (error) {
        throw error;
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          verification: verification[0],
          timestamp: new Date().toISOString()
        })
      };
    }

    if (action === 'list') {
      // List all users with DMA issues
      const { data: users, error } = await supabase
        .from('users')
        .select('id, name, email, linkedin_member_urn, linkedin_dma_member_urn, dma_active, dma_consent_date, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const usersWithIssues = users.filter(user => 
        !user.dma_active || 
        !user.linkedin_dma_member_urn || 
        !user.dma_consent_date
      );

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          totalUsers: users.length,
          usersWithDmaIssues: usersWithIssues.length,
          usersWithIssues: usersWithIssues,
          summary: {
            missingDmaUrn: users.filter(u => !u.linkedin_dma_member_urn).length,
            dmaInactive: users.filter(u => !u.dma_active).length,
            missingConsentDate: users.filter(u => !u.dma_consent_date).length
          },
          timestamp: new Date().toISOString()
        })
      };
    }

    if (action === 'test-token') {
      // Test the current DMA token
      console.log('Testing DMA token...');
      
      try {
        // Test member authorizations endpoint
        const authResponse = await fetch(
          'https://api.linkedin.com/rest/memberAuthorizations?q=memberAndApplication',
          {
            headers: {
              'Authorization': authorization,
              'LinkedIn-Version': '202312'
            }
          }
        );

        const authData = authResponse.ok ? await authResponse.json() : null;
        
        // Test snapshot endpoint
        const snapshotResponse = await fetch(
          'https://api.linkedin.com/rest/memberSnapshotData?q=criteria&domain=PROFILE',
          {
            headers: {
              'Authorization': authorization,
              'LinkedIn-Version': '202312'
            }
          }
        );

        const snapshotData = snapshotResponse.ok ? await snapshotResponse.json() : null;

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            tokenTest: {
              memberAuthorizations: {
                status: authResponse.status,
                success: authResponse.ok,
                hasElements: !!authData?.elements,
                elementsCount: authData?.elements?.length || 0,
                dmaUrn: authData?.elements?.[0]?.memberComplianceAuthorizationKey?.member || null
              },
              snapshotData: {
                status: snapshotResponse.status,
                success: snapshotResponse.ok,
                hasElements: !!snapshotData?.elements,
                elementsCount: snapshotData?.elements?.length || 0
              }
            },
            timestamp: new Date().toISOString()
          })
        };
      } catch (testError) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            tokenTest: {
              error: testError.message,
              success: false
            },
            timestamp: new Date().toISOString()
          })
        };
      }
    }

    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Invalid action. Use: verify, list, or test-token',
        availableActions: ['verify', 'list', 'test-token']
      })
    };

  } catch (error) {
    console.error('Debug DMA setup error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Failed to debug DMA setup',
        details: error.message
      })
    };
  }
}
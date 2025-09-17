// netlify/functions/linkedin-oauth-start.js - DMA-Only OAuth
export async function handler(event, context) {
  console.log('=== DMA-ONLY OAUTH START ===');
  console.log('Query parameters:', event.queryStringParameters);
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders
    };
  }

  try {
    // Always use DMA credentials - no more type parameter
    const clientId = process.env.LINKEDIN_DMA_CLIENT_ID;
    const scope = 'r_dma_portability_3rd_party';
    
    console.log('DMA Client ID:', clientId ? `${clientId.substring(0, 10)}...` : 'MISSING');
    
    if (!clientId) {
      console.error('Missing DMA client ID');
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Missing DMA OAuth configuration' })
      };
    }
    
    // Determine redirect URI based on environment
    const baseRedirectUri = `${process.env.URL}/.netlify/functions/linkedin-oauth-callback`;
    const redirectUri = process.env.NODE_ENV === 'development'
      ? 'http://localhost:8888/.netlify/functions/linkedin-oauth-callback'
      : baseRedirectUri;
      
    console.log('DMA Redirect URI:', redirectUri);
    
    // Build DMA OAuth URL - always set state to 'dma'
    const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', scope);
    authUrl.searchParams.set('state', 'dma');
    
    console.log('Generated DMA auth URL:', authUrl.toString());
    
    return {
      statusCode: 302,
      headers: {
        ...corsHeaders,
        Location: authUrl.toString()
      }
    };
  } catch (error) {
    console.error('OAuth start error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Failed to initiate OAuth',
        details: error.message 
      })
    };
  }
}
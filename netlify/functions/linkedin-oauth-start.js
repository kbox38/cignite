// netlify/functions/linkedin-oauth-start.js - Restored two-step OAuth flow
export async function handler(event, context) {
  console.log('=== OAUTH START ===');
  console.log('Query parameters:', event.queryStringParameters);
  
  const { type = 'basic' } = event.queryStringParameters || {};
  
  console.log('🔍 DEBUG: OAuth type requested:', type);
  
  // Determine which OAuth flow to use
  const isBasic = type === 'basic';
  const clientId = isBasic ? process.env.LINKEDIN_CLIENT_ID : process.env.LINKEDIN_DMA_CLIENT_ID;
  const scope = isBasic ? 'openid profile email w_member_social' : 'r_dma_portability_3rd_party';
  
  console.log('🔍 DEBUG: Using client ID exists:', !!clientId);
  console.log('🔍 DEBUG: Using scope:', scope);
  console.log('🔍 DEBUG: OAuth flow type:', isBasic ? 'Basic' : 'DMA');
  
  if (!clientId) {
    console.error(`❌ Missing ${isBasic ? 'basic' : 'DMA'} client ID`);
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: `Missing ${isBasic ? 'basic' : 'DMA'} OAuth configuration` })
    };
  }
  
  // Use correct redirect URI
  const baseRedirectUri = `${process.env.URL}/.netlify/functions/linkedin-oauth-callback`;
  const redirectUri = process.env.NODE_ENV === 'development'
    ? 'http://localhost:8888/.netlify/functions/linkedin-oauth-callback'
    : baseRedirectUri;
    
  console.log('🔍 DEBUG: Redirect URI:', redirectUri);
  
  // Generate OAuth URL with appropriate state
  const state = isBasic ? 'basic' : 'dma';
  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${state}`;
  
  console.log('✅ Generated OAuth URL for', isBasic ? 'Basic' : 'DMA');
  console.log('🔍 DEBUG: Auth URL preview:', authUrl.substring(0, 100) + '...');
  
  return {
    statusCode: 302,
    headers: {
      Location: authUrl,
      'Access-Control-Allow-Origin': '*'
    }
  };
}
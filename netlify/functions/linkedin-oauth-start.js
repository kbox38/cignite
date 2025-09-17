// netlify/functions/linkedin-oauth-start.js - DMA-only OAuth flow
export async function handler(event, context) {
  console.log('=== DMA-ONLY OAUTH START ===');
  console.log('Query parameters:', event.queryStringParameters);
  
  // Always use DMA OAuth - no type parameter needed
  const clientId = process.env.LINKEDIN_DMA_CLIENT_ID;
  const scope = 'r_dma_portability_3rd_party';
  
  console.log('🔍 DEBUG: DMA Client ID exists:', !!clientId);
  console.log('🔍 DEBUG: Using DMA scope:', scope);
  
  if (!clientId) {
    console.error('❌ Missing DMA client ID');
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Missing DMA OAuth configuration' })
    };
  }
  
  // Use correct redirect URI
  const baseRedirectUri = `${process.env.URL}/.netlify/functions/linkedin-oauth-callback`;
  const redirectUri = process.env.NODE_ENV === 'development'
    ? 'http://localhost:8888/.netlify/functions/linkedin-oauth-callback'
    : baseRedirectUri;
    
  console.log('🔍 DEBUG: Redirect URI:', redirectUri);
  
  // Always use DMA state
  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=dma`;
  
  console.log('✅ Generated DMA OAuth URL');
  console.log('🔍 DEBUG: Auth URL preview:', authUrl.substring(0, 100) + '...');
  
  return {
    statusCode: 302,
    headers: {
      Location: authUrl,
      'Access-Control-Allow-Origin': '*'
    }
  };
}
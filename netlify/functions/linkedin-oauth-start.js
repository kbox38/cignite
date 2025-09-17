// netlify/functions/linkedin-oauth-start.js - Updated for DMA-only
export async function handler(event, context) {
  console.log('DMA OAuth start called with:', event.queryStringParameters);
  
  // Remove the type parameter - always use DMA
  const baseUrl = 'https://www.linkedin.com/oauth/v2/authorization';
  
  // Always use DMA credentials and scope
  const clientId = process.env.LINKEDIN_DMA_CLIENT_ID;
  const scope = 'r_dma_portability_3rd_party';
  
  if (!clientId) {
    console.error('Missing DMA client ID');
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Missing DMA client configuration' })
    };
  }
  
  const redirectUri = `${process.env.URL}/.netlify/functions/linkedin-oauth-callback`;
  
  // For development, use localhost
  const actualRedirectUri = process.env.NODE_ENV === 'development'
    ? 'http://localhost:8888/.netlify/functions/linkedin-oauth-callback'
    : redirectUri;
    
  console.log('DMA Redirect URI:', actualRedirectUri);
  
  // Always set state to 'dma' for consistency
  const authUrl = `${baseUrl}?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(actualRedirectUri)}&scope=${encodeURIComponent(scope)}&state=dma`;
  console.log('Generated DMA auth URL:', authUrl);
  
  return {
    statusCode: 302,
    headers: {
      Location: authUrl,
      'Access-Control-Allow-Origin': '*'
    }
  };
}
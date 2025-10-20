export async function handler(event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      }
    };
  }

  const { authorization } = event.headers;
  
  if (!authorization) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'No authorization token' })
    };
  }

  try {
    const response = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: {
        'Authorization': authorization,
        'LinkedIn-Version': '202312',
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      },
      body: JSON.stringify(data)
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Failed to fetch LinkedIn profile data' })
    };
  }
}
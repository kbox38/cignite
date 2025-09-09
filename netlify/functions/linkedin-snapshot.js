exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, LinkedIn-Version',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const authorization = event.headers.authorization;
    if (!authorization) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Authorization header required' })
      };
    }

    // Extract query parameters
    const { domain = 'MEMBER_SHARE_INFO', allTime } = event.queryStringParameters || {};
    
    console.log(`LinkedIn Snapshot API call - Domain: ${domain}, AllTime: ${allTime}`);

    const response = await fetch(
      `https://api.linkedin.com/rest/memberSnapshotData?q=criteria&domain=${domain}`,
      {
        headers: {
          'Authorization': authorization,
          'LinkedIn-Version': '202312',
          'X-Restli-Protocol-Version': '2.0.0'
        }
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`No snapshot data available for domain ${domain} (404)`);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ 
            elements: [], 
            message: 'No data found for this domain',
            domain: domain
          })
        };
      }
      
      const errorText = await response.text();
      console.error(`LinkedIn Snapshot API error: ${response.status} - ${errorText}`);
      
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ 
          error: 'LinkedIn API error: ' + response.status,
          details: errorText,
          statusCode: response.status
        })
      };
    }

    const data = await response.json();
    
    console.log(`LinkedIn Snapshot API success - Domain: ${domain}:`, {
      hasElements: !!data.elements,
      elementsCount: data.elements?.length,
      totalSnapshotData: data.elements?.reduce((sum, el) => sum + (el.snapshotData?.length || 0), 0)
    });

    // Enhanced logging for debugging data structure
    if (data.elements?.length > 0) {
      const firstElement = data.elements[0];
      console.log('First snapshot element structure:', {
        keys: Object.keys(firstElement),
        domain: firstElement.snapshotDomain,
        dataLength: firstElement.snapshotData?.length,
        firstDataItemKeys: firstElement.snapshotData?.[0] ? Object.keys(firstElement.snapshotData[0]) : []
      });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ...data,
        success: true,
        domain: domain,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Error in LinkedIn Snapshot function:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};
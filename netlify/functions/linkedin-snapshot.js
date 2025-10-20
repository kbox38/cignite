// netlify/functions/linkedin-snapshot.js
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

    // ⭐ CRITICAL FIX: Server-side date filtering for last year posts
    if (domain === 'MEMBER_SHARE_INFO' && data.elements?.length > 0) {
      console.log('🔍 Applying server-side date filtering for last year...');
      
      // Calculate 365 days ago (1 year) cutoff
      const now = Date.now();
      const oneYearAgo = now - (365 * 24 * 60 * 60 * 1000);
      
      console.log('Date filter parameters:', {
        now: new Date(now).toISOString(),
        oneYearAgo: new Date(oneYearAgo).toISOString(),
        cutoffDays: 365
      });

      // Filter each element's snapshotData
      data.elements = data.elements.map(element => {
        if (element.snapshotDomain === 'MEMBER_SHARE_INFO' && element.snapshotData) {
          const originalCount = element.snapshotData.length;
          
          // Filter posts by date
          const filteredSnapshotData = element.snapshotData.filter((item, index) => {
            try {
              // Extract date from multiple possible field names
              const shareDate = 
                item['Share Date'] ||
                item['Date'] ||
                item['shareDate'] ||
                item['created_at'] ||
                item['timestamp'] ||
                item['createdAt'] ||
                '';

              if (!shareDate) {
                console.log(`⚠️ No date found for item ${index}, skipping`);
                return false; // Skip items without dates
              }

              const parsedDate = new Date(shareDate);
              if (isNaN(parsedDate.getTime())) {
                console.log(`⚠️ Invalid date format for item ${index}: ${shareDate}`);
                return false; // Skip items with invalid dates
              }

              const postTime = parsedDate.getTime();
              const isWithinOneYear = postTime >= oneYearAgo;
              
              if (!isWithinOneYear && index < 5) { // Log first few filtered items
                console.log(`🚫 Filtering out old post from ${parsedDate.toISOString()}`);
              }
              
              return isWithinOneYear;
            } catch (error) {
              console.warn(`Error processing date for item ${index}:`, error);
              return false; // Skip items with processing errors
            }
          });

          // Sort by date (newest first) and limit to 100 most recent
          const sortedData = filteredSnapshotData.sort((a, b) => {
            const dateA = new Date(a['Share Date'] || a['Date'] || a['shareDate'] || 0).getTime();
            const dateB = new Date(b['Share Date'] || b['Date'] || b['shareDate'] || 0).getTime();
            return dateB - dateA; // Newest first
          }); // Limit to most recent 100 posts

          console.log(`📊 Date filtering results:`, {
            originalCount,
            filteredCount: filteredSnapshotData.length,
            finalCount: sortedData.length,
            dateRange: sortedData.length > 0 ? {
              newest: new Date(sortedData[0]['Share Date'] || sortedData[0]['Date'] || sortedData[0]['shareDate'] || 0).toISOString(),
              oldest: new Date(sortedData[sortedData.length - 1]['Share Date'] || sortedData[sortedData.length - 1]['Date'] || sortedData[sortedData.length - 1]['shareDate'] || 0).toISOString()
            } : 'No posts in range'
          });

          return {
            ...element,
            snapshotData: sortedData
          };
        }
        return element;
      });
    }

    // Enhanced logging for debugging data structure
    if (data.elements?.length > 0) {
      const firstElement = data.elements[0];
      console.log('First snapshot element structure:', {
        keys: Object.keys(firstElement),
        domain: firstElement.snapshotDomain,
        dataLength: firstElement.snapshotData?.length,
        firstDataItemKeys: firstElement.snapshotData?.[0] ? Object.keys(firstElement.snapshotData[0]) : []
      });

      // Log sample dates from first few items
      if (firstElement.snapshotData?.length > 0) {
        console.log('Sample post dates from snapshot:');
        firstElement.snapshotData.slice(0, 5).forEach((item, idx) => {
          const date = item['Share Date'] || item['Date'] || item['shareDate'] || 'No date';
          console.log(`  Post ${idx + 1}: ${date}`);
        });
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data)
    };

  } catch (error) {
    console.error('LinkedIn Snapshot API function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      })
    };
  }
};
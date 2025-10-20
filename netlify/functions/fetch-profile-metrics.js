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
    // Fetch profile data
    const profileResponse = await fetch(
      'https://api.linkedin.com/rest/memberSnapshotData?q=criteria&domain=PROFILE',
      {
        headers: {
          'Authorization': authorization,
          'LinkedIn-Version': '202312'
        }
      }
    );
    
    const profileData = await profileResponse.json();
    const profile = profileData.elements?.[0]?.snapshotData?.[0] || {};
    
    // Extract available metrics with multiple field name variations
    const metrics = {
      profileViews: profile['Profile Views'] || profile['profile_views'] || profile.profileViews || 0,
      searchAppearances: profile['Search Appearances'] || profile['search_appearances'] || profile.searchAppearances || 0,
      uniqueViewers: profile['Unique Viewers'] || profile['unique_viewers'] || profile.uniqueViewers || 0,
      viewerCompanies: profile['Viewer Companies'] || profile['viewer_companies'] || profile.viewerCompanies || [],
      viewerTitles: profile['Viewer Titles'] || profile['viewer_titles'] || profile.viewerTitles || []
    };
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      },
      body: JSON.stringify(metrics)
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: error.message })
    };
  }
}
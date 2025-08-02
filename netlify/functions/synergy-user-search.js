export async function handler(event, context) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
      },
    };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const { authorization } = event.headers;
  const { search = "", limit = "10" } = event.queryStringParameters || {};

  if (!authorization) {
    return {
      statusCode: 401,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: "No authorization token" }),
    };
  }

  try {
    console.log("Synergy User Search:", { search, limit });

    // In a real implementation, this would query your user database
    // For now, we'll return mock users that represent platform users with DMA active
    const mockUsers = [
      {
        id: "user-001",
        name: "Sarah Johnson",
        email: "sarah.johnson@example.com",
        headline: "Marketing Director at TechCorp",
        industry: "Technology",
        location: "San Francisco, CA",
        avatarUrl: "https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=1",
        linkedinMemberUrn: "urn:li:person:sarah123",
        dmaActive: true,
        mutualConnections: 12,
        joinedDate: "2024-01-15"
      },
      {
        id: "user-002",
        name: "Michael Chen",
        email: "michael.chen@example.com",
        headline: "Senior Software Engineer at InnovateCorp",
        industry: "Software Development",
        location: "New York, NY",
        avatarUrl: "https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=1",
        linkedinMemberUrn: "urn:li:person:michael456",
        dmaActive: true,
        mutualConnections: 8,
        joinedDate: "2024-02-20"
      },
      {
        id: "user-003",
        name: "Emily Rodriguez",
        email: "emily.rodriguez@example.com",
        headline: "Sales Manager at Enterprise Solutions",
        industry: "Sales",
        location: "Chicago, IL",
        avatarUrl: "https://images.pexels.com/photos/697509/pexels-photo-697509.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=1",
        linkedinMemberUrn: "urn:li:person:emily789",
        dmaActive: true,
        mutualConnections: 15,
        joinedDate: "2024-01-10"
      },
      {
        id: "user-004",
        name: "David Kim",
        email: "david.kim@example.com",
        headline: "Product Manager at StartupXYZ",
        industry: "Product Management",
        location: "Austin, TX",
        avatarUrl: "https://images.pexels.com/photos/1043471/pexels-photo-1043471.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=1",
        linkedinMemberUrn: "urn:li:person:david101",
        dmaActive: true,
        mutualConnections: 6,
        joinedDate: "2024-03-05"
      },
      {
        id: "user-005",
        name: "Lisa Thompson",
        email: "lisa.thompson@example.com",
        headline: "HR Director at GlobalCorp",
        industry: "Human Resources",
        location: "Seattle, WA",
        avatarUrl: "https://images.pexels.com/photos/762020/pexels-photo-762020.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=1",
        linkedinMemberUrn: "urn:li:person:lisa202",
        dmaActive: false, // This user doesn't have DMA active
        mutualConnections: 3,
        joinedDate: "2024-02-28"
      }
    ];

    // Filter users based on search term
    let filteredUsers = mockUsers;
    if (search && search.trim()) {
      const searchLower = search.toLowerCase();
      filteredUsers = mockUsers.filter(user => 
        user.name.toLowerCase().includes(searchLower) ||
        user.email.toLowerCase().includes(searchLower) ||
        user.headline.toLowerCase().includes(searchLower) ||
        user.industry.toLowerCase().includes(searchLower)
      );
    }

    // Only return users with DMA active for synergy partnerships
    const dmaActiveUsers = filteredUsers.filter(user => user.dmaActive);

    // Apply limit
    const limitNum = parseInt(limit);
    const results = dmaActiveUsers.slice(0, limitNum);

    console.log(`Found ${results.length} DMA-active users matching search: "${search}"`);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
      body: JSON.stringify({
        users: results,
        totalFound: dmaActiveUsers.length,
        searchTerm: search,
        dmaRequirement: "Only users with active DMA consent can be added as Synergy partners",
        metadata: {
          searchPerformed: !!search,
          resultsLimited: dmaActiveUsers.length > limitNum,
          timestamp: new Date().toISOString()
        }
      }),
    };
  } catch (error) {
    console.error("Synergy user search error:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Failed to search users",
        details: error.message
      }),
    };
  }
}
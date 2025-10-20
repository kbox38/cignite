export async function handler(event, context) {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      },
    };
  }

  console.log("=== LINKEDIN MEDIA DOWNLOAD ===");
  console.log("Query parameters:", event.queryStringParameters);
  console.log("Headers present:", Object.keys(event.headers));

  const { assetId, token } = event.queryStringParameters || {};
  const authHeader = event.headers.authorization || event.headers.Authorization;

  console.log("Asset ID:", assetId);
  console.log("Token from params:", token ? `${token.substring(0, 20)}...` : "missing");
  console.log("Auth header:", authHeader ? `${authHeader.substring(0, 20)}...` : "missing");

  if (!assetId) {
    console.error("Missing assetId parameter");
    return {
      statusCode: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: "Missing assetId parameter" })
    };
  }

  // Use token from params or auth header
  const accessToken = token || (authHeader ? authHeader.replace('Bearer ', '') : null);
  
  if (!accessToken) {
    console.error("No access token available");
    return {
      statusCode: 401,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: "No access token provided" })
    };
  }

  try {
    // Clean the asset ID (remove URN prefix if present)
    const cleanAssetId = assetId.replace("urn:li:digitalmediaAsset:", "");
    console.log("Clean asset ID:", cleanAssetId);
    
    // Try multiple LinkedIn media endpoints
    const endpoints = [
      `https://api.linkedin.com/v2/assets/${encodeURIComponent(cleanAssetId)}`,
      `https://api.linkedin.com/rest/images/${encodeURIComponent(cleanAssetId)}`,
      `https://api.linkedin.com/mediaDownload/${encodeURIComponent(cleanAssetId)}`,
      `https://api.linkedin.com/v2/digitalmediaAssets/${encodeURIComponent(cleanAssetId)}`
    ];
    
    let lastError = null;
    
    for (const endpoint of endpoints) {
      try {
        console.log(`Trying endpoint: ${endpoint}`);
        
        const response = await fetch(endpoint, {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "LinkedIn-Version": "202312",
            "User-Agent": "LinkedInGrowth/1.0",
            "Accept": "image/*, application/json"
          },
          redirect: "follow"
        });

        console.log(`Response from ${endpoint}:`, {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        });

        if (response.ok) {
          // Check if it's JSON (metadata) or binary (image)
          const contentType = response.headers.get("content-type") || "";
          
          if (contentType.includes("application/json")) {
            // This might be metadata, try to extract download URL
            const metadata = await response.json();
            console.log("Got metadata:", metadata);
            
            // Look for download URLs in the metadata
            const downloadUrl = metadata.downloadUrl || 
                               metadata.media?.downloadUrl ||
                               metadata.elements?.[0]?.downloadUrl;
            
            if (downloadUrl) {
              console.log("Found download URL in metadata:", downloadUrl);
              // Fetch the actual image
              const imageResponse = await fetch(downloadUrl, {
                headers: {
                  "Authorization": `Bearer ${accessToken}`,
                  "User-Agent": "LinkedInGrowth/1.0"
                }
              });
              
              if (imageResponse.ok) {
                const imageBuffer = await imageResponse.arrayBuffer();
                const imageContentType = imageResponse.headers.get("content-type") || "image/jpeg";
                
                console.log(`Successfully fetched image via metadata: ${imageBuffer.byteLength} bytes`);
                
                return {
                  statusCode: 200,
                  headers: {
                    "Content-Type": imageContentType,
                    "Access-Control-Allow-Origin": "*",
                    "Cache-Control": "public, max-age=3600",
                  },
                  body: Buffer.from(imageBuffer).toString("base64"),
                  isBase64Encoded: true
                };
              }
            }
          } else if (contentType.includes("image/")) {
            // Direct image response
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            
            console.log(`Successfully fetched image directly: ${buffer.length} bytes, type: ${contentType}`);
            
            return {
              statusCode: 200,
              headers: {
                "Content-Type": contentType,
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, max-age=3600",
              },
              body: buffer.toString("base64"),
              isBase64Encoded: true
            };
          }
        }
        
        // Store the error for this endpoint
        lastError = {
          endpoint,
          status: response.status,
          statusText: response.statusText
        };
        
      } catch (endpointError) {
        console.error(`Error with endpoint ${endpoint}:`, endpointError.message);
        lastError = {
          endpoint,
          error: endpointError.message
        };
      }
    }
    
    // If we get here, all endpoints failed
    console.error("All endpoints failed. Last error:", lastError);
    
    // Return a more specific error based on the last attempt
    if (lastError?.status === 404) {
      return {
        statusCode: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: "Media asset not found" })
      };
    }
    
    if (lastError?.status === 403) {
      return {
        statusCode: 403,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: "Access denied to media asset" })
      };
    }
    
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ 
        error: "Failed to fetch media from all endpoints",
        details: lastError
      })
    };
    
  } catch (error) {
    console.error("Media download error:", error);
    console.error("Error stack:", error.stack);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Failed to download media",
        details: error.message
      })
    };
  }
}
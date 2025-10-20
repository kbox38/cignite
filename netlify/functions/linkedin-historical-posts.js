export async function handler(event, context) {
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

  const { authorization } = event.headers;
  const {
    domain = "MEMBER_SHARE_INFO",
    start = "0",
    count = "10",
    daysBack = "90",
  } = event.queryStringParameters || {};

  console.log("LinkedIn Historical Posts Function - Domain:", domain);
  console.log(
    "LinkedIn Historical Posts Function - Start:",
    start,
    "Count:",
    count
  );
  console.log("LinkedIn Historical Posts Function - Days Back:", daysBack);
  console.log(
    "LinkedIn Historical Posts Function - Authorization header present:",
    !!authorization
  );

  if (!authorization) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: "No authorization token" }),
    };
  }

  try {
    // Calculate the cutoff date for 90 days back
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(daysBack));
    const cutoffTimestamp = cutoffDate.getTime();

    let url = `https://api.linkedin.com/rest/memberSnapshotData?q=criteria&domain=${domain}&start=${start}&count=${count}`;

    console.log("LinkedIn Historical Posts Function - Calling URL:", url);

    const response = await fetch(url, {
      headers: {
        Authorization: authorization,
        "LinkedIn-Version": "202312",
      },
    });

    console.log(
      "LinkedIn Historical Posts Function - Response status:",
      response.status
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(
        "LinkedIn Historical Posts Function - API Error:",
        errorData
      );

      // Handle 404 gracefully (no data found)
      if (response.status === 404) {
        return {
          statusCode: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
          body: JSON.stringify({
            paging: {
              start: parseInt(start),
              count: parseInt(count),
              total: 0,
            },
            elements: [],
          }),
        };
      }

      throw new Error(
        `LinkedIn API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    console.log(
      "LinkedIn Historical Posts Function - Response data structure:",
      {
        hasElements: !!data.elements,
        elementsLength: data.elements?.length || 0,
        hasPaging: !!data.paging,
        pagingInfo: data.paging,
      }
    );

    // Process and filter the data
    if (data.elements && Array.isArray(data.elements)) {
      const processedElements = data.elements.map((element) => {
        if (
          element.snapshotDomain === "MEMBER_SHARE_INFO" &&
          element.snapshotData
        ) {
          // Filter snapshot data by date and process each share
          const filteredSnapshotData = element.snapshotData
            .filter((share) => {
              const shareDate =
                share.Date || share.shareDate || share["Share Date"];
              if (!shareDate) return false;

              const shareTimestamp = new Date(shareDate).getTime();
              return shareTimestamp >= cutoffTimestamp;
            })
            .map((share) => ({
              Visibility:
                share.Visibility || share.visibility || "MEMBER_NETWORK",
              ShareCommentary:
                share.ShareCommentary ||
                share.shareCommentary ||
                share.commentary ||
                "",
              MediaUrl: share.MediaUrl || share.mediaUrl || share["Media URL"],
              ShareLink:
                share.ShareLink || share.shareLink || share["Share URL"],
              Date: share.Date || share.shareDate || share["Share Date"],
              SharedUrl:
                share.SharedUrl || share.sharedUrl || share["Shared URL"],
              LikesCount:
                share.LikesCount ||
                share.likesCount ||
                share["Likes Count"] ||
                "0",
              CommentsCount:
                share.CommentsCount ||
                share.commentsCount ||
                share["Comments Count"] ||
                "0",
              SharesCount:
                share.SharesCount ||
                share.sharesCount ||
                share["Shares Count"] ||
                "0",
              MediaType:
                share.MediaType ||
                share.mediaType ||
                share["Media Type"] ||
                "TEXT",
            }));

          return {
            ...element,
            snapshotData: filteredSnapshotData,
          };
        }
        return element;
      });

      // Update paging information
      const totalFiltered = processedElements.reduce((total, element) => {
        if (element.snapshotData) {
          return total + element.snapshotData.length;
        }
        return total;
      }, 0);

      const updatedPaging = {
        ...data.paging,
        total: totalFiltered,
        hasMore: totalFiltered > parseInt(start) + parseInt(count),
      };

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
        body: JSON.stringify({
          paging: updatedPaging,
          elements: processedElements,
          cutoffDate: cutoffDate.toISOString(),
          daysBack: parseInt(daysBack),
        }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error("LinkedIn Historical Posts Function - Error:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Failed to fetch LinkedIn historical posts data",
        details: error.message,
      }),
    };
  }
}

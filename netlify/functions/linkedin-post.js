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

  if (!authorization) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: "No authorization token" }),
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { content, mediaUrl, mediaFile } = JSON.parse(event.body || "{}");

    if (!content) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Post content is required" }),
      };
    }

    console.log(
      "Creating LinkedIn post with content:",
      content.substring(0, 100) + "..."
    );
    console.log("Media URL:", mediaUrl);
    console.log("Media File present:", !!mediaFile);

    // First, get the user's profile to get their URN
    const profileResponse = await fetch(
      "https://api.linkedin.com/v2/userinfo",
      {
        headers: {
          Authorization: authorization,
          "LinkedIn-Version": "202312",
        },
      }
    );

    if (!profileResponse.ok) {
      throw new Error(
        `Failed to get user profile: ${profileResponse.statusText}`
      );
    }

    const profileData = await profileResponse.json();
    const userUrn = `urn:li:person:${profileData.sub}`;

    console.log("User URN:", userUrn);

    // Prepare the post data
    const postData = {
      author: userUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: {
            text: content,
          },
          shareMediaCategory: mediaUrl || mediaFile ? "IMAGE" : "NONE",
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
      },
    };

    // If media is provided, upload it first
    if (mediaUrl || mediaFile) {
      let mediaAsset = null;

      if (mediaFile) {
        // Handle base64 encoded file
        console.log("Processing base64 media file");
        const base64Data = mediaFile.split(",")[1]; // Remove data:image/jpeg;base64, prefix
        const buffer = Buffer.from(base64Data, "base64");

        // Upload to LinkedIn's media API
        const uploadResponse = await fetch(
          "https://api.linkedin.com/v2/assets?action=registerUpload",
          {
            method: "POST",
            headers: {
              Authorization: authorization,
              "LinkedIn-Version": "202312",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              registerUploadRequest: {
                recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
                owner: userUrn,
                serviceRelationships: [
                  {
                    relationshipType: "OWNER",
                    identifier: "urn:li:userGeneratedContent",
                  },
                ],
              },
            }),
          }
        );

        if (!uploadResponse.ok) {
          throw new Error(
            `Failed to register upload: ${uploadResponse.statusText}`
          );
        }

        const uploadData = await uploadResponse.json();
        console.log("Upload registration response:", uploadData);

        // Upload the actual file
        const asset = uploadData.value.asset;
        const uploadUrl =
          uploadData.value.uploadMechanism[
            "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
          ].uploadUrl;

        const fileUploadResponse = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            Authorization: authorization,
            "Content-Type": "application/octet-stream",
          },
          body: buffer,
        });

        if (!fileUploadResponse.ok) {
          throw new Error(
            `Failed to upload file: ${fileUploadResponse.statusText}`
          );
        }

        mediaAsset = asset;
        console.log("File uploaded successfully, asset:", asset);
      } else if (mediaUrl) {
        // For external URLs, we need to register them
        console.log("Processing external media URL");
        const registerResponse = await fetch(
          "https://api.linkedin.com/v2/assets?action=registerUpload",
          {
            method: "POST",
            headers: {
              Authorization: authorization,
              "LinkedIn-Version": "202312",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              registerUploadRequest: {
                recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
                owner: userUrn,
                serviceRelationships: [
                  {
                    relationshipType: "OWNER",
                    identifier: "urn:li:userGeneratedContent",
                  },
                ],
              },
            }),
          }
        );

        if (!registerResponse.ok) {
          throw new Error(
            `Failed to register external media: ${registerResponse.statusText}`
          );
        }

        const registerData = await registerResponse.json();
        mediaAsset = registerData.value.asset;
        console.log("External media registered, asset:", mediaAsset);
      }

      // Add media to post
      if (mediaAsset) {
        postData.specificContent["com.linkedin.ugc.ShareContent"].media = [
          {
            status: "READY",
            description: {
              text: "Post media",
            },
            media: mediaAsset,
            title: {
              text: "Post media",
            },
          },
        ];
      }
    }

    console.log("Post data structure:", JSON.stringify(postData, null, 2));

    // Create the post
    const postResponse = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        Authorization: authorization,
        "LinkedIn-Version": "202312",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(postData),
    });

    console.log("LinkedIn API response status:", postResponse.status);
    console.log(
      "LinkedIn API response headers:",
      Object.fromEntries(postResponse.headers.entries())
    );

    const responseData = await postResponse.json();
    console.log("LinkedIn API response data:", responseData);

    if (!postResponse.ok) {
      throw new Error(
        `LinkedIn API error: ${responseData.message || postResponse.statusText}`
      );
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
      body: JSON.stringify({
        success: true,
        postId: responseData.id,
        message: "Post created successfully",
      }),
    };
  } catch (error) {
    console.error("Error creating LinkedIn post:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Failed to create LinkedIn post",
        details: error.message,
      }),
    };
  }
}

export async function handler(event, context) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const { authorization } = event.headers;
  
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
    const { post, viewerProfile } = JSON.parse(event.body || "{}");

    if (!post || !post.urn) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: "Post data is required" }),
      };
    }

    console.log("=== SYNERGY COMMENT SUGGESTION ===");
    console.log("Post URN:", post.urn);
    console.log("Post text preview:", post.text?.substring(0, 100));
    console.log("Viewer profile:", viewerProfile);

    // Generate AI suggestion
    const suggestion = await generateCommentSuggestion(post, viewerProfile);

    const result = {
      urn: post.urn,
      suggestion: suggestion
    };

    console.log("Generated suggestion:", suggestion);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
      body: JSON.stringify(result),
    };

  } catch (error) {
    console.error("Synergy suggest comment error:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Failed to generate comment suggestion",
        details: error.message
      }),
    };
  }
}

async function generateCommentSuggestion(post, viewerProfile) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  
  if (!OPENAI_API_KEY) {
    console.warn("OpenAI API key not configured, returning fallback suggestion");
    return "Great insights! This really resonates with my experience. What's been your biggest learning from this?";
  }

  try {
    const systemPrompt = `You are a professional LinkedIn commenter. Write a concise, genuine comment (max 300 characters).
Be positive, specific, and add value. Avoid emojis and buzzwords. Optional: one targeted question.
Don't repeat the post. Tone: warm, professional, helpful.`;

    const userPrompt = `Post text:
---
${post.text || ""}

Post type: ${post.mediaType || "TEXT"}
Partner: ${post.partnerName || "Partner"}
My headline: ${viewerProfile?.headline || ""}
My focus topics: ${viewerProfile?.topics?.join(", ") || ""}

Produce only the comment text.`;

    console.log("Calling OpenAI API for comment suggestion");

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 100,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const suggestion = data.choices[0]?.message?.content || '';
    
    // Clean and validate suggestion
    const cleanSuggestion = suggestion
      .replace(/^["']|["']$/g, '') // Remove quotes
      .replace(/\n/g, ' ') // Replace newlines with spaces
      .trim()
      .substring(0, 300); // Ensure max 300 chars

    return cleanSuggestion || "Thanks for sharing this valuable insight! What's your take on the future implications?";

  } catch (error) {
    console.error('OpenAI API error:', error);
    
    // Fallback suggestions
    const fallbacks = [
      "Great insights! This really resonates with my experience. What's been your biggest learning from this?",
      "Excellent point about this topic. Thanks for sharing your perspective - it's given me a lot to think about!",
      "This is exactly what I've been thinking about lately. Your perspective is spot on - how do you see this evolving?"
    ];
    
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
}
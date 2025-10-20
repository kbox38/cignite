// netlify/functions/openai-comment-suggestions.mjs
// Fixed OpenAI function with proper package handling and no fallbacks

export async function handler(event, context) {
  console.log('🤖 OpenAI Comment Suggestions: Handler started');

  // Handle CORS preflight
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

  try {
    const { authorization } = event.headers;
    if (!authorization) {
      return {
        statusCode: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: "Authorization required" }),
      };
    }

    const requestBody = JSON.parse(event.body || '{}');
    const { postContent, postContext } = requestBody;

    if (!postContent) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: "Post content is required" }),
      };
    }

    console.log('📝 Generating comment suggestions for post:', {
      contentLength: postContent.length,
      authorName: postContext?.authorName,
      mediaType: postContext?.mediaType,
      hasEngagementMetrics: !!postContext?.engagementMetrics
    });

    // Check if OpenAI API key is available
    const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ 
          error: "OpenAI API key not configured",
          message: "Please add OPENAI_API_KEY to your environment variables"
        }),
      };
    }

    // Generate AI comment suggestions using fetch instead of OpenAI SDK
    const suggestions = await generateCommentSuggestionsWithFetch(postContent, postContext, apiKey);

    console.log('✅ Generated', suggestions.length, 'comment suggestions');

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        suggestions: suggestions,
        generatedAt: new Date().toISOString(),
        postContentPreview: postContent.substring(0, 100) + '...'
      }),
    };

  } catch (error) {
    console.error("❌ OpenAI Comment Suggestions error:", error);
    
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Failed to generate comment suggestions",
        message: error.message,
        generatedAt: new Date().toISOString()
      }),
    };
  }
}

/**
 * Generate AI-powered comment suggestions using fetch API (no SDK dependency)
 */
async function generateCommentSuggestionsWithFetch(postContent, postContext = {}, apiKey) {
  try {
    // Build context for better suggestions
    const contextInfo = [];
    if (postContext.authorName) {
      contextInfo.push(`Author: ${postContext.authorName}`);
    }
    if (postContext.mediaType && postContext.mediaType !== 'TEXT') {
      contextInfo.push(`Media Type: ${postContext.mediaType}`);
    }
    if (postContext.engagementMetrics) {
      const { likes = 0, comments = 0, shares = 0 } = postContext.engagementMetrics;
      contextInfo.push(`Engagement: ${likes} likes, ${comments} comments, ${shares} shares`);
    }

    const contextString = contextInfo.length > 0 ? `\n\nContext: ${contextInfo.join(', ')}` : '';

    const prompt = `You are an expert LinkedIn engagement strategist. Generate 2 thoughtful, professional comment suggestions for the following LinkedIn post. Each comment should be authentic, add value to the conversation, and encourage further engagement.

Post Content:
"${postContent}"${contextString}

Requirements:
1. Each comment should be 1-2 sentences long
2. Be genuine and professional
3. Add value or ask thoughtful questions
4. Avoid generic responses like "Great post!"
5. Make comments that would naturally generate replies
6. Consider the post's tone and content type

Return your response as a JSON array with this exact structure:
[
  {
    "text": "Your first comment suggestion here",
    "type": "engaging|professional|supportive",
    "reasoning": "Brief explanation of why this comment works"
  },
  {
    "text": "Your second comment suggestion here", 
    "type": "engaging|professional|supportive",
    "reasoning": "Brief explanation of why this comment works"
  }
]

Only return valid JSON, no additional text.`;

    console.log('🤖 Sending request to OpenAI API via fetch...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a LinkedIn engagement expert. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorData}`);
    }

    const completion = await response.json();
    const responseText = completion.choices[0]?.message?.content?.trim();
    
    if (!responseText) {
      throw new Error('Empty response from OpenAI');
    }

    console.log('🤖 OpenAI raw response:', responseText);

    // Parse JSON response
    let suggestions;
    try {
      suggestions = JSON.parse(responseText);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      // Try to extract JSON from response if wrapped in markdown
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not parse JSON response from OpenAI');
      }
    }

    // Validate and format suggestions
    if (!Array.isArray(suggestions)) {
      throw new Error('OpenAI response is not an array');
    }

    const formattedSuggestions = suggestions.map((suggestion, index) => {
      if (!suggestion.text || !suggestion.type || !suggestion.reasoning) {
        throw new Error(`Invalid suggestion format at index ${index}: missing required fields`);
      }
      
      return {
        text: suggestion.text.trim(),
        type: suggestion.type.toLowerCase(),
        reasoning: suggestion.reasoning.trim()
      };
    });

    console.log('✅ Successfully generated', formattedSuggestions.length, 'comment suggestions');
    return formattedSuggestions;

  } catch (error) {
    console.error('OpenAI API error:', error);
    throw error; // Re-throw instead of using fallbacks
  }
}
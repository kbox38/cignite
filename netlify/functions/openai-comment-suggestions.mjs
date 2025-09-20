// netlify/functions/openai-comment-suggestions.mjs
// AI-powered comment suggestions for Synergy posts

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

    // Generate AI comment suggestions
    const suggestions = await generateCommentSuggestions(postContent, postContext);

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
    
    // Return fallback suggestions on error
    const fallbackSuggestions = [
      {
        text: "Great insights! Thanks for sharing this perspective.",
        type: 'professional',
        reasoning: 'Professional acknowledgment that works for most business content'
      },
      {
        text: "This resonates with my experience too. What's been your biggest takeaway?",
        type: 'engaging',
        reasoning: 'Engaging question that invites further discussion'
      }
    ];

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        suggestions: fallbackSuggestions,
        fallback: true,
        error: error.message,
        generatedAt: new Date().toISOString()
      }),
    };
  }
}

/**
 * Generate AI-powered comment suggestions using OpenAI
 */
async function generateCommentSuggestions(postContent, postContext = {}) {
  try {
    const { default: OpenAI } = await import('openai');
    
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY,
    });

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

    console.log('🤖 Sending request to OpenAI...');

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a LinkedIn engagement expert. Always respond with valid JSON only."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

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
        throw new Error('Could not parse JSON response');
      }
    }

    // Validate and format suggestions
    if (!Array.isArray(suggestions)) {
      throw new Error('Response is not an array');
    }

    const formattedSuggestions = suggestions.map((suggestion, index) => {
      if (!suggestion.text || !suggestion.type || !suggestion.reasoning) {
        console.warn(`Invalid suggestion at index ${index}:`, suggestion);
        return {
          text: "Thanks for sharing this valuable perspective!",
          type: 'professional',
          reasoning: 'Generic professional response (fallback)'
        };
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
    
    // Enhanced fallback suggestions based on post content analysis
    const fallbackSuggestions = generateFallbackSuggestions(postContent, postContext);
    console.log('🔄 Using enhanced fallback suggestions');
    return fallbackSuggestions;
  }
}

/**
 * Generate smart fallback suggestions based on content analysis
 */
function generateFallbackSuggestions(postContent, postContext = {}) {
  const suggestions = [];
  
  // Analyze post content for better fallback suggestions
  const content = postContent.toLowerCase();
  const isQuestion = content.includes('?') || content.includes('what') || content.includes('how') || content.includes('why');
  const isPersonal = content.includes('my ') || content.includes('i ') || content.includes('personal');
  const isInsight = content.includes('insight') || content.includes('learn') || content.includes('discover');
  const isAchievement = content.includes('excited') || content.includes('proud') || content.includes('accomplish');
  
  if (isQuestion) {
    suggestions.push({
      text: "Great question! In my experience, the key is finding the right balance between strategy and execution.",
      type: 'engaging',
      reasoning: 'Responds to question format with experience-based insight'
    });
  } else if (isAchievement) {
    suggestions.push({
      text: "Congratulations! Your dedication really shows. What advice would you give to others starting this journey?",
      type: 'supportive',
      reasoning: 'Celebrates achievement while encouraging knowledge sharing'
    });
  } else if (isInsight) {
    suggestions.push({
      text: "This aligns with what I've been seeing in the industry. Have you noticed any particular patterns or trends?",
      type: 'professional',
      reasoning: 'Validates insight while seeking deeper discussion'
    });
  } else {
    suggestions.push({
      text: "Thanks for sharing this perspective! It's always valuable to hear different approaches to this topic.",
      type: 'professional',
      reasoning: 'Professional acknowledgment that works for general content'
    });
  }
  
  // Add a second suggestion
  if (postContext.authorName) {
    suggestions.push({
      text: `${postContext.authorName}, this really resonates with me. Would love to hear more about your experience with this.`,
      type: 'engaging',
      reasoning: 'Personal engagement that encourages further conversation'
    });
  } else {
    suggestions.push({
      text: "This is exactly the kind of content I love seeing on LinkedIn. Thanks for taking the time to share!",
      type: 'supportive',
      reasoning: 'Appreciative comment that encourages more content creation'
    });
  }
  
  return suggestions.slice(0, 2); // Return only 2 suggestions
}
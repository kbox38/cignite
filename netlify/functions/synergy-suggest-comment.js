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

  try {
    const { post, viewerProfile } = JSON.parse(event.body || "{}");

    console.log("=== SYNERGY SUGGEST COMMENT (5 COMMENTS) ===");
    console.log("Post URN:", post?.urn);
    console.log("Post text length:", post?.text?.length || 0);
    console.log("Partner name:", post?.partnerName);

    // Validate required parameters
    if (!post || !post.urn || !post.text) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ 
          error: "Post object with urn and text is required" 
        }),
      };
    }

    // Generate exactly 5 comment suggestions
    console.log("Generating 5 comment suggestions...");
    const suggestions = await generateFiveCommentSuggestions(post, viewerProfile);

    if (!suggestions || suggestions.length !== 5) {
      throw new Error(`Expected 5 suggestions, got ${suggestions?.length || 0}`);
    }

    // Store suggestions in database
    console.log("Storing 5 suggestions in database...");
    const storedSuggestions = await storeFiveSuggestions(post.urn, suggestions);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        suggestions: storedSuggestions,
        postUrn: post.urn,
        count: storedSuggestions.length,
        generatedAt: new Date().toISOString()
      }),
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
        error: "Failed to generate comment suggestions",
        details: error.message
      }),
    };
  }
}

async function generateFiveCommentSuggestions(post, viewerProfile) {
  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    
    if (!OPENAI_API_KEY) {
      console.warn("OpenAI API key not configured, using fallback suggestions");
      return getFallbackSuggestions(post);
    }

    console.log("Calling OpenAI API for 5 comment generation...");

    const systemPrompt = `You are an expert LinkedIn networker who crafts professional comments that build meaningful relationships. Generate exactly 5 distinct comment approaches:

1. INSIGHT/EXPERIENCE: Share a related insight or personal experience
2. THOUGHTFUL QUESTION: Ask a question to continue the conversation  
3. COMPLIMENT + VALUE: Offer a compliment with added perspective
4. INDUSTRY OBSERVATION: Make an industry-specific observation
5. CONNECTION REQUEST: Suggest further connection or collaboration

Requirements:
- Maximum 30 words per comment
- Professional LinkedIn tone
- Avoid generic phrases like "Great post!" or "Thanks for sharing"
- Each comment must be unique and engaging
- Focus on building professional relationships`;

    const userPrompt = `Generate exactly 5 professional LinkedIn comments for this post:

Post Content: "${post.text}"
Partner Name: ${post.partnerName || 'LinkedIn Professional'}
Media Type: ${post.mediaType || 'TEXT'}

Return as a JSON object with this exact structure:
{
  "comments": [
    "comment 1 text here",
    "comment 2 text here", 
    "comment 3 text here",
    "comment 4 text here",
    "comment 5 text here"
  ]
}

Each comment should take a different approach as specified in the system prompt.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 400,
        temperature: 0.7,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`OpenAI API error: ${response.status} - ${errorData}`);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("OpenAI response received successfully");

    // Parse the JSON response with enhanced error handling
    let parsedResponse;
    try {
      const content = data.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No content in OpenAI response");
      }
      
      parsedResponse = JSON.parse(content);
      console.log("Successfully parsed OpenAI JSON response");
    } catch (parseError) {
      console.error("Error parsing OpenAI response:", parseError);
      console.log("Raw OpenAI content:", data.choices[0]?.message?.content);
      return getFallbackSuggestions(post);
    }

    // Extract exactly 5 comments
    let comments = [];
    if (parsedResponse.comments && Array.isArray(parsedResponse.comments)) {
      comments = parsedResponse.comments;
    } else if (parsedResponse.suggestions && Array.isArray(parsedResponse.suggestions)) {
      comments = parsedResponse.suggestions;
    } else if (Array.isArray(parsedResponse)) {
      comments = parsedResponse;
    }

    // Ensure we have exactly 5 comments
    if (comments.length < 5) {
      console.warn(`OpenAI returned ${comments.length} comments, padding to 5`);
      const fallbacks = getFallbackSuggestions(post);
      while (comments.length < 5) {
        comments.push(fallbacks[comments.length] || "Thanks for sharing this valuable insight!");
      }
    }

    // Limit to exactly 5 comments and clean them
    const finalComments = comments.slice(0, 5).map((comment, index) => {
      let cleanComment = '';
      
      // Handle different comment formats
      if (typeof comment === 'string') {
        cleanComment = comment;
      } else if (comment.text) {
        cleanComment = comment.text;
      } else if (comment.comment) {
        cleanComment = comment.comment;
      } else {
        cleanComment = String(comment);
      }
      
      // Clean and validate comment
      cleanComment = cleanComment.trim().replace(/^["']|["']$/g, '');
      
      if (!cleanComment || cleanComment.length < 5) {
        const fallbacks = getFallbackSuggestions(post);
        cleanComment = fallbacks[index] || "Thanks for sharing this valuable insight!";
      }
      
      // Ensure max 30 words
      const words = cleanComment.split(' ');
      if (words.length > 30) {
        cleanComment = words.slice(0, 30).join(' ') + '...';
      }
      
      return cleanComment;
    });

    console.log(`Generated ${finalComments.length} comment suggestions`);
    return finalComments;
  } catch (error) {
    console.error('Error generating comment suggestions:', error);
    return getFallbackSuggestions(post);
  }
}

function getFallbackSuggestions(post) {
  const partnerName = post.partnerName || 'LinkedIn Professional';
  
  return [
    `Great insights here! This aligns perfectly with what I've seen in ${post.mediaType === 'VIDEO' ? 'similar content' : 'my experience'}.`,
    `${partnerName}, what's been your biggest challenge implementing strategies like this?`,
    `Excellent perspective! Your approach to this topic really stands out in our industry.`,
    `This trend is definitely reshaping how we think about professional development. Spot on analysis!`,
    `Would love to connect and discuss this further. Your insights could be valuable for my network too.`
  ];
}

async function storeFiveSuggestions(postUrn, suggestions) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log(`Storing ${suggestions.length} suggestions for post:`, postUrn);

    // Prepare suggestions for database insertion
    const suggestionsToStore = suggestions.map((suggestion, index) => ({
      post_urn: postUrn,
      suggestion: suggestion,
      tone: ['professional', 'questioning', 'supportive', 'analytical', 'collaborative'][index] || 'professional',
      created_at: new Date().toISOString(),
      used: false,
      effectiveness_score: null
    }));

    // Insert suggestions into database
    const { data: storedSuggestions, error } = await supabase
      .from('suggested_comments')
      .insert(suggestionsToStore)
      .select('id, suggestion, tone, created_at');

    if (error) {
      console.error('Error storing suggestions in database:', error);
      throw error;
    }

    console.log(`Successfully stored ${storedSuggestions.length} suggestions`);

    // Format response for frontend
    const formattedSuggestions = storedSuggestions.map((suggestion, index) => ({
      id: suggestion.id,
      text: suggestion.suggestion,
      tone: suggestion.tone,
      approach: ['Insight/Experience', 'Thoughtful Question', 'Compliment + Value', 'Industry Observation', 'Connection Request'][index],
      createdAt: suggestion.created_at
    }));

    return formattedSuggestions;
  } catch (error) {
    console.error('Error in storeFiveSuggestions:', error);
    
    // Return suggestions without database storage if storage fails
    console.warn('Database storage failed, returning suggestions without IDs');
    return suggestions.map((suggestion, index) => ({
      id: `temp-${Date.now()}-${index}`,
      text: suggestion,
      tone: ['professional', 'questioning', 'supportive', 'analytical', 'collaborative'][index] || 'professional',
      approach: ['Insight/Experience', 'Thoughtful Question', 'Compliment + Value', 'Industry Observation', 'Connection Request'][index],
      createdAt: new Date().toISOString()
    }));
  }
}
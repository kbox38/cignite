export async function handler(event, context) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
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
    const { postUrn, postContent } = JSON.parse(event.body || "{}");

    console.log("=== SYNERGY SUGGEST COMMENT ===");
    console.log("Post URN:", postUrn);
    console.log("Post content length:", postContent?.length || 0);

    // Validate required parameters
    if (!postUrn || !postContent) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ 
          error: "postUrn and postContent are required" 
        }),
      };
    }

    // Generate 3 comment suggestions using OpenAI
    console.log("Generating comment suggestions...");
    const suggestions = await generateCommentSuggestions(postContent);

    // Store suggestions in database
    console.log("Storing suggestions in database...");
    const storedSuggestions = await storeSuggestions(postUrn, suggestions);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        suggestions: storedSuggestions,
        postUrn,
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

async function generateCommentSuggestions(postContent) {
  try {
    console.log("Calling OpenAI API for comment generation...");

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are an expert LinkedIn networker who crafts comments that build professional relationships and establish thought leadership. Your comments should:
            - Demonstrate subject matter expertise relevant to the post
            - Create opportunities for deeper connection and conversation  
            - Show genuine curiosity and interest in the poster's perspective
            - Be memorable and distinctive from typical LinkedIn comments
            - Add a unique angle or complementary insight to the discussion
            - Position the commenter as a valuable professional connection
            - Always maintain professionalism while being personable.`
          },
          {
            role: 'user',
            content: `Based on the post content below, generate exactly 3 professional LinkedIn comments. Each comment should take a different approach:

            Comment 1: Share a related insight or experience
            Comment 2: Ask a thoughtful question to continue the conversation  
            Comment 3: Offer a compliment with added value or perspective

            Requirements:
            - Maximum 25 words per comment
            - Sound natural and conversational
            - Be specific to the post content, not generic
            - Avoid overused LinkedIn phrases
            - Each comment should feel authentic and engaging

            Return as JSON: {"comments": ["comment1", "comment2", "comment3"]} - You will customize this prompt later.

            Post Content: "${postContent}"

            Generate exactly 3 professional, relevant comments for this LinkedIn post. Return as JSON array.`
          }
        ],
        max_tokens: 500,
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

    // Parse the JSON response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(data.choices[0].message.content);
    } catch (parseError) {
      console.error("Error parsing OpenAI response:", parseError);
      // Fallback to default suggestions if parsing fails
      return [
        "Great insights! This really resonates with my experience.",
        "Thanks for sharing this perspective. Looking forward to hearing more about your thoughts on this topic.",
        "Excellent point! I'd love to connect and discuss this further."
      ];
    }

    // Extract comments from the response (handle different possible response formats)
    let comments = [];
    if (parsedResponse.comments && Array.isArray(parsedResponse.comments)) {
      comments = parsedResponse.comments;
    } else if (parsedResponse.suggestions && Array.isArray(parsedResponse.suggestions)) {
      comments = parsedResponse.suggestions;
    } else if (Array.isArray(parsedResponse)) {
      comments = parsedResponse;
    }

    // Ensure we have exactly 3 comments
    if (comments.length < 3) {
      console.warn("OpenAI returned fewer than 3 comments, adding fallbacks");
      const fallbacks = [
        "Great insights! This really resonates with my experience.",
        "Thanks for sharing this perspective. Very thought-provoking!",
        "Excellent point! I'd love to hear more about your thoughts on this."
      ];
      
      while (comments.length < 3) {
        comments.push(fallbacks[comments.length] || "Thanks for sharing this!");
      }
    }

    // Limit to exactly 3 comments
    const finalComments = comments.slice(0, 3).map(comment => {
      // Handle both string format and object format
      if (typeof comment === 'string') {
        return comment;
      } else if (comment.text) {
        return comment.text;
      } else if (comment.comment) {
        return comment.comment;
      } else {
        return "Thanks for sharing this!";
      }
    });

    console.log(`Generated ${finalComments.length} comment suggestions`);
    return finalComments;
  } catch (error) {
    console.error('Error generating comment suggestions:', error);
    
    // Return fallback suggestions if OpenAI fails
    return [
      "Great insights! This really resonates with my experience.",
      "Thanks for sharing this perspective. Looking forward to hearing more about your thoughts on this topic.",
      "Excellent point! I'd love to connect and discuss this further."
    ];
  }
}

async function storeSuggestions(postUrn, suggestions) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log(`Storing ${suggestions.length} suggestions for post:`, postUrn);

    // Prepare suggestions for database insertion
    const suggestionsToStore = suggestions.map(suggestion => ({
      post_urn: postUrn,
      suggestion: suggestion,
      created_at: new Date().toISOString(),
      used: false,
      effectiveness_score: null
    }));

    // Insert suggestions into database
    const { data: storedSuggestions, error } = await supabase
      .from('suggested_comments')
      .insert(suggestionsToStore)
      .select('id, suggestion, created_at');

    if (error) {
      console.error('Error storing suggestions in database:', error);
      throw error;
    }

    console.log(`Successfully stored ${storedSuggestions.length} suggestions`);

    // Format response for frontend
    const formattedSuggestions = storedSuggestions.map(suggestion => ({
      id: suggestion.id,
      text: suggestion.suggestion,
      createdAt: suggestion.created_at
    }));

    return formattedSuggestions;
  } catch (error) {
    console.error('Error in storeSuggestions:', error);
    
    // Return suggestions without database storage if storage fails
    console.warn('Database storage failed, returning suggestions without IDs');
    return suggestions.map((suggestion, index) => ({
      id: `temp-${Date.now()}-${index}`,
      text: suggestion,
      createdAt: new Date().toISOString()
    }));
  }
}
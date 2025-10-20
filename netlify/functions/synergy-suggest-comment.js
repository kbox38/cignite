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

    console.log("=== SYNERGY SUGGEST COMMENT (EXACTLY 5 COMMENTS) ===");
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
    console.log("Generating exactly 5 comment suggestions...");
    const suggestions = await generateExactlyFiveComments(post, viewerProfile);

    if (!suggestions || suggestions.length !== 5) {
      console.error(`Expected 5 suggestions, got ${suggestions?.length || 0}`);
      // Use fallback if generation failed
      const fallbackSuggestions = getFallbackFiveComments(post);
      return returnFiveComments(post.urn, fallbackSuggestions);
    }

    console.log("✅ Generated exactly 5 comment suggestions");
    return returnFiveComments(post.urn, suggestions);

  } catch (error) {
    console.error("Synergy suggest comment error:", error);
    
    // Always return 5 fallback comments on error
    const post = JSON.parse(event.body || "{}").post;
    const fallbackSuggestions = getFallbackFiveComments(post);
    return returnFiveComments(post?.urn || 'unknown', fallbackSuggestions);
  }
}

async function generateExactlyFiveComments(post, viewerProfile) {
  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    
    if (!OPENAI_API_KEY) {
      console.warn("OpenAI API key not configured, using fallback suggestions");
      return getFallbackFiveComments(post);
    }

    console.log("Calling OpenAI API for exactly 5 comment generation...");

    const systemPrompt = `You are an expert LinkedIn networker who crafts professional comments that build meaningful relationships. Generate exactly 5 distinct comment approaches for LinkedIn posts.

CRITICAL REQUIREMENTS:
- Generate EXACTLY 5 comments, no more, no less
- Each comment must be unique and take a different approach
- Maximum 30 words per comment
- Professional LinkedIn tone
- Avoid generic phrases like "Great post!" or "Thanks for sharing"
- Focus on building professional relationships

THE 5 REQUIRED APPROACHES:
1. INSIGHT/EXPERIENCE: Share a related insight or personal experience
2. THOUGHTFUL QUESTION: Ask a question to continue the conversation  
3. COMPLIMENT + VALUE: Offer a compliment with added perspective
4. INDUSTRY OBSERVATION: Make an industry-specific observation
5. CONNECTION REQUEST: Suggest further connection or collaboration

Return ONLY a JSON object with this EXACT structure:
{
  "comments": [
    {
      "text": "comment 1 text here",
      "approach": "Insight/Experience",
      "tone": "professional"
    },
    {
      "text": "comment 2 text here", 
      "approach": "Thoughtful Question",
      "tone": "questioning"
    },
    {
      "text": "comment 3 text here",
      "approach": "Compliment + Value", 
      "tone": "supportive"
    },
    {
      "text": "comment 4 text here",
      "approach": "Industry Observation",
      "tone": "analytical"
    },
    {
      "text": "comment 5 text here",
      "approach": "Connection Request",
      "tone": "collaborative"
    }
  ]
}`;

    const userPrompt = `Generate exactly 5 professional LinkedIn comments for this post:

Post Content: "${post.text}"
Partner Name: ${post.partnerName || 'LinkedIn Professional'}
Media Type: ${post.mediaType || 'TEXT'}

Each comment must take one of the 5 required approaches specified in the system prompt. Keep each comment under 30 words and make them engaging and professional.`;

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
      return getFallbackFiveComments(post);
    }

    // Extract exactly 5 comments
    let comments = [];
    if (parsedResponse.comments && Array.isArray(parsedResponse.comments)) {
      comments = parsedResponse.comments;
    } else if (Array.isArray(parsedResponse)) {
      comments = parsedResponse;
    }

    // Ensure we have exactly 5 comments
    if (comments.length < 5) {
      console.warn(`OpenAI returned ${comments.length} comments, padding to 5`);
      const fallbacks = getFallbackFiveComments(post);
      while (comments.length < 5) {
        const fallbackIndex = comments.length;
        comments.push({
          text: fallbacks[fallbackIndex]?.text || "Thanks for sharing this valuable insight!",
          approach: fallbacks[fallbackIndex]?.approach || "Supportive",
          tone: fallbacks[fallbackIndex]?.tone || "professional"
        });
      }
    }

    // Limit to exactly 5 comments and clean them
    const finalComments = comments.slice(0, 5).map((comment, index) => {
      let cleanComment = '';
      let approach = '';
      let tone = '';
      
      // Handle different comment formats
      if (typeof comment === 'string') {
        cleanComment = comment;
        approach = ['Insight/Experience', 'Thoughtful Question', 'Compliment + Value', 'Industry Observation', 'Connection Request'][index];
        tone = ['professional', 'questioning', 'supportive', 'analytical', 'collaborative'][index];
      } else if (comment.text) {
        cleanComment = comment.text;
        approach = comment.approach || ['Insight/Experience', 'Thoughtful Question', 'Compliment + Value', 'Industry Observation', 'Connection Request'][index];
        tone = comment.tone || ['professional', 'questioning', 'supportive', 'analytical', 'collaborative'][index];
      } else {
        cleanComment = String(comment);
        approach = ['Insight/Experience', 'Thoughtful Question', 'Compliment + Value', 'Industry Observation', 'Connection Request'][index];
        tone = ['professional', 'questioning', 'supportive', 'analytical', 'collaborative'][index];
      }
      
      // Clean and validate comment
      cleanComment = cleanComment.trim().replace(/^["']|["']$/g, '');
      
      if (!cleanComment || cleanComment.length < 5) {
        const fallbacks = getFallbackFiveComments(post);
        cleanComment = fallbacks[index]?.text || "Thanks for sharing this valuable insight!";
      }
      
      // Ensure max 30 words
      const words = cleanComment.split(' ');
      if (words.length > 30) {
        cleanComment = words.slice(0, 30).join(' ') + '...';
      }
      
      return {
        text: cleanComment,
        approach: approach,
        tone: tone
      };
    });

    console.log(`✅ Generated and cleaned ${finalComments.length} comment suggestions`);
    return finalComments;
  } catch (error) {
    console.error('Error generating comment suggestions:', error);
    return getFallbackFiveComments(post);
  }
}

function getFallbackFiveComments(post) {
  const partnerName = post?.partnerName || 'LinkedIn Professional';
  
  return [
    {
      text: `Great insights here! This aligns perfectly with what I've seen in ${post?.mediaType === 'VIDEO' ? 'similar content' : 'my experience'}.`,
      approach: "Insight/Experience",
      tone: "professional"
    },
    {
      text: `${partnerName}, what's been your biggest challenge implementing strategies like this?`,
      approach: "Thoughtful Question", 
      tone: "questioning"
    },
    {
      text: `Excellent perspective! Your approach to this topic really stands out in our industry.`,
      approach: "Compliment + Value",
      tone: "supportive"
    },
    {
      text: `This trend is definitely reshaping how we think about professional development. Spot on analysis!`,
      approach: "Industry Observation",
      tone: "analytical"
    },
    {
      text: `Would love to connect and discuss this further. Your insights could be valuable for my network too.`,
      approach: "Connection Request",
      tone: "collaborative"
    }
  ];
}

function returnFiveComments(postUrn, suggestions) {
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify({
      suggestions: suggestions,
      postUrn: postUrn,
      count: suggestions.length,
      generatedAt: new Date().toISOString()
    }),
  };
}
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
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: "No authorization token" }),
    };
  }

  try {
    // Get user ID from token
    const userId = await getUserIdFromToken(authorization);
    if (!userId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Invalid token or user not found" }),
      };
    }

    // Initialize Supabase
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    if (event.httpMethod === "GET") {
      // Get existing content ideas and strategies from database
      const [contentIdeas, postingStrategies] = await Promise.all([
        supabase
          .from('content_ideas')
          .select('*')
          .eq('user_id', userId)
          .eq('idea_status', 'generated')
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('posting_strategies')
          .select('*')
          .eq('user_id', userId)
          .eq('strategy_status', 'active')
          .order('created_at', { ascending: false })
          .limit(5)
      ]);

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          contentIdeas: contentIdeas.data || [],
          postingStrategies: postingStrategies.data || []
        }),
      };
    }

    if (event.httpMethod === "POST") {
      const { type, industry, userProfile } = JSON.parse(event.body || "{}");

      if (type === 'content_ideas') {
        return await generateAndSaveContentIdeas(supabase, userId, industry, userProfile);
      } else if (type === 'posting_strategy') {
        return await generateAndSavePostingStrategy(supabase, userId, industry, userProfile);
      }

      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid request type" }),
      };
    }

    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  } catch (error) {
    console.error("Creation Engine Data Error:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Failed to process creation engine request",
        details: error.message,
      }),
    };
  }
}

async function getUserIdFromToken(authorization) {
  try {
    const response = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: {
        'Authorization': authorization,
        'LinkedIn-Version': '202312'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to get user info from LinkedIn');
    }

    const userInfo = await response.json();
    const linkedinUrn = `urn:li:person:${userInfo.sub}`;

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('linkedin_member_urn', linkedinUrn)
      .single();

    return user?.id || null;
  } catch (error) {
    console.error('Error getting user ID from token:', error);
    return null;
  }
}

async function generateAndSaveContentIdeas(supabase, userId, industry, userProfile) {
  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    
    if (!OPENAI_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "OpenAI API key not configured" }),
      };
    }

    // Generate content ideas using OpenAI
    const ideas = await generateContentIdeas(industry, userProfile, OPENAI_API_KEY);

    // Parse ideas and save to database
    const ideaLines = ideas.content.split('\n').filter(line => line.trim() && /^\d+\./.test(line.trim()));
    
    const savedIdeas = [];
    for (const ideaLine of ideaLines) {
      const title = ideaLine.replace(/^\d+\.\s*/, '').trim();
      
      const { data: savedIdea, error } = await supabase
        .from('content_ideas')
        .insert({
          user_id: userId,
          title: title,
          description: `Content idea for ${industry} professional`,
          content_type: 'post',
          industry_focus: industry,
          estimated_engagement: Math.floor(Math.random() * 50) + 10,
          ai_confidence_score: 0.8,
          idea_status: 'generated'
        })
        .select()
        .single();

      if (!error && savedIdea) {
        savedIdeas.push(savedIdea);
      }
    }

    // Log activity
    await supabase.rpc('log_user_activity', {
      p_user_id: userId,
      p_activity_type: 'idea_generated',
      p_description: `Generated ${savedIdeas.length} content ideas`,
      p_metadata: { industry, ideas_count: savedIdeas.length }
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        type: 'content_ideas',
        content: ideas.content,
        savedIdeas: savedIdeas,
        timestamp: new Date().toISOString()
      }),
    };
  } catch (error) {
    console.error('Error generating content ideas:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to generate content ideas" }),
    };
  }
}

async function generateAndSavePostingStrategy(supabase, userId, industry, userProfile) {
  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    
    if (!OPENAI_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "OpenAI API key not configured" }),
      };
    }

    // Generate posting strategy using OpenAI
    const strategy = await generatePostingStrategy(industry, userProfile, OPENAI_API_KEY);

    // Save strategy to database
    const { data: savedStrategy, error } = await supabase
      .from('posting_strategies')
      .insert({
        user_id: userId,
        strategy_name: `${industry} Strategy - ${new Date().toLocaleDateString()}`,
        industry_focus: industry,
        strategy_text: strategy.content,
        optimal_schedule: {
          frequency: "3-5 posts per week",
          best_times: ["8-10 AM", "12-2 PM", "5-6 PM"],
          best_days: ["Tuesday", "Wednesday", "Thursday"]
        },
        content_mix: {
          educational: 40,
          personal: 30,
          industry_news: 20,
          behind_scenes: 10
        },
        strategy_status: 'active'
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving strategy:', error);
    }

    // Log activity
    await supabase.rpc('log_user_activity', {
      p_user_id: userId,
      p_activity_type: 'strategy_created',
      p_description: 'Generated posting strategy',
      p_metadata: { industry, strategy_id: savedStrategy?.id }
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        type: 'posting_strategy',
        content: strategy.content,
        savedStrategy: savedStrategy,
        timestamp: new Date().toISOString()
      }),
    };
  } catch (error) {
    console.error('Error generating posting strategy:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to generate posting strategy" }),
    };
  }
}

async function generateContentIdeas(industry, userProfile, openaiKey) {
  const systemPrompt = `You are a LinkedIn content strategist specializing in ${industry}. Generate 5 specific, actionable content ideas that will drive engagement and establish thought leadership.`;

  const userPrompt = `Generate 5 LinkedIn content ideas for a ${industry} professional. Format as:

1. [Content idea title/hook]
2. [Content idea title/hook]
3. [Content idea title/hook]
4. [Content idea title/hook]
5. [Content idea title/hook]

Focus on value-first content that sparks meaningful conversations.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 500,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    type: 'content_ideas',
    content: data.choices[0]?.message?.content || 'Failed to generate content ideas',
    timestamp: new Date().toISOString()
  };
}

async function generatePostingStrategy(industry, userProfile, openaiKey) {
  const systemPrompt = `You are a LinkedIn growth strategist. Create a comprehensive weekly posting strategy.`;

  const userPrompt = `Create a weekly LinkedIn posting strategy for a ${industry} professional.

Include:
### Optimal Posting Schedule
**Best days and times for maximum engagement**

### Content Mix Recommendations  
**Breakdown of content types and topics**

### Engagement Strategy
**Pre-posting and post-posting activities**

### Hashtag Strategy
**Effective hashtags for ${industry}**

Make it specific and actionable for immediate implementation.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 800,
      temperature: 0.4
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    type: 'posting_strategy',
    content: data.choices[0]?.message?.content || 'Failed to generate posting strategy',
    timestamp: new Date().toISOString()
  };
}
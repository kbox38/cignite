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
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const { authorization } = event.headers;
  const { type, industry, userProfile } = JSON.parse(event.body || "{}");

  if (!authorization) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: "No authorization token" }),
    };
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "OpenAI API key not configured" }),
    };
  }

  try {
    let result;

    switch (type) {
      case 'content_ideas':
        result = await generateContentIdeas(industry, userProfile, OPENAI_API_KEY);
        break;
      case 'posting_strategy':
        result = await generatePostingStrategy(industry, userProfile, OPENAI_API_KEY);
        break;
      case 'algorithm_optimization':
        result = await generateAlgorithmOptimization(userProfile, OPENAI_API_KEY);
        break;
      default:
        throw new Error('Invalid request type');
    }

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
    console.error("Creation Engine AI Error:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Failed to generate AI content",
        details: error.message,
      }),
    };
  }
}

async function generateContentIdeas(industry, userProfile, openaiKey) {
  const systemPrompt = `You are a LinkedIn content strategist specializing in ${industry}. Generate 5 specific, actionable content ideas that will drive engagement and establish thought leadership.

  LinkedIn Algorithm Rules to Follow:
  - Prioritize content that generates comments over likes
  - Native content performs better than external links
  - Carousels and mini-articles (150-400 words) perform best
  - First 60 minutes post-publish is critical
  - 3-5 niche hashtags work better than trending ones`;

  const userPrompt = `Generate 5 LinkedIn content ideas for a ${industry} professional with this profile:
  ${JSON.stringify(userProfile)}
  
  For each idea, provide:
  1. Content title/hook
  2. Content format (text, carousel, video, etc.)
  3. Key points to cover
  4. Estimated engagement potential (1-10)
  5. Optimal posting time
  6. Relevant hashtags (3-5)
  
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
      max_tokens: 800,
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
  const systemPrompt = `You are a LinkedIn growth strategist. Create a comprehensive weekly posting strategy that aligns with LinkedIn's algorithm preferences.

  Algorithm Optimization Rules:
  - 3-5 posts per week is optimal
  - Avoid posting multiple times per day
  - Engage with others' content 15-30 minutes before posting
  - Reply to comments within 15 minutes for maximum reach
  - Tuesday-Thursday, 8-10 AM or 12-2 PM are best times
  - Avoid weekends unless targeting global/startup audiences`;

  const userPrompt = `Create a weekly LinkedIn posting strategy for a ${industry} professional:
  ${JSON.stringify(userProfile)}
  
  Include:
  1. Optimal posting schedule (days and times)
  2. Content mix recommendations (formats and topics)
  3. Engagement strategy (pre-posting and post-posting activities)
  4. Hashtag strategy for ${industry}
  5. Content calendar template
  6. Performance tracking metrics
  
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
      max_tokens: 1000,
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

async function generateAlgorithmOptimization(userProfile, openaiKey) {
  const systemPrompt = `You are a LinkedIn algorithm expert. Analyze user behavior and provide specific optimization recommendations.

  LinkedIn Algorithm Factors:
  - Dwell time is the most important ranking factor
  - Comments > Reactions > Shares > Likes in algorithm weight
  - Native content (no external links) is prioritized
  - Engagement in first 60 minutes determines reach
  - Consistent posting schedule builds algorithm trust
  - Author engagement with comments boosts post performance`;

  const userPrompt = `Analyze this LinkedIn user profile and provide algorithm optimization recommendations:
  ${JSON.stringify(userProfile)}
  
  Provide specific advice on:
  1. Content optimization for maximum dwell time
  2. Engagement tactics to trigger algorithm boost
  3. Posting timing and frequency optimization
  4. Content format recommendations
  5. Hashtag and tagging strategy
  6. Common algorithm penalties to avoid
  
  Focus on actionable tactics they can implement immediately.`;

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
      max_tokens: 1000,
      temperature: 0.3
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    type: 'algorithm_optimization',
    content: data.choices[0]?.message?.content || 'Failed to generate algorithm optimization',
    timestamp: new Date().toISOString()
  };
}
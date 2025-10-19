// Synergy Posts API for Frontend Access
// File: netlify/functions/synergy-posts-enhanced.mjs

export const handler = async (event, context) => {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
        body: '',
      };
    }
  
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
  
      const url = new URL(event.rawUrl);
      const action = url.searchParams.get('action') || 'get-partner-posts';
      const userId = url.searchParams.get('userId');
      const partnerId = url.searchParams.get('partnerId');
  
      if (!userId) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ error: 'userId is required' }),
        };
      }
  
      switch (action) {
        case 'get-partner-posts':
          return await getPartnerPosts(userId, partnerId, supabase);
        
        case 'get-my-posts':
          return await getMyLatestPosts(userId, supabase);
        
        case 'get-suggested-comments':
          return await getSuggestedComments(userId, partnerId, supabase);
        
        case 'use-comment':
          return await useCommentSuggestion(event.body, supabase);
        
        case 'refresh-posts':
          return await triggerPostRefresh(userId, supabase);
        
        case 'get-all-synergy-data':
          return await getAllSynergyData(userId, supabase);
  
        default:
          return {
            statusCode: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ error: 'Invalid action' }),
          };
      }
  
    } catch (error) {
      console.error('Synergy posts API error:', error);
      
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Internal server error',
          details: error.message
        }),
      };
    }
  };
  
  // Get partner's latest 5 posts with suggested comments
  async function getPartnerPosts(userId, partnerId, supabase) {
    try {
      if (!partnerId) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ error: 'partnerId is required for partner posts' }),
        };
      }
  
      // Verify synergy partnership exists
      const { data: partnership } = await supabase
        .from('synergy_partners')
        .select('id, partnership_status')
        .or(`and(a_user_id.eq.${userId},b_user_id.eq.${partnerId}),and(b_user_id.eq.${userId},a_user_id.eq.${partnerId})`)
        .eq('partnership_status', 'active')
        .single();
  
      if (!partnership) {
        return {
          statusCode: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ error: 'No active synergy partnership found' }),
        };
      }
  
      // Get partner's latest 5 posts
      const { data: posts, error: postsError } = await supabase
        .from('post_cache')
        .select(`
          id,
          post_urn,
          text_preview,
          media_type,
          media_asset_urn,
          permalink,
          created_at_ms,
          fetched_at
        `)
        .eq('user_id', partnerId)
        .eq('is_latest_five', true)
        .order('created_at_ms', { ascending: false })
        .limit(5);
  
      if (postsError) {
        throw new Error(`Failed to fetch partner posts: ${postsError.message}`);
      }
  
      // Get suggested comments for these posts
      const { data: suggestions, error: suggestionsError } = await supabase
        .from('suggested_comments')
        .select('post_urn, suggested_comment, comment_tone, is_used, created_at')
        .eq('from_user_id', userId)
        .eq('to_user_id', partnerId)
        .in('post_urn', posts.map(p => p.post_urn));
  
      if (suggestionsError) {
        console.error('Error fetching suggestions:', suggestionsError);
      }
  
      // Get partner info
      const { data: partnerInfo } = await supabase
        .from('users')
        .select('name, avatar_url, headline')
        .eq('id', partnerId)
        .single();
  
      // Combine posts with their suggestions
      const postsWithSuggestions = posts.map(post => {
        const suggestion = suggestions?.find(s => s.post_urn === post.post_urn);
        return {
          ...post,
          suggestedComment: suggestion ? {
            text: suggestion.suggested_comment,
            tone: suggestion.comment_tone,
            isUsed: suggestion.is_used,
            createdAt: suggestion.created_at
          } : null
        };
      });
  
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: true,
          posts: postsWithSuggestions,
          partner: partnerInfo,
          partnership: partnership,
          totalPosts: posts.length
        }),
      };
  
    } catch (error) {
      console.error('Error getting partner posts:', error);
      throw error;
    }
  }
  
  // Get user's own latest 5 posts
  async function getMyLatestPosts(userId, supabase) {
    try {
      const { data: posts, error } = await supabase
        .from('post_cache')
        .select(`
          id,
          post_urn,
          text_preview,
          media_type,
          media_asset_urn,
          permalink,
          created_at_ms,
          fetched_at
        `)
        .eq('user_id', userId)
        .eq('is_latest_five', true)
        .order('created_at_ms', { ascending: false })
        .limit(5);
  
      if (error) {
        throw new Error(`Failed to fetch user posts: ${error.message}`);
      }
  
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: true,
          posts: posts || [],
          totalPosts: posts?.length || 0,
          lastFetch: posts?.[0]?.fetched_at || null
        }),
      };
  
    } catch (error) {
      console.error('Error getting user posts:', error);
      throw error;
    }
  }
  
  // Get suggested comments for a specific partner
  async function getSuggestedComments(userId, partnerId, supabase) {
    try {
      if (!partnerId) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ error: 'partnerId is required' }),
        };
      }
  
      const { data: suggestions, error } = await supabase
        .from('suggested_comments_with_context')
        .select('*')
        .eq('from_user_id', userId)
        .eq('to_user_id', partnerId)
        .order('created_at', { ascending: false });
  
      if (error) {
        throw new Error(`Failed to fetch suggestions: ${error.message}`);
      }
  
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: true,
          suggestions: suggestions || [],
          totalSuggestions: suggestions?.length || 0
        }),
      };
  
    } catch (error) {
      console.error('Error getting suggested comments:', error);
      throw error;
    }
  }
  
  // Mark a comment suggestion as used
  async function useCommentSuggestion(requestBody, supabase) {
    try {
      const { suggestionId, effectivenessScore } = JSON.parse(requestBody || '{}');
  
      if (!suggestionId) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ error: 'suggestionId is required' }),
        };
      }
  
      const updateData = {
        is_used: true,
        used_at: new Date().toISOString()
      };
  
      if (effectivenessScore && effectivenessScore >= 1 && effectivenessScore <= 10) {
        updateData.effectiveness_score = effectivenessScore;
      }
  
      const { error } = await supabase
        .from('suggested_comments')
        .update(updateData)
        .eq('id', suggestionId);
  
      if (error) {
        throw new Error(`Failed to update suggestion: ${error.message}`);
      }
  
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: true,
          message: 'Comment suggestion marked as used'
        }),
      };
  
    } catch (error) {
      console.error('Error using comment suggestion:', error);
      throw error;
    }
  }
  
  // Trigger manual post refresh
  async function triggerPostRefresh(userId, supabase) {
    try {
      // Call the login refresh function
      const refreshResponse = await fetch(`${process.env.URL}/.netlify/functions/login-post-refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId,
          forceRefresh: true
        }),
      });
  
      const refreshResult = await refreshResponse.json();
  
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: true,
          refreshResult
        }),
      };
  
    } catch (error) {
      console.error('Error triggering post refresh:', error);
      throw error;
    }
  }
  
  // Get all synergy data for a user (posts + partnerships + suggestions)
  async function getAllSynergyData(userId, supabase) {
    try {
      // Get active partnerships
      const { data: partnerships } = await supabase
        .from('active_partnerships_detailed')
        .select('*')
        .or(`a_user_id.eq.${userId},b_user_id.eq.${userId}`);
  
      // Get user's own latest posts
      const { data: myPosts } = await supabase
        .from('post_cache')
        .select('*')
        .eq('user_id', userId)
        .eq('is_latest_five', true)
        .order('created_at_ms', { ascending: false });
  
      // Get all partner posts that user can access
      const { data: partnerPosts } = await supabase
        .from('synergy_partner_posts')
        .select('*')
        .eq('viewer_user_id', userId)
        .order('created_at_ms', { ascending: false });
  
      // Get suggested comments (both given and received)
      const { data: suggestionsGiven } = await supabase
        .from('suggested_comments_with_context')
        .select('*')
        .eq('from_user_id', userId)
        .order('created_at', { ascending: false });
  
      const { data: suggestionsReceived } = await supabase
        .from('suggested_comments_with_context')
        .select('*')
        .eq('to_user_id', userId)
        .order('created_at', { ascending: false });
  
      // Get last sync info
      const { data: userInfo } = await supabase
        .from('users')
        .select('last_posts_sync, name, avatar_url')
        .eq('id', userId)
        .single();
  
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: true,
          data: {
            user: userInfo,
            partnerships: partnerships || [],
            myPosts: myPosts || [],
            partnerPosts: partnerPosts || [],
            suggestionsGiven: suggestionsGiven || [],
            suggestionsReceived: suggestionsReceived || [],
            stats: {
              activePartnerships: partnerships?.length || 0,
              myPostsCount: myPosts?.length || 0,
              partnerPostsAvailable: partnerPosts?.length || 0,
              suggestionsGivenCount: suggestionsGiven?.length || 0,
              suggestionsReceivedCount: suggestionsReceived?.length || 0,
              lastSync: userInfo?.last_posts_sync
            }
          }
        }),
      };
  
    } catch (error) {
      console.error('Error getting all synergy data:', error);
      throw error;
    }
  }
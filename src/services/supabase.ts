import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types
export interface User {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  linkedin_member_urn?: string;
  dma_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SynergyPartner {
  id: string;
  a_user_id: string;
  b_user_id: string;
  created_at: string;
  a_user?: User;
  b_user?: User;
}

export interface PostCache {
  id: string;
  owner_user_id: string;
  post_urn: string;
  created_at_ms: number;
  text_preview?: string;
  media_type?: string;
  media_asset_urn?: string;
  permalink?: string;
  raw?: any;
  fetched_at: string;
}

export interface CommentCache {
  id: string;
  author_user_id: string;
  object_urn: string;
  message?: string;
  created_at_ms: number;
  raw?: any;
  fetched_at: string;
}

export interface SuggestedComment {
  id: string;
  from_user_id: string;
  to_user_id: string;
  post_urn: string;
  suggestion: string;
  created_at: string;
}

// Supabase service functions
export const supabaseService = {
  // User management
  async getUser(id: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      console.error('Error fetching user:', error);
      return null;
    }
    
    return data;
  },

  async getUserByEmail(email: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    
    if (error) {
      console.error('Error fetching user by email:', error);
      return null;
    }
    
    return data;
  },

  async createUser(user: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .insert(user)
      .select()
      .single();
    
    if (error) {
      console.error('Error creating user:', error);
      return null;
    }
    
    return data;
  },

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating user:', error);
      return null;
    }
    
    return data;
  },

  // Synergy partner management
  async getPartners(userId: string): Promise<User[]> {
    const { data, error } = await supabase
      .from('synergy_partners')
      .select(`
        *,
        a_user:users!synergy_partners_a_user_id_fkey(*),
        b_user:users!synergy_partners_b_user_id_fkey(*)
      `)
      .or(`a_user_id.eq.${userId},b_user_id.eq.${userId}`);
    
    if (error) {
      console.error('Error fetching partners:', error);
      return [];
    }
    
    // Return the partner users (not the current user)
    return data.map(partnership => 
      partnership.a_user_id === userId ? partnership.b_user : partnership.a_user
    ).filter(Boolean);
  },

  async addPartner(userId: string, partnerId: string): Promise<SynergyPartner | null> {
    // Ensure consistent ordering (smaller ID first)
    const [aUserId, bUserId] = [userId, partnerId].sort();
    
    const { data, error } = await supabase
      .from('synergy_partners')
      .insert({
        a_user_id: aUserId,
        b_user_id: bUserId
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error adding partner:', error);
      return null;
    }
    
    return data;
  },

  async removePartner(userId: string, partnerId: string): Promise<boolean> {
    const { error } = await supabase
      .from('synergy_partners')
      .delete()
      .or(`and(a_user_id.eq.${userId},b_user_id.eq.${partnerId}),and(a_user_id.eq.${partnerId},b_user_id.eq.${userId})`);
    
    if (error) {
      console.error('Error removing partner:', error);
      return false;
    }
    
    return true;
  },

  // Post cache management
  async getCachedPosts(ownerUserId: string, limit: number = 5): Promise<PostCache[]> {
    const { data, error } = await supabase
      .from('post_cache')
      .select('*')
      .eq('owner_user_id', ownerUserId)
      .order('created_at_ms', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Error fetching cached posts:', error);
      return [];
    }
    
    return data;
  },

  async cachePost(post: Omit<PostCache, 'id' | 'fetched_at'>): Promise<PostCache | null> {
    const { data, error } = await supabase
      .from('post_cache')
      .upsert(post, { onConflict: 'owner_user_id,post_urn' })
      .select()
      .single();
    
    if (error) {
      console.error('Error caching post:', error);
      return null;
    }
    
    return data;
  },

  async clearStalePostCache(ttlMinutes: number = 15): Promise<void> {
    const cutoffTime = new Date(Date.now() - ttlMinutes * 60 * 1000).toISOString();
    
    const { error } = await supabase
      .from('post_cache')
      .delete()
      .lt('fetched_at', cutoffTime);
    
    if (error) {
      console.error('Error clearing stale post cache:', error);
    }
  },

  // Comment cache management
  async getCachedComment(authorUserId: string, objectUrn: string): Promise<CommentCache | null> {
    const { data, error } = await supabase
      .from('comment_cache')
      .select('*')
      .eq('author_user_id', authorUserId)
      .eq('object_urn', objectUrn)
      .order('created_at_ms', { ascending: false })
      .limit(1)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      console.error('Error fetching cached comment:', error);
      return null;
    }
    
    return data;
  },

  async cacheComment(comment: Omit<CommentCache, 'id' | 'fetched_at'>): Promise<CommentCache | null> {
    const { data, error } = await supabase
      .from('comment_cache')
      .insert(comment)
      .select()
      .single();
    
    if (error) {
      console.error('Error caching comment:', error);
      return null;
    }
    
    return data;
  },

  // Suggested comments
  async saveSuggestedComment(suggestion: Omit<SuggestedComment, 'id' | 'created_at'>): Promise<SuggestedComment | null> {
    const { data, error } = await supabase
      .from('suggested_comments')
      .insert(suggestion)
      .select()
      .single();
    
    if (error) {
      console.error('Error saving suggested comment:', error);
      return null;
    }
    
    return data;
  },

  async getSuggestedComments(fromUserId: string, toUserId: string, postUrn: string): Promise<SuggestedComment[]> {
    const { data, error } = await supabase
      .from('suggested_comments')
      .select('*')
      .eq('from_user_id', fromUserId)
      .eq('to_user_id', toUserId)
      .eq('post_urn', postUrn)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching suggested comments:', error);
      return [];
    }
    
    return data;
  }
};
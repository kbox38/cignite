// netlify/functions/migrate-dma-urns.js - Fix null DMA URNs
export async function handler(event, context) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders };
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('=== MIGRATING NULL DMA URNS ===');

    // Find users with null DMA URNs but have LinkedIn URNs
    const { data: usersToUpdate, error: fetchError } = await supabase
      .from('users')
      .select('id, name, email, linkedin_member_urn, linkedin_dma_member_urn')
      .is('linkedin_dma_member_urn', null)
      .not('linkedin_member_urn', 'is', null);

    if (fetchError) {
      console.error('Error fetching users:', fetchError);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Failed to fetch users' })
      };
    }

    console.log(`Found ${usersToUpdate?.length || 0} users with null DMA URNs`);

    if (!usersToUpdate || usersToUpdate.length === 0) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          message: 'No users need DMA URN updates',
          updated: 0 
        })
      };
    }

    let updated = 0;
    const errors = [];

    // Update each user individually for better error handling
    for (const user of usersToUpdate) {
      try {
        console.log(`Updating user: ${user.name} (${user.email})`);
        
        const { error: updateError } = await supabase
          .from('users')
          .update({
            linkedin_dma_member_urn: user.linkedin_member_urn, // Copy from linkedin_member_urn
            dma_active: false, // Will be true after they complete DMA consent
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);

        if (updateError) {
          console.error(`Error updating user ${user.id}:`, updateError);
          errors.push(`User ${user.name}: ${updateError.message}`);
        } else {
          updated++;
          console.log(`✅ Updated ${user.name}`);
        }
      } catch (error) {
        console.error(`Exception updating user ${user.id}:`, error);
        errors.push(`User ${user.name}: ${error.message}`);
      }
    }

    console.log('=== MIGRATION COMPLETE ===');
    console.log(`Successfully updated: ${updated} users`);
    console.log(`Errors: ${errors.length}`);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: 'DMA URN migration completed',
        totalFound: usersToUpdate.length,
        updated: updated,
        errors: errors,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Migration error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      })
    };
  }
}
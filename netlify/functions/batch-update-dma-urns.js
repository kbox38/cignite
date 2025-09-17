// netlify/functions/batch-update-dma-urns.js
// Function to fix all existing users with null DMA URNs
export async function handler(event, context) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders
    };
  }

  // Add security check - only allow this function to run with admin key
  const { authorization } = event.headers;
  const adminKey = process.env.ADMIN_SECRET_KEY; // Set this in Netlify env vars

  if (!adminKey || authorization !== `Bearer ${adminKey}`) {
    return {
      statusCode: 403,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Unauthorized - Admin access required' })
    };
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('=== BATCH DMA URN UPDATE STARTING ===');

    // Find all users with null DMA URNs but have LinkedIn URNs
    const { data: usersToUpdate, error: fetchError } = await supabase
      .from('users')
      .select('id, linkedin_member_urn, linkedin_dma_member_urn, name, email')
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

    // Update users in batches
    const batchSize = 100;
    let totalUpdated = 0;
    const errors = [];

    for (let i = 0; i < usersToUpdate.length; i += batchSize) {
      const batch = usersToUpdate.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}, users ${i + 1} to ${Math.min(i + batchSize, usersToUpdate.length)}`);

      // Prepare batch update data
      const updates = batch.map(user => ({
        id: user.id,
        linkedin_dma_member_urn: user.linkedin_member_urn, // Copy from linkedin_member_urn
        dma_active: false, // Set to false initially, will be true after DMA consent
        updated_at: new Date().toISOString()
      }));

      // Perform batch update using upsert
      const { data: updatedUsers, error: updateError } = await supabase
        .from('users')
        .upsert(updates, { 
          onConflict: 'id',
          ignoreDuplicates: false 
        })
        .select('id, name, linkedin_dma_member_urn');

      if (updateError) {
        console.error(`Batch update error:`, updateError);
        errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${updateError.message}`);
        continue;
      }

      totalUpdated += updatedUsers?.length || 0;
      console.log(`✅ Updated ${updatedUsers?.length || 0} users in this batch`);
      
      // Log a few examples
      if (updatedUsers && updatedUsers.length > 0) {
        console.log('Sample updates:', updatedUsers.slice(0, 3).map(u => ({
          name: u.name,
          dma_urn: u.linkedin_dma_member_urn
        })));
      }
    }

    console.log('=== BATCH UPDATE COMPLETE ===');
    console.log(`Total users updated: ${totalUpdated}`);
    console.log(`Errors: ${errors.length}`);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: 'Batch DMA URN update completed',
        totalUsers: usersToUpdate.length,
        updated: totalUpdated,
        errors: errors,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Batch update error:', error);
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

// Helper function to validate DMA URNs
function isValidLinkedInUrn(urn) {
  return urn && typeof urn === 'string' && urn.startsWith('urn:li:person:') && urn.length > 20;
}
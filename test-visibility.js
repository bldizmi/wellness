// Test visibility service for user 19P5bEUNgIR3QkMojcvU6Q9xTqV2 (Eli)
import { db } from './server/db.js';
import { items, community_members } from './shared/schema.js';
import { eq, or, and, inArray, sql } from 'drizzle-orm';

async function testVisibility() {
  const userId = '19P5bEUNgIR3QkMojcvU6Q9xTqV2'; // Eli's Firebase UID
  
  console.log('Testing visibility for user:', userId);
  
  // Get user's community IDs
  const memberships = await db
    .select({ community_id: community_members.community_id })
    .from(community_members)
    .where(eq(community_members.user_id, userId));
  
  const userCommunityIds = memberships.map(m => m.community_id);
  console.log('User communities:', userCommunityIds);
  
  // Build visibility filter
  const visibilityCondition = or(
    eq(items.assigned_to, userId),
    eq(items.created_by, userId),
    sql`${items.shared_with} ? ${userId}`
  );

  const communityCondition = userCommunityIds.length > 0 
    ? or(
        sql`${items.community_id} IS NULL`,
        inArray(items.community_id, userCommunityIds)
      )
    : sql`${items.community_id} IS NULL`;

  const visibilityFilter = and(visibilityCondition, communityCondition);
  
  // Get visible items
  const visibleItems = await db
    .select()
    .from(items)
    .where(visibilityFilter);
  
  console.log('Total visible items:', visibleItems.length);
  
  // Look specifically for item 1076A
  const item1076A = visibleItems.find(item => item.display_id === '#1076A');
  console.log('Item 1076A found:', !!item1076A);
  
  if (item1076A) {
    console.log('Item 1076A details:', {
      id: item1076A.id,
      title: item1076A.title,
      created_by: item1076A.created_by,
      assigned_to: item1076A.assigned_to,
      shared_with: item1076A.shared_with,
      community_id: item1076A.community_id
    });
  } else {
    // Check if item exists in database at all
    const rawItem = await db
      .select()
      .from(items)
      .where(eq(items.display_id, '#1076A'));
    
    console.log('Raw item 1076A exists:', rawItem.length > 0);
    if (rawItem.length > 0) {
      console.log('Raw item details:', {
        id: rawItem[0].id,
        title: rawItem[0].title,
        created_by: rawItem[0].created_by,
        assigned_to: rawItem[0].assigned_to,
        shared_with: rawItem[0].shared_with,
        community_id: rawItem[0].community_id
      });
    }
  }
  
  process.exit(0);
}

testVisibility().catch(console.error);

/**
 * Test Production Item Creation
 * Simulates the exact request from the create item modal that caused the 500 error
 */

async function testItemCreation() {
  console.log('🧪 Testing item creation that caused 500 error in production...');
  
  try {
    const testItem = {
      title: "Fill pill organizer for the week",
      item_type: "task",
      recurrence_type: "weekly",
      by_day: ["sunday"], // This is what the user selected in the modal
      verify_required: false,
      due_date: new Date().toISOString().split('T')[0], // Today's date
      time_frame: 30, // 30 minutes
      why_it_matters: "",
      shared_with: [], // Empty array for no sharing
      assigned_to: null // Will be set to creator by default
    };

    console.log('📝 Test item data:', JSON.stringify(testItem, null, 2));

    const response = await fetch('http://localhost:5000/api/item', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-firebase-token'
      },
      body: JSON.stringify(testItem)
    });

    const result = await response.text();
    console.log(`📊 Response status: ${response.status}`);
    console.log(`📊 Response body: ${result}`);

    if (response.status === 500) {
      console.error('❌ ERROR: Got 500 error - this is the issue we need to fix');
    } else if (response.status === 201) {
      console.log('✅ SUCCESS: Item created successfully');
    } else {
      console.log(`ℹ️  Got status ${response.status} - checking response...`);
    }

  } catch (error) {
    console.error('❌ Error during test:', error.message);
  }
}

testItemCreation();
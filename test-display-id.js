/**
 * Test Display ID Generation
 */

import { generateNextDisplayId } from './server/utils/displayId.ts';

async function testDisplayId() {
  console.log('Testing display ID generation...');
  try {
    const newId = await generateNextDisplayId();
    console.log('Generated display ID:', newId);
  } catch (error) {
    console.error('Error generating display ID:', error.message);
    console.error('Stack:', error.stack);
  }
}

testDisplayId().then(() => process.exit(0));
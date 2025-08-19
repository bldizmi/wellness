#!/usr/bin/env node

/**
 * Script to create the first admin user or promote an existing user to admin
 * Run with: node create-admin.js
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function createOrPromoteAdmin() {
  try {
    console.log('Connecting to database...');
    
    // First, let's see if we have any users
    const userCheckQuery = 'SELECT id, username, email, role FROM users LIMIT 10';
    const userResult = await pool.query(userCheckQuery);
    
    console.log('\nCurrent users in database:');
    if (userResult.rows.length === 0) {
      console.log('No users found in database.');
      console.log('\nTo create your first admin user:');
      console.log('1. Go to your app and create a regular account first');
      console.log('2. Then run this script again to promote that user to admin');
      return;
    }
    
    userResult.rows.forEach((user, index) => {
      console.log(`${index + 1}. ID: ${user.id}, Username: ${user.username}, Email: ${user.email}, Role: ${user.role}`);
    });
    
    // Ask user which account to promote
    console.log('\nWhich user would you like to promote to admin?');
    console.log('Enter the user ID, or press Ctrl+C to cancel');
    
    process.stdin.setEncoding('utf8');
    process.stdin.on('readable', async () => {
      const chunk = process.stdin.read();
      if (chunk !== null) {
        const userId = chunk.trim();
        
        if (userId) {
          try {
            // Update user role to admin
            const updateQuery = 'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, username, email, role';
            const updateResult = await pool.query(updateQuery, ['admin', userId]);
            
            if (updateResult.rows.length > 0) {
              const updatedUser = updateResult.rows[0];
              console.log(`\n✅ Successfully promoted user to admin:`);
              console.log(`   ID: ${updatedUser.id}`);
              console.log(`   Username: ${updatedUser.username}`);
              console.log(`   Email: ${updatedUser.email}`);
              console.log(`   Role: ${updatedUser.role}`);
              console.log(`\nYou can now log in and access the admin panel at /admin/users`);
            } else {
              console.log(`❌ User with ID "${userId}" not found`);
            }
          } catch (error) {
            console.error('Error updating user role:', error.message);
          }
        }
        
        await pool.end();
        process.exit(0);
      }
    });
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

createOrPromoteAdmin();
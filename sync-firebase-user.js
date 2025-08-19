#!/usr/bin/env node

/**
 * Script to sync Firebase user to PostgreSQL database
 * Run with: node sync-firebase-user.js
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import { nanoid } from 'nanoid';

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function syncFirebaseUser() {
  try {
    console.log('Connecting to database...');
    
    // Create your admin user record (id will be auto-generated)
    const userData = {
      username: 'admin',
      password: 'temp_password_123', // Required field in schema
      display_name: 'Admin User',
      email: 'adjpurchases@gmail.com',
      role: 'admin',
      status: 'active',
      verified: true
    };
    
    // Insert user into database
    const insertQuery = `
      INSERT INTO users (username, password, display_name, email, role, status, verified)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (email) DO UPDATE SET
        role = EXCLUDED.role,
        status = EXCLUDED.status,
        verified = EXCLUDED.verified
      RETURNING *
    `;
    
    const result = await pool.query(insertQuery, [
      userData.username,
      userData.password,
      userData.display_name,
      userData.email,
      userData.role,
      userData.status,
      userData.verified
    ]);
    
    if (result.rows.length > 0) {
      const user = result.rows[0];
      console.log('\n✅ Successfully created/updated admin user:');
      console.log(`   ID: ${user.id}`);
      console.log(`   Username: ${user.username}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Status: ${user.status}`);
      console.log('\nYou can now log in and access the admin panel at /admin/users');
    }
    
  } catch (error) {
    console.error('Error creating user:', error.message);
    if (error.message.includes('duplicate key')) {
      console.log('\nUser already exists, trying to update role to admin...');
      try {
        const updateQuery = 'UPDATE users SET role = $1 WHERE email = $2 RETURNING *';
        const updateResult = await pool.query(updateQuery, ['admin', 'adjpurchases@gmail.com']);
        
        if (updateResult.rows.length > 0) {
          const user = updateResult.rows[0];
          console.log('\n✅ Successfully updated user to admin:');
          console.log(`   Email: ${user.email}`);
          console.log(`   Role: ${user.role}`);
        }
      } catch (updateError) {
        console.error('Error updating user:', updateError.message);
      }
    }
  } finally {
    await pool.end();
  }
}

syncFirebaseUser();
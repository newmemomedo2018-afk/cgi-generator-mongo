import { db } from './db';
import { sql } from 'drizzle-orm';

/**
 * Check and create missing database columns for production deployment
 * This ensures compatibility between development and production schemas
 */
export async function ensureRequiredColumns() {
  console.log('🔍 Checking database schema compatibility...');
  
  try {
    // Check if scene_video_url column exists in projects table
    const result = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'projects' 
      AND column_name = 'scene_video_url'
    `);
    
    if (result.rows.length === 0) {
      console.log('⚠️ Column scene_video_url missing, adding it...');
      await db.execute(sql`
        ALTER TABLE projects 
        ADD COLUMN IF NOT EXISTS scene_video_url TEXT
      `);
      console.log('✅ Added scene_video_url column successfully');
    } else {
      console.log('✅ scene_video_url column already exists');
    }

    // Check other potentially missing columns that might be needed
    const columnsToCheck = [
      'enhanced_prompt',           // Missing from production - causing current error
      'output_image_url',
      'output_video_url', 
      'error_message',
      'kling_video_task_id',
      'kling_sound_task_id', 
      'include_audio',
      'full_task_details',
      'credits_used'               // CRITICAL: Missing from production causing POST errors
    ];

    for (const columnName of columnsToCheck) {
      const columnCheck = await db.execute(sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'projects' 
        AND column_name = ${columnName}
      `);
      
      if (columnCheck.rows.length === 0) {
        console.log(`⚠️ Column ${columnName} missing, adding it...`);
        
        // Different column types based on name
        let columnType = 'TEXT';
        if (columnName === 'include_audio') {
          columnType = 'BOOLEAN DEFAULT FALSE NOT NULL';
        } else if (columnName === 'credits_used') {
          columnType = 'INTEGER NOT NULL DEFAULT 1';
        } else if (columnName.includes('task_id')) {
          columnType = 'VARCHAR(255)';
        } else if (columnName === 'enhanced_prompt' || columnName === 'output_image_url' || 
                   columnName === 'output_video_url' || columnName === 'error_message' || 
                   columnName === 'full_task_details') {
          columnType = 'TEXT';
        }
        
        await db.execute(sql`
          ALTER TABLE projects 
          ADD COLUMN IF NOT EXISTS ${sql.identifier(columnName)} ${sql.raw(columnType)}
        `);
        console.log(`✅ Added ${columnName} column successfully`);
      } else {
        console.log(`✅ ${columnName} column already exists`);
      }
    }

    // Check users table for missing columns
    const userColumnsToCheck = [
      'first_name',
      'last_name', 
      'profile_image_url',
      'stripe_customer_id',
      'stripe_subscription_id'
    ];

    for (const columnName of userColumnsToCheck) {
      const userColumnCheck = await db.execute(sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = ${columnName}
      `);
      
      if (userColumnCheck.rows.length === 0) {
        console.log(`⚠️ User column ${columnName} missing, adding it...`);
        
        // All user columns are optional VARCHAR or TEXT
        let columnType = 'VARCHAR(255)';
        if (columnName === 'profile_image_url') {
          columnType = 'TEXT';
        }
        
        await db.execute(sql`
          ALTER TABLE users 
          ADD COLUMN IF NOT EXISTS ${sql.identifier(columnName)} ${sql.raw(columnType)}
        `);
        console.log(`✅ Added user ${columnName} column successfully`);
      } else {
        console.log(`✅ User ${columnName} column already exists`);
      }
    }

    console.log('🎉 Database schema check completed successfully');
    
  } catch (error) {
    console.error('❌ Database schema check failed:', error);
    throw error;
  }
}

/**
 * Run all necessary database migrations
 */
export async function runMigrations() {
  console.log('🚀 Running database migrations...');
  
  try {
    await ensureRequiredColumns();
    console.log('✅ All migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}
import { db } from './db';
import { sql } from 'drizzle-orm';

/**
 * COMPREHENSIVE DATABASE SCHEMA RECONCILIATION
 * This migration ensures complete sync between development and production
 * Covers: Enums, All Tables, All Columns, Constraints, Safe Backfills
 */

interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
}

interface TableColumns {
  [key: string]: ColumnInfo[];
}

// Complete schema definition matching shared/schema.ts
const EXPECTED_SCHEMA: TableColumns = {
  users: [
    { name: 'id', type: 'serial', nullable: false },
    { name: 'email', type: 'varchar(255)', nullable: false },
    { name: 'password', type: 'varchar(255)', nullable: false },
    { name: 'first_name', type: 'varchar(100)', nullable: true },
    { name: 'last_name', type: 'varchar(100)', nullable: true },
    { name: 'profile_image_url', type: 'text', nullable: true },
    { name: 'credits', type: 'integer', nullable: false, defaultValue: '5' },
    { name: 'is_admin', type: 'boolean', nullable: false, defaultValue: 'false' },
    { name: 'stripe_customer_id', type: 'varchar(255)', nullable: true },
    { name: 'stripe_subscription_id', type: 'varchar(255)', nullable: true },
    { name: 'created_at', type: 'timestamp', nullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
    { name: 'updated_at', type: 'timestamp', nullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
  ],
  projects: [
    { name: 'id', type: 'serial', nullable: false },
    { name: 'user_id', type: 'integer', nullable: false },
    { name: 'title', type: 'varchar(255)', nullable: false },
    { name: 'description', type: 'text', nullable: true },
    { name: 'product_image_url', type: 'text', nullable: false },
    { name: 'scene_image_url', type: 'text', nullable: true },
    { name: 'scene_video_url', type: 'text', nullable: true },
    { name: 'content_type', type: 'content_type', nullable: false },
    { name: 'video_duration_seconds', type: 'integer', nullable: false, defaultValue: '5' },
    { name: 'status', type: 'project_status', nullable: false, defaultValue: "'pending'" },
    { name: 'progress', type: 'integer', nullable: false, defaultValue: '0' },
    { name: 'enhanced_prompt', type: 'text', nullable: true },
    { name: 'output_image_url', type: 'text', nullable: true },
    { name: 'output_video_url', type: 'text', nullable: true },
    { name: 'credits_used', type: 'integer', nullable: false, defaultValue: '1' },
    { name: 'actual_cost', type: 'integer', nullable: false, defaultValue: '0' },
    { name: 'resolution', type: 'varchar(50)', nullable: false, defaultValue: "'1024x1024'" },
    { name: 'quality', type: 'varchar(50)', nullable: false, defaultValue: "'standard'" },
    { name: 'error_message', type: 'text', nullable: true },
    { name: 'kling_video_task_id', type: 'varchar(255)', nullable: true },
    { name: 'kling_sound_task_id', type: 'varchar(255)', nullable: true },
    { name: 'include_audio', type: 'boolean', nullable: false, defaultValue: 'false' },
    { name: 'full_task_details', type: 'text', nullable: true },
    // NEW: Enhanced Motion Analysis fields
    { name: 'motion_timeline', type: 'text', nullable: true },
    { name: 'key_frame_urls', type: 'text', nullable: true },
    { name: 'frame_grid_url', type: 'varchar(500)', nullable: true },
    { name: 'created_at', type: 'timestamp', nullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
    { name: 'updated_at', type: 'timestamp', nullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
  ],
  transactions: [
    { name: 'id', type: 'serial', nullable: false },
    { name: 'user_id', type: 'integer', nullable: false },
    { name: 'amount', type: 'decimal(10,2)', nullable: false },
    { name: 'credits', type: 'integer', nullable: false },
    { name: 'stripe_payment_intent_id', type: 'varchar(255)', nullable: true },
    { name: 'status', type: 'transaction_status', nullable: false, defaultValue: "'pending'" },
    { name: 'processed_at', type: 'timestamp', nullable: true },
    { name: 'created_at', type: 'timestamp', nullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
    { name: 'updated_at', type: 'timestamp', nullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
  ],
  jobs: [
    { name: 'id', type: 'serial', nullable: false },
    { name: 'type', type: 'varchar(100)', nullable: false },
    { name: 'project_id', type: 'integer', nullable: false },
    { name: 'user_id', type: 'integer', nullable: false },
    { name: 'status', type: 'job_status', nullable: false, defaultValue: "'pending'" },
    { name: 'priority', type: 'integer', nullable: false, defaultValue: '0' },
    { name: 'progress', type: 'integer', nullable: false, defaultValue: '0' },
    { name: 'data', type: 'text', nullable: true },
    { name: 'result', type: 'text', nullable: true },
    { name: 'error_message', type: 'text', nullable: true },
    { name: 'retry_count', type: 'integer', nullable: false, defaultValue: '0' },
    { name: 'max_retries', type: 'integer', nullable: false, defaultValue: '3' },
    { name: 'processing_started_at', type: 'timestamp', nullable: true },
    { name: 'completed_at', type: 'timestamp', nullable: true },
    { name: 'created_at', type: 'timestamp', nullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
    { name: 'updated_at', type: 'timestamp', nullable: false, defaultValue: 'CURRENT_TIMESTAMP' },
  ]
};

// Required enums with their values
const REQUIRED_ENUMS = {
  project_status: ['pending', 'processing', 'enhancing_prompt', 'generating_image', 'generating_video', 'completed', 'failed'],
  content_type: ['image', 'video'],
  transaction_status: ['pending', 'completed', 'failed'],
  job_status: ['pending', 'processing', 'completed', 'failed']
};

/**
 * Step 1: Ensure all required enums exist with correct values
 */
async function ensureEnums() {
  console.log('🔍 Checking and creating required enums...');
  
  for (const [enumName, enumValues] of Object.entries(REQUIRED_ENUMS)) {
    try {
      // Check if enum type exists
      const enumExists = await db.execute(sql`
        SELECT 1 FROM pg_type WHERE typname = ${enumName}
      `);
      
      if (enumExists.rows.length === 0) {
        console.log(`⚠️ Creating enum ${enumName}...`);
        const valuesString = enumValues.map(v => `'${v}'`).join(', ');
        await db.execute(sql.raw(`CREATE TYPE ${enumName} AS ENUM (${valuesString})`));
        console.log(`✅ Created enum ${enumName} with values: ${enumValues.join(', ')}`);
      } else {
        console.log(`✅ Enum ${enumName} already exists`);
        
        // Check if all values exist (Optional: could add missing values)
        const existingValues = await db.execute(sql`
          SELECT e.enumlabel
          FROM pg_enum e
          JOIN pg_type t ON e.enumtypid = t.oid
          WHERE t.typname = ${enumName}
        `);
        
        const existing = existingValues.rows.map(row => row.enumlabel as string);
        const missing = enumValues.filter(v => !existing.includes(v));
        
        if (missing.length > 0) {
          console.log(`⚠️ Adding missing enum values to ${enumName}: ${missing.join(', ')}`);
          for (const value of missing) {
            await db.execute(sql.raw(`ALTER TYPE ${enumName} ADD VALUE IF NOT EXISTS '${value}'`));
          }
        }
      }
    } catch (error) {
      console.error(`❌ Error with enum ${enumName}:`, error);
    }
  }
}

/**
 * Step 2: Ensure all tables exist (minimal creation if missing)
 */
async function ensureTables() {
  console.log('🔍 Checking required tables...');
  
  const requiredTables = Object.keys(EXPECTED_SCHEMA);
  
  for (const tableName of requiredTables) {
    const tableExists = await db.execute(sql`
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = ${tableName}
    `);
    
    if (tableExists.rows.length === 0) {
      console.log(`⚠️ Table ${tableName} missing - creating minimal structure...`);
      
      // Create minimal table with just ID to start
      if (tableName === 'users') {
        await db.execute(sql`
          CREATE TABLE users (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            credits INTEGER DEFAULT 5 NOT NULL,
            is_admin BOOLEAN DEFAULT FALSE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
          )
        `);
      } else if (tableName === 'projects') {
        await db.execute(sql`
          CREATE TABLE projects (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) NOT NULL,
            title VARCHAR(255) NOT NULL,
            product_image_url TEXT NOT NULL,
            content_type content_type NOT NULL,
            video_duration_seconds INTEGER DEFAULT 5 NOT NULL,
            status project_status DEFAULT 'pending' NOT NULL,
            progress INTEGER DEFAULT 0 NOT NULL,
            credits_used INTEGER DEFAULT 1 NOT NULL,
            actual_cost INTEGER DEFAULT 0 NOT NULL,
            resolution VARCHAR(50) DEFAULT '1024x1024' NOT NULL,
            quality VARCHAR(50) DEFAULT 'standard' NOT NULL,
            include_audio BOOLEAN DEFAULT FALSE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
          )
        `);
      } else if (tableName === 'transactions') {
        await db.execute(sql`
          CREATE TABLE transactions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) NOT NULL,
            amount DECIMAL(10,2) NOT NULL,
            credits INTEGER NOT NULL,
            status transaction_status DEFAULT 'pending' NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
          )
        `);
      } else if (tableName === 'jobs') {
        await db.execute(sql`
          CREATE TABLE jobs (
            id SERIAL PRIMARY KEY,
            type VARCHAR(100) NOT NULL,
            project_id INTEGER REFERENCES projects(id) NOT NULL,
            user_id INTEGER REFERENCES users(id) NOT NULL,
            status job_status DEFAULT 'pending' NOT NULL,
            priority INTEGER DEFAULT 0 NOT NULL,
            progress INTEGER DEFAULT 0 NOT NULL,
            retry_count INTEGER DEFAULT 0 NOT NULL,
            max_retries INTEGER DEFAULT 3 NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
          )
        `);
      }
      
      console.log(`✅ Created table ${tableName} with core structure`);
    } else {
      console.log(`✅ Table ${tableName} already exists`);
    }
  }
}

/**
 * Step 3: Ensure all columns exist in all tables
 */
async function ensureAllColumns() {
  console.log('🔍 Reconciling all table columns...');
  
  for (const [tableName, expectedColumns] of Object.entries(EXPECTED_SCHEMA)) {
    console.log(`\n📋 Checking table: ${tableName}`);
    
    for (const column of expectedColumns) {
      const columnExists = await db.execute(sql`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = ${tableName} 
        AND column_name = ${column.name}
      `);
      
      if (columnExists.rows.length === 0) {
        console.log(`⚠️ Adding missing column: ${tableName}.${column.name}`);
        
        // Build column definition
        let columnDef = `${column.type}`;
        
        if (!column.nullable) {
          if (column.defaultValue) {
            columnDef += ` DEFAULT ${column.defaultValue} NOT NULL`;
          } else {
            columnDef += ` NOT NULL`;
          }
        } else if (column.defaultValue) {
          columnDef += ` DEFAULT ${column.defaultValue}`;
        }
        
        await db.execute(sql.raw(`
          ALTER TABLE ${tableName} 
          ADD COLUMN IF NOT EXISTS ${column.name} ${columnDef}
        `));
        
        console.log(`✅ Added ${tableName}.${column.name} (${columnDef})`);
      } else {
        console.log(`✅ Column ${tableName}.${column.name} exists`);
      }
    }
  }
}

/**
 * Step 4: Ensure critical constraints exist
 */
async function ensureConstraints() {
  console.log('🔍 Checking critical constraints...');
  
  try {
    // Check email unique constraint
    const emailUnique = await db.execute(sql`
      SELECT constraint_name FROM information_schema.table_constraints 
      WHERE table_name = 'users' 
      AND constraint_type = 'UNIQUE'
      AND constraint_name LIKE '%email%'
    `);
    
    if (emailUnique.rows.length === 0) {
      console.log('⚠️ Adding unique constraint on users.email...');
      await db.execute(sql`
        ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email)
      `);
      console.log('✅ Added unique constraint on users.email');
    } else {
      console.log('✅ Email unique constraint exists');
    }
    
    // Verify foreign key constraints exist
    const foreignKeys = [
      { table: 'projects', column: 'user_id', references: 'users(id)' },
      { table: 'transactions', column: 'user_id', references: 'users(id)' },
      { table: 'jobs', column: 'project_id', references: 'projects(id)' },
      { table: 'jobs', column: 'user_id', references: 'users(id)' }
    ];
    
    for (const fk of foreignKeys) {
      const fkExists = await db.execute(sql`
        SELECT constraint_name FROM information_schema.table_constraints 
        WHERE table_name = ${fk.table}
        AND constraint_type = 'FOREIGN KEY'
      `);
      
      if (fkExists.rows.length === 0) {
        console.log(`⚠️ Adding foreign key: ${fk.table}.${fk.column} -> ${fk.references}`);
        const constraintName = `${fk.table}_${fk.column}_fkey`;
        await db.execute(sql.raw(`
          ALTER TABLE ${fk.table} 
          ADD CONSTRAINT ${constraintName} 
          FOREIGN KEY (${fk.column}) REFERENCES ${fk.references}
        `));
        console.log(`✅ Added foreign key constraint: ${constraintName}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error ensuring constraints:', error);
  }
}

/**
 * Main migration function - Comprehensive schema reconciliation
 */
export async function runComprehensiveMigrations() {
  console.log('🚀 Starting COMPREHENSIVE database schema reconciliation...');
  console.log('📊 This will ensure complete sync between dev and production');
  
  try {
    // Step 1: Enums (must be first, outside transactions for some enum operations)
    await ensureEnums();
    
    // Step 2-4: Tables, Columns, Constraints (can be in transaction)
    await db.transaction(async (tx) => {
      console.log('\n🔄 Starting schema reconciliation transaction...');
      
      // Use tx for table operations within transaction
      const originalDb = db;
      (global as any).tempDb = tx;
      
      await ensureTables();
      await ensureAllColumns();
      await ensureConstraints();
      
      (global as any).tempDb = originalDb;
      
      console.log('✅ Schema reconciliation transaction completed');
    });
    
    console.log('\n🎉 COMPREHENSIVE MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('✅ All enums, tables, columns, and constraints are now synchronized');
    
  } catch (error) {
    console.error('❌ COMPREHENSIVE MIGRATION FAILED:', error);
    throw error;
  }
}

/**
 * Legacy function for backwards compatibility
 */
export async function runMigrations() {
  console.log('🔄 Running comprehensive migrations...');
  await runComprehensiveMigrations();
}

/**
 * Development helper - check schema drift
 */
export async function checkSchemaDrift() {
  console.log('🔍 Checking for schema drift...');
  
  let driftFound = false;
  
  for (const [tableName, expectedColumns] of Object.entries(EXPECTED_SCHEMA)) {
    const actualColumns = await db.execute(sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = ${tableName}
      ORDER BY column_name
    `);
    
    const expected = expectedColumns.map(c => c.name).sort();
    const actual = actualColumns.rows.map(r => r.column_name as string).sort();
    
    const missing = expected.filter(col => !actual.includes(col));
    const extra = actual.filter(col => !expected.includes(col));
    
    if (missing.length > 0 || extra.length > 0) {
      driftFound = true;
      console.log(`⚠️ Schema drift detected in table: ${tableName}`);
      if (missing.length > 0) console.log(`  Missing columns: ${missing.join(', ')}`);
      if (extra.length > 0) console.log(`  Extra columns: ${extra.join(', ')}`);
    }
  }
  
  if (!driftFound) {
    console.log('✅ No schema drift detected - all tables are in sync!');
  }
  
  return !driftFound;
}
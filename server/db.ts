import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Create PostgreSQL connection pool for better connection management
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? true : false,
  // Pool configuration for better reliability
  max: 10, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Increase timeout to 10 seconds for better reliability
});

// Initialize connection pool
let initialized = false;

export const connectToDatabase = async () => {
  if (!initialized) {
    // Add retry logic for connection
    const maxRetries = 3;
    let attempts = 0;
    
    while (attempts < maxRetries && !initialized) {
      try {
        // Test the connection
        const client = await pool.connect();
        await client.query('SELECT NOW()');
        client.release();
        
        initialized = true;
        console.log('Connected to Neon PostgreSQL successfully');
        
        // Handle pool errors
        pool.on('error', (err) => {
          console.error('Unexpected error on idle client:', err);
        });
        
        break;
        
      } catch (error) {
        attempts++;
        console.error(`Failed to connect to Neon PostgreSQL (attempt ${attempts}/${maxRetries}):`, error);
        
        if (attempts >= maxRetries) {
          console.error('Max connection attempts reached. Database connection failed.');
          throw error;
        }
        
        // Wait before retrying (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempts - 1), 5000);
        console.log(`Retrying connection in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  return pool;
};

// Create Drizzle database instance with the pool
export const db = drizzle(pool);

// Graceful shutdown
const cleanup = async () => {
  if (initialized) {
    await pool.end();
    console.log('PostgreSQL connection pool closed.');
  }
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
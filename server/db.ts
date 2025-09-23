import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// Lazy initialization to avoid module-load-time environment variable checks
let pool: Pool | null = null;
let dbInstance: ReturnType<typeof drizzle> | null = null;
let initialized = false;

function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL must be set. Did you forget to provision a database?",
      );
    }

    // Create PostgreSQL connection pool for better connection management
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === "production" ? true : false,
      // Pool configuration for better reliability
      max: 10, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 10000, // Increase timeout to 10 seconds for better reliability
    });
  }
  return pool;
}

export const connectToDatabase = async () => {
  if (!initialized) {
    const poolInstance = getPool();
    
    // Add retry logic for connection
    const maxRetries = 3;
    let attempts = 0;
    
    while (attempts < maxRetries && !initialized) {
      try {
        // Test the connection
        const client = await poolInstance.connect();
        await client.query('SELECT NOW()');
        client.release();
        
        initialized = true;
        console.log('Connected to Neon PostgreSQL successfully');
        
        // Handle pool errors
        poolInstance.on('error', (err) => {
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
  return getPool();
};

// Create Drizzle database instance with lazy pool initialization
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(target, prop) {
    if (!dbInstance) {
      dbInstance = drizzle(getPool());
    }
    return dbInstance[prop as keyof typeof dbInstance];
  }
});

// Graceful shutdown
const cleanup = async () => {
  if (initialized && pool) {
    await pool.end();
    console.log('PostgreSQL connection pool closed.');
  }
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
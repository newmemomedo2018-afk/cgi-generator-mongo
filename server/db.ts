import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Create PostgreSQL client
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// Initialize connection
let connected = false;

export const connectToDatabase = async () => {
  if (!connected) {
    try {
      await client.connect();
      connected = true;
      console.log('Connected to Neon PostgreSQL successfully');
    } catch (error) {
      console.error('Failed to connect to Neon PostgreSQL:', error);
      throw error;
    }
  }
  return client;
};

// Create Drizzle database instance
export const db = drizzle(client);

// Graceful shutdown
const cleanup = async () => {
  if (connected) {
    await client.end();
    console.log('PostgreSQL connection closed.');
  }
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
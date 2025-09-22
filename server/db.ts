import { MongoClient, Db } from 'mongodb';

// MongoDB connection setup
if (!process.env.MONGODB_URI) {
  throw new Error(
    "MONGODB_URI must be set. Did you forget to set up MongoDB connection?",
  );
}

let client: MongoClient;
let database: Db;

// Create MongoDB client with improved configuration
export async function connectToDatabase(): Promise<Db> {
  if (database) {
    return database;
  }

  try {
    client = new MongoClient(process.env.MONGODB_URI!, {
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    });

    await client.connect();
    database = client.db(); // Use default database from connection string
    
    console.log('Connected to MongoDB successfully');
    return database;
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    throw error;
  }
}

// Export database instance getter
export const getDatabase = async (): Promise<Db> => {
  if (!database) {
    return await connectToDatabase();
  }
  return database;
};

// Graceful shutdown
process.on('SIGINT', async () => {
  if (client) {
    await client.close();
    console.log('MongoDB connection closed.');
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (client) {
    await client.close();
    console.log('MongoDB connection closed.');
  }
  process.exit(0);
});
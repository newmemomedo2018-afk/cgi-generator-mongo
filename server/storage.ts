import {
  type User,
  type InsertUser,
  type Project,
  type InsertProject,
  type Transaction,
  type InsertTransaction,
  type Job,
  type InsertJob,
  userSchema,
  projectSchema,
  transactionSchema,
  jobQueueSchema,
  COLLECTIONS,
} from "@shared/schema";
import { getDatabase } from "./db";
import { ObjectId, type Db } from "mongodb";

export interface IStorage {
  // User operations (for JWT Auth)
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: { email: string; password: string; firstName?: string; lastName?: string; credits?: number }): Promise<User>;
  upsertUser(user: InsertUser & { _id?: string }): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<void>;
  updateUserCredits(id: string, credits: number): Promise<void>;
  
  // Project operations
  createProject(project: Omit<InsertProject, "_id"> & { userId: string; creditsUsed: number; status?: string }): Promise<Project>;
  getProject(id: string): Promise<Project | undefined>;
  getUserProjects(userId: string): Promise<Project[]>;
  updateProject(id: string, updates: Partial<Project>): Promise<void>;
  
  // Transaction operations
  createTransaction(transaction: Omit<InsertTransaction, "_id"> & { userId: string }): Promise<Transaction>;
  getUserTransactions(userId: string): Promise<Transaction[]>;
  getTransactionByPaymentIntent(paymentIntentId: string): Promise<Transaction | undefined>;
  updateTransaction(id: string, updates: Partial<Transaction>): Promise<void>;
  
  // Admin operations
  getAllUsers(): Promise<User[]>;
  getAllProjects(): Promise<Project[]>;
  getPlatformStats(): Promise<any>;
  
  // Job Queue operations
  createJob(job: Omit<InsertJob, "_id">): Promise<Job>;
  getJob(id: string): Promise<Job | undefined>;
  getJobByProjectId(projectId: string): Promise<Job | undefined>;
  getNextPendingJob(): Promise<Job | undefined>;
  claimJob(id: string): Promise<boolean>;
  updateJob(id: string, updates: Partial<Job>): Promise<void>;
  markJobCompleted(id: string, result: any): Promise<void>;
  markJobFailed(id: string, errorMessage: string): Promise<void>;
}

export class MongoStorage implements IStorage {
  private async getDb(): Promise<Db> {
    return await getDatabase();
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const db = await this.getDb();
    const result = await db.collection(COLLECTIONS.USERS).findOne({ _id: new ObjectId(id) });
    if (!result) return undefined;
    
    // Convert MongoDB ObjectId to string for consistency
    return {
      ...result,
      _id: result._id.toString(),
    } as User;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const db = await this.getDb();
    const result = await db.collection(COLLECTIONS.USERS).findOne({ email });
    if (!result) return undefined;
    
    return {
      ...result,
      _id: result._id.toString(),
    } as User;
  }

  async createUser(userData: { email: string; password: string; firstName?: string; lastName?: string; credits?: number }): Promise<User> {
    const db = await this.getDb();
    const now = new Date();
    
    const userDoc = {
      email: userData.email,
      password: userData.password,
      firstName: userData.firstName,
      lastName: userData.lastName,
      credits: userData.credits || 5,
      isAdmin: false,
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection(COLLECTIONS.USERS).insertOne(userDoc);
    
    return {
      _id: result.insertedId.toString(),
      ...userDoc,
    };
  }

  async upsertUser(userData: InsertUser & { _id?: string }): Promise<User> {
    const db = await this.getDb();
    const now = new Date();

    if (userData._id) {
      // Update existing user
      const updateDoc = {
        ...userData,
        updatedAt: now,
      };
      delete updateDoc._id; // Remove _id from update
      
      await db.collection(COLLECTIONS.USERS).updateOne(
        { _id: new ObjectId(userData._id) },
        { $set: updateDoc },
        { upsert: true }
      );
      
      return this.getUser(userData._id) as Promise<User>;
    } else {
      // Create new user
      const userDoc = {
        ...userData,
        createdAt: now,
        updatedAt: now,
      };

      const result = await db.collection(COLLECTIONS.USERS).insertOne(userDoc);
      
      return {
        _id: result.insertedId.toString(),
        ...userDoc,
      };
    }
  }

  async updateUser(id: string, updates: Partial<User>): Promise<void> {
    const db = await this.getDb();
    const updateDoc = { ...updates, updatedAt: new Date() };
    delete updateDoc._id; // Remove _id from update
    
    await db.collection(COLLECTIONS.USERS).updateOne(
      { _id: new ObjectId(id) },
      { $set: updateDoc }
    );
  }

  async updateUserCredits(id: string, credits: number): Promise<void> {
    const db = await this.getDb();
    
    // Get user info to check if admin
    const user = await this.getUser(id);
    const finalCredits = (user && user.email === 'admin@test.com') ? 1000 : credits;
    
    await db.collection(COLLECTIONS.USERS).updateOne(
      { _id: new ObjectId(id) },
      { $set: { credits: finalCredits, updatedAt: new Date() } }
    );
  }

  // Project operations
  async createProject(projectData: Omit<InsertProject, "_id"> & { userId: string; creditsUsed: number; status?: string }): Promise<Project> {
    const db = await this.getDb();
    const now = new Date();
    
    const projectDoc = {
      ...projectData,
      userId: new ObjectId(projectData.userId), // Convert to ObjectId for MongoDB
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection(COLLECTIONS.PROJECTS).insertOne(projectDoc);
    
    return {
      _id: result.insertedId.toString(),
      ...projectDoc,
      userId: projectData.userId, // Keep as string for response
    } as Project;
  }

  async getProject(id: string): Promise<Project | undefined> {
    const db = await this.getDb();
    const result = await db.collection(COLLECTIONS.PROJECTS).findOne({ _id: new ObjectId(id) });
    if (!result) return undefined;
    
    return {
      ...result,
      _id: result._id.toString(),
      userId: result.userId.toString(),
    } as Project;
  }

  async getUserProjects(userId: string): Promise<Project[]> {
    const db = await this.getDb();
    const results = await db.collection(COLLECTIONS.PROJECTS)
      .find({ userId: new ObjectId(userId) })
      .sort({ createdAt: -1 })
      .toArray();
    
    return results.map(project => ({
      ...project,
      _id: project._id.toString(),
      userId: project.userId.toString(),
    })) as Project[];
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<void> {
    const db = await this.getDb();
    const updateDoc = { ...updates, updatedAt: new Date() };
    delete updateDoc._id; // Remove _id from update
    
    if (updateDoc.userId) {
      updateDoc.userId = new ObjectId(updateDoc.userId as string) as any;
    }
    
    await db.collection(COLLECTIONS.PROJECTS).updateOne(
      { _id: new ObjectId(id) },
      { $set: updateDoc }
    );
  }

  // Transaction operations
  async createTransaction(transactionData: Omit<InsertTransaction, "_id"> & { userId: string }): Promise<Transaction> {
    const db = await this.getDb();
    const now = new Date();
    
    const transactionDoc = {
      ...transactionData,
      userId: new ObjectId(transactionData.userId), // Convert to ObjectId for MongoDB
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection(COLLECTIONS.TRANSACTIONS).insertOne(transactionDoc);
    
    return {
      _id: result.insertedId.toString(),
      ...transactionDoc,
      userId: transactionData.userId, // Keep as string for response
    } as Transaction;
  }

  async getUserTransactions(userId: string): Promise<Transaction[]> {
    const db = await this.getDb();
    const results = await db.collection(COLLECTIONS.TRANSACTIONS)
      .find({ userId: new ObjectId(userId) })
      .sort({ createdAt: -1 })
      .toArray();
    
    return results.map(transaction => ({
      ...transaction,
      _id: transaction._id.toString(),
      userId: transaction.userId.toString(),
    })) as Transaction[];
  }

  async getTransactionByPaymentIntent(paymentIntentId: string): Promise<Transaction | undefined> {
    const db = await this.getDb();
    const result = await db.collection(COLLECTIONS.TRANSACTIONS).findOne({ stripePaymentIntentId: paymentIntentId });
    if (!result) return undefined;
    
    return {
      ...result,
      _id: result._id.toString(),
      userId: result.userId.toString(),
    } as Transaction;
  }

  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<void> {
    const db = await this.getDb();
    const updateDoc = { ...updates, updatedAt: new Date() };
    delete updateDoc._id; // Remove _id from update
    
    if (updateDoc.userId) {
      updateDoc.userId = new ObjectId(updateDoc.userId as string) as any;
    }
    
    await db.collection(COLLECTIONS.TRANSACTIONS).updateOne(
      { _id: new ObjectId(id) },
      { $set: updateDoc }
    );
  }

  // Admin operations
  async getAllUsers(): Promise<User[]> {
    const db = await this.getDb();
    const results = await db.collection(COLLECTIONS.USERS)
      .find({})
      .sort({ createdAt: -1 })
      .toArray();
    
    return results.map(user => ({
      ...user,
      _id: user._id.toString(),
    })) as User[];
  }

  async getAllProjects(): Promise<Project[]> {
    const db = await this.getDb();
    const results = await db.collection(COLLECTIONS.PROJECTS)
      .find({})
      .sort({ createdAt: -1 })
      .toArray();
    
    return results.map(project => ({
      ...project,
      _id: project._id.toString(),
      userId: project.userId.toString(),
    })) as Project[];
  }

  async getPlatformStats(): Promise<any> {
    const db = await this.getDb();
    
    const [userCount, projectCount, transactionCount, completedProjects] = await Promise.all([
      db.collection(COLLECTIONS.USERS).countDocuments(),
      db.collection(COLLECTIONS.PROJECTS).countDocuments(),
      db.collection(COLLECTIONS.TRANSACTIONS).countDocuments(),
      db.collection(COLLECTIONS.PROJECTS).countDocuments({ status: 'completed' }),
    ]);
    
    return {
      totalUsers: userCount,
      totalProjects: projectCount,
      completedProjects: completedProjects,
      totalTransactions: transactionCount,
    };
  }

  // Job Queue operations
  async createJob(jobData: Omit<InsertJob, "_id">): Promise<Job> {
    const db = await this.getDb();
    const now = new Date();
    
    const jobDoc = {
      ...jobData,
      projectId: new ObjectId(jobData.projectId), // Convert to ObjectId for MongoDB
      userId: new ObjectId(jobData.userId), // Convert to ObjectId for MongoDB
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection(COLLECTIONS.JOBS).insertOne(jobDoc);
    
    return {
      _id: result.insertedId.toString(),
      ...jobDoc,
      projectId: jobData.projectId, // Keep as string for response
      userId: jobData.userId, // Keep as string for response
    } as Job;
  }

  async getJob(jobId: string): Promise<Job | undefined> {
    const db = await this.getDb();
    const result = await db.collection(COLLECTIONS.JOBS).findOne({ _id: new ObjectId(jobId) });
    if (!result) return undefined;
    
    return {
      ...result,
      _id: result._id.toString(),
      projectId: result.projectId.toString(),
      userId: result.userId.toString(),
    } as Job;
  }

  async getJobByProjectId(projectId: string): Promise<Job | undefined> {
    const db = await this.getDb();
    const result = await db.collection(COLLECTIONS.JOBS)
      .findOne(
        { projectId: new ObjectId(projectId) },
        { sort: { createdAt: -1 } }
      );
    if (!result) return undefined;
    
    return {
      ...result,
      _id: result._id.toString(),
      projectId: result.projectId.toString(),
      userId: result.userId.toString(),
    } as Job;
  }

  async getNextPendingJob(): Promise<Job | undefined> {
    const db = await this.getDb();
    const result = await db.collection(COLLECTIONS.JOBS)
      .findOne(
        { status: 'pending' },
        { sort: { priority: -1, createdAt: 1 } }
      );
    if (!result) return undefined;
    
    return {
      ...result,
      _id: result._id.toString(),
      projectId: result.projectId.toString(),
      userId: result.userId.toString(),
    } as Job;
  }

  async claimJob(jobId: string): Promise<boolean> {
    const db = await this.getDb();
    
    // Atomically claim a job if it's still pending
    const result = await db.collection(COLLECTIONS.JOBS).updateOne(
      { 
        _id: new ObjectId(jobId),
        status: 'pending'
      },
      { 
        $set: { 
          status: 'processing',
          startedAt: new Date(),
          updatedAt: new Date()
        }
      }
    );
    
    return result.modifiedCount > 0;
  }

  async updateJob(jobId: string, updates: Partial<Job>): Promise<void> {
    const db = await this.getDb();
    const updateDoc = { ...updates, updatedAt: new Date() };
    delete updateDoc._id; // Remove _id from update
    
    if (updateDoc.projectId) {
      updateDoc.projectId = new ObjectId(updateDoc.projectId as string) as any;
    }
    if (updateDoc.userId) {
      updateDoc.userId = new ObjectId(updateDoc.userId as string) as any;
    }
    
    await db.collection(COLLECTIONS.JOBS).updateOne(
      { _id: new ObjectId(jobId) },
      { $set: updateDoc }
    );
  }

  async markJobCompleted(jobId: string, result: any): Promise<void> {
    const db = await this.getDb();
    
    await db.collection(COLLECTIONS.JOBS).updateOne(
      { _id: new ObjectId(jobId) },
      { 
        $set: {
          status: 'completed',
          result: result,
          completedAt: new Date(),
          updatedAt: new Date()
        }
      }
    );
  }

  async markJobFailed(jobId: string, errorMessage: string): Promise<void> {
    const db = await this.getDb();
    
    await db.collection(COLLECTIONS.JOBS).updateOne(
      { _id: new ObjectId(jobId) },
      { 
        $set: {
          status: 'failed',
          errorMessage: errorMessage,
          completedAt: new Date(),
          updatedAt: new Date()
        }
      }
    );
  }
}

export const storage = new MongoStorage();
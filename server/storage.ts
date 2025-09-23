import {
  type User,
  type NewUser,
  type Project,
  type NewProject,
  type CreateProjectInput,
  type Transaction,
  type NewTransaction,
  type Job,
  type NewJob,
  type CreateJobInput,
  users,
  projects,
  transactions,
  jobs,
} from "@shared/schema";
import { db, connectToDatabase } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";

export interface IStorage {
  // User operations (for JWT Auth)
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: { email: string; password: string; firstName?: string; lastName?: string; credits?: number; isAdmin?: boolean }): Promise<User>;
  upsertUser(user: NewUser & { id?: number }): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<void>;
  updateUserCredits(id: number, credits: number): Promise<void>;
  
  // Project operations
  createProject(project: Omit<NewProject, "id"> & { userId: number; creditsUsed: number; status?: string }): Promise<Project>;
  getProject(id: number): Promise<Project | undefined>;
  getUserProjects(userId: number): Promise<Project[]>;
  updateProject(id: number, updates: Partial<Project>): Promise<void>;
  deleteProject(id: number): Promise<void>;
  
  // Transaction operations
  createTransaction(transaction: Omit<NewTransaction, "id"> & { userId: number }): Promise<Transaction>;
  getUserTransactions(userId: number): Promise<Transaction[]>;
  getTransactionByPaymentIntent(paymentIntentId: string): Promise<Transaction | undefined>;
  updateTransaction(id: number, updates: Partial<Transaction>): Promise<void>;
  
  // Admin operations
  getAllUsers(): Promise<User[]>;
  getAllProjects(): Promise<Project[]>;
  getPlatformStats(): Promise<any>;
  
  // Job Queue operations
  createJob(job: CreateJobInput): Promise<Job>;
  getJob(id: number): Promise<Job | undefined>;
  getJobByProjectId(projectId: number): Promise<Job | undefined>;
  getNextPendingJob(): Promise<Job | undefined>;
  claimJob(id: number): Promise<boolean>;
  updateJob(id: number, updates: Partial<Job>): Promise<void>;
  markJobCompleted(id: number, result: any): Promise<void>;
  markJobFailed(id: number, errorMessage: string): Promise<void>;
  
  // Health check
  checkHealth(): Promise<boolean>;
}

export class PostgreSQLStorage implements IStorage {
  constructor() {
    // Ensure database connection is established
    connectToDatabase();
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      // Production-compatible query - handles both old and new schema
      const result = await db.execute(sql`
        SELECT id, email, password, credits, is_admin, created_at, updated_at,
               CASE 
                 WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'first_name') 
                 THEN first_name 
                 ELSE NULL 
               END as first_name,
               CASE 
                 WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'last_name') 
                 THEN last_name 
                 ELSE NULL 
               END as last_name,
               CASE 
                 WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'profile_image_url') 
                 THEN profile_image_url 
                 ELSE NULL 
               END as profile_image_url,
               CASE 
                 WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'stripe_customer_id') 
                 THEN stripe_customer_id 
                 ELSE NULL 
               END as stripe_customer_id,
               CASE 
                 WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'stripe_subscription_id') 
                 THEN stripe_subscription_id 
                 ELSE NULL 
               END as stripe_subscription_id
        FROM users 
        WHERE email = ${email} 
        LIMIT 1
      `);
      
      if (result.rows.length === 0) return undefined;
      
      const row = result.rows[0] as any;
      return {
        id: row.id,
        email: row.email,
        password: row.password,
        firstName: row.first_name,
        lastName: row.last_name,
        profileImageUrl: row.profile_image_url,
        credits: row.credits,
        isAdmin: row.is_admin,
        stripeCustomerId: row.stripe_customer_id,
        stripeSubscriptionId: row.stripe_subscription_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } catch (error) {
      console.error('Smart schema query failed, trying minimal fallback:', error);
      // Ultimate fallback: Only the columns we know exist in production
      const result = await db.execute(sql`
        SELECT id, email, password, credits, is_admin, created_at, updated_at
        FROM users 
        WHERE email = ${email} 
        LIMIT 1
      `);
      
      if (result.rows.length === 0) return undefined;
      
      const row = result.rows[0] as any;
      return {
        id: row.id,
        email: row.email,
        password: row.password,
        firstName: null,
        lastName: null,
        profileImageUrl: null,
        credits: row.credits,
        isAdmin: row.is_admin,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    }
  }

  async createUser(userData: { email: string; password: string; firstName?: string; lastName?: string; credits?: number; isAdmin?: boolean }): Promise<User> {
    const newUser: NewUser = {
      email: userData.email,
      password: userData.password,
      firstName: userData.firstName,
      lastName: userData.lastName,
      credits: userData.credits ?? 5,
      isAdmin: userData.isAdmin ?? false,
    };

    const result = await db.insert(users).values(newUser).returning();
    return result[0];
  }

  async upsertUser(userData: NewUser & { id?: number }): Promise<User> {
    if (userData.id) {
      // Update existing user
      await this.updateUser(userData.id, userData);
      return (await this.getUser(userData.id))!;
    } else {
      // Create new user
      return await this.createUser(userData);
    }
  }

  async updateUser(id: number, updates: Partial<User>): Promise<void> {
    const updateData = { ...updates };
    delete (updateData as any).id; // Remove id from updates
    delete (updateData as any).createdAt; // Remove createdAt from updates
    
    // Update timestamp
    (updateData as any).updatedAt = new Date();

    await db.update(users).set(updateData).where(eq(users.id, id));
  }

  async updateUserCredits(id: number, credits: number): Promise<void> {
    await db.update(users)
      .set({ 
        credits,
        updatedAt: new Date()
      })
      .where(eq(users.id, id));
  }

  // Project operations
  async createProject(projectData: Omit<NewProject, "id"> & { userId: number; creditsUsed: number; status?: string }): Promise<Project> {
    const newProject: NewProject = {
      ...projectData,
      status: (projectData.status as any) || 'pending',
    };

    const result = await db.insert(projects).values(newProject).returning();
    return result[0];
  }

  async getProject(id: number): Promise<Project | undefined> {
    const result = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    return result[0];
  }

  async getUserProjects(userId: number): Promise<Project[]> {
    const result = await db.select()
      .from(projects)
      .where(eq(projects.userId, userId))
      .orderBy(desc(projects.createdAt));
    return result;
  }

  async updateProject(id: number, updates: Partial<Project>): Promise<void> {
    const updateData = { ...updates };
    delete (updateData as any).id; // Remove id from updates
    delete (updateData as any).createdAt; // Remove createdAt from updates
    
    // Update timestamp
    (updateData as any).updatedAt = new Date();

    await db.update(projects).set(updateData).where(eq(projects.id, id));
  }

  async deleteProject(id: number): Promise<void> {
    await db.delete(projects).where(eq(projects.id, id));
  }

  // Transaction operations
  async createTransaction(transactionData: Omit<NewTransaction, "id"> & { userId: number }): Promise<Transaction> {
    const newTransaction: NewTransaction = {
      ...transactionData,
    };

    const result = await db.insert(transactions).values(newTransaction).returning();
    return result[0];
  }

  async getUserTransactions(userId: number): Promise<Transaction[]> {
    const result = await db.select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.createdAt));
    return result;
  }

  async getTransactionByPaymentIntent(paymentIntentId: string): Promise<Transaction | undefined> {
    const result = await db.select()
      .from(transactions)
      .where(eq(transactions.stripePaymentIntentId, paymentIntentId))
      .limit(1);
    return result[0];
  }

  async updateTransaction(id: number, updates: Partial<Transaction>): Promise<void> {
    const updateData = { ...updates };
    delete (updateData as any).id; // Remove id from updates
    delete (updateData as any).createdAt; // Remove createdAt from updates
    
    // Update timestamp
    (updateData as any).updatedAt = new Date();

    await db.update(transactions).set(updateData).where(eq(transactions.id, id));
  }

  // Admin operations
  async getAllUsers(): Promise<User[]> {
    const result = await db.select()
      .from(users)
      .orderBy(desc(users.createdAt));
    return result;
  }

  async getAllProjects(): Promise<Project[]> {
    const result = await db.select()
      .from(projects)
      .orderBy(desc(projects.createdAt));
    return result;
  }

  async getPlatformStats(): Promise<any> {
    // Run parallel queries for stats using proper count
    const [usersCount, projectsCount, transactionsCount] = await Promise.all([
      db.select().from(users),
      db.select().from(projects),
      db.select().from(transactions),
    ]);

    return {
      totalUsers: usersCount.length,
      totalProjects: projectsCount.length,
      totalTransactions: transactionsCount.length,
      generatedAt: new Date(),
    };
  }

  // Job Queue operations
  async createJob(jobData: CreateJobInput): Promise<Job> {
    const newJob: NewJob = {
      ...jobData,
      status: 'pending',
      progress: 0,
      retryCount: 0,
      maxRetries: 3,
    };

    const result = await db.insert(jobs).values(newJob).returning();
    return result[0];
  }

  async getJob(id: number): Promise<Job | undefined> {
    const result = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
    return result[0];
  }

  async getJobByProjectId(projectId: number): Promise<Job | undefined> {
    const result = await db.select()
      .from(jobs)
      .where(eq(jobs.projectId, projectId))
      .orderBy(desc(jobs.createdAt))
      .limit(1);
    return result[0];
  }

  async getNextPendingJob(): Promise<Job | undefined> {
    const result = await db.select()
      .from(jobs)
      .where(eq(jobs.status, 'pending'))
      .orderBy(desc(jobs.priority), jobs.createdAt)
      .limit(1);
    return result[0];
  }

  async claimJob(id: number): Promise<boolean> {
    try {
      await db.update(jobs)
        .set({ 
          status: 'processing',
          processingStartedAt: new Date(),
          updatedAt: new Date()
        })
        .where(and(eq(jobs.id, id), eq(jobs.status, 'pending')));
      return true;
    } catch (error) {
      console.error('Failed to claim job:', error);
      return false;
    }
  }

  async updateJob(id: number, updates: Partial<Job>): Promise<void> {
    const updateData = { ...updates };
    delete (updateData as any).id; // Remove id from updates
    delete (updateData as any).createdAt; // Remove createdAt from updates
    
    // Update timestamp
    (updateData as any).updatedAt = new Date();

    await db.update(jobs).set(updateData).where(eq(jobs.id, id));
  }

  async markJobCompleted(id: number, result: any): Promise<void> {
    await db.update(jobs)
      .set({
        status: 'completed',
        result: JSON.stringify(result),
        completedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(jobs.id, id));
  }

  async markJobFailed(id: number, errorMessage: string): Promise<void> {
    await db.update(jobs)
      .set({
        status: 'failed',
        errorMessage,
        completedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(jobs.id, id));
  }

  async checkHealth(): Promise<boolean> {
    try {
      // Schema-agnostic health check: simple ping without table dependency
      await db.execute(sql`SELECT 1`);
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }
}

// Create storage instance
export const storage = new PostgreSQLStorage();
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

  // Atomic project creation operation
  createProjectWithTransaction(
    projectData: Omit<NewProject, "id"> & { userId: number; creditsUsed: number; status?: string },
    jobData: CreateJobInput,
    isAdmin?: boolean
  ): Promise<{ project: Project; job: Job }>;
  
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
        WHERE id = ${id} 
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
        WHERE id = ${id} 
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
    try {
      // Production-compatible update - handles both old and new schema
      await db.execute(sql`
        UPDATE users 
        SET credits = ${credits}, 
            updated_at = CURRENT_TIMESTAMP 
        WHERE id = ${id}
      `);
    } catch (error) {
      console.error('Failed to update user credits:', error);
      throw error;
    }
  }

  // Project operations
  async createProject(projectData: Omit<NewProject, "id"> & { userId: number; creditsUsed: number; status?: string }): Promise<Project> {
    try {
      // Production-compatible insert - uses raw SQL to handle both old and new schema
      const status = projectData.status || 'pending';
      
      // Insert project using raw SQL to avoid schema compatibility issues
      const result = await db.execute(sql`
        INSERT INTO projects (
          user_id, title, description, product_image_url, scene_image_url, 
          scene_video_url, content_type, video_duration_seconds, status, 
          progress, enhanced_prompt, output_image_url, output_video_url, 
          credits_used, actual_cost, resolution, quality, product_size, error_message,
          kling_video_task_id, kling_sound_task_id, include_audio, 
          full_task_details, created_at, updated_at
        ) VALUES (
          ${projectData.userId}, ${projectData.title}, ${projectData.description}, 
          ${projectData.productImageUrl}, ${projectData.sceneImageUrl || null}, 
          ${projectData.sceneVideoUrl || null}, ${projectData.contentType}, 
          ${projectData.videoDurationSeconds || 5}, ${status}, 
          ${projectData.progress || 0}, ${projectData.enhancedPrompt || null}, 
          ${projectData.outputImageUrl || null}, ${projectData.outputVideoUrl || null}, 
          ${projectData.creditsUsed}, ${projectData.actualCost || 0}, 
          ${projectData.resolution || '1920x1080'}, ${projectData.quality || 'standard'}, 
          ${(projectData as any).productSize || 'normal'}, ${projectData.errorMessage || null}, 
          ${projectData.klingVideoTaskId || null}, ${projectData.klingSoundTaskId || null}, 
          ${projectData.includeAudio || false}, ${projectData.fullTaskDetails || null}, 
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        RETURNING *
      `);

      if (!result.rows || result.rows.length === 0) {
        throw new Error('Failed to create project - no data returned');
      }

      return result.rows[0] as Project;
    } catch (error) {
      console.error('Failed to create project:', error);
      throw error;
    }
  }

  async getProject(id: number): Promise<Project | undefined> {
    const result = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    return result[0];
  }

  async getUserProjects(userId: number): Promise<Project[]> {
    try {
      // Production-safe read - handle both schema versions
      const result = await db.execute(sql`
        SELECT *, 
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'projects' AND column_name = 'product_size'
          ) THEN product_size 
          ELSE 'normal' 
        END as product_size
        FROM projects 
        WHERE user_id = ${userId} 
        ORDER BY created_at DESC
      `);
      
      // Transform snake_case DB columns to camelCase for frontend compatibility
      const projects = (result.rows || []).map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        title: row.title,
        description: row.description,
        productImageUrl: row.product_image_url,
        sceneImageUrl: row.scene_image_url,
        sceneVideoUrl: row.scene_video_url,
        contentType: row.content_type,
        videoDurationSeconds: row.video_duration_seconds,
        status: row.status,
        progress: row.progress,
        enhancedPrompt: row.enhanced_prompt,
        outputImageUrl: row.output_image_url,
        outputVideoUrl: row.output_video_url,
        creditsUsed: row.credits_used,
        actualCost: row.actual_cost,
        resolution: row.resolution,
        quality: row.quality,
        productSize: row.product_size || 'normal',
        errorMessage: row.error_message,
        klingVideoTaskId: row.kling_video_task_id,
        klingSoundTaskId: row.kling_sound_task_id,
        includeAudio: row.include_audio,
        fullTaskDetails: row.full_task_details,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
      
      return projects as Project[];
    } catch (error) {
      console.error('Failed to get user projects:', error);
      // Fallback to basic schema-agnostic query using Drizzle (returns camelCase)
      const result = await db.select()
        .from(projects)
        .where(eq(projects.userId, userId))
        .orderBy(desc(projects.createdAt));
      return result;
    }
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

  // Atomic operation: Create project + deduct credits + create job in one transaction
  async createProjectWithTransaction(
    projectData: Omit<NewProject, "id"> & { userId: number; creditsUsed: number; status?: string },
    jobData: CreateJobInput,
    isAdmin: boolean = false
  ): Promise<{ project: Project; job: Job }> {
    return db.transaction(async (tx) => {
      try {
        console.log("🔄 Starting atomic project creation transaction...");
        
        // 1. Check user credits first (within transaction)
        const userResult = await tx.execute(sql`
          SELECT id, credits, is_admin 
          FROM users 
          WHERE id = ${projectData.userId}
          FOR UPDATE
        `);
        
        if (!userResult.rows || userResult.rows.length === 0) {
          throw new Error('User not found');
        }
        
        const user = userResult.rows[0] as any;
        const currentCredits = user.credits;
        
        // Check if user has sufficient credits (unless admin)
        if (!isAdmin && currentCredits < projectData.creditsUsed) {
          throw new Error(`Insufficient credits. Need ${projectData.creditsUsed}, have ${currentCredits}`);
        }

        // 2. Create project using raw SQL within transaction
        // First, check if product_size column exists for production compatibility
        const columnCheck = await tx.execute(sql`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'projects' AND column_name = 'product_size'
        `);
        
        const hasProductSizeColumn = columnCheck.rows && columnCheck.rows.length > 0;
        console.log(`Database schema check: product_size column exists = ${hasProductSizeColumn}`);
        
        // Use appropriate SQL based on schema version
        const projectResult = hasProductSizeColumn ? await tx.execute(sql`
          INSERT INTO projects (
            user_id, title, description, product_image_url, scene_image_url, 
            scene_video_url, content_type, video_duration_seconds, status, 
            progress, enhanced_prompt, output_image_url, output_video_url, 
            credits_used, actual_cost, resolution, quality, product_size, error_message,
            kling_video_task_id, kling_sound_task_id, include_audio, 
            full_task_details, created_at, updated_at
          ) VALUES (
            ${projectData.userId}, ${projectData.title}, ${projectData.description}, 
            ${projectData.productImageUrl}, ${projectData.sceneImageUrl || null}, 
            ${projectData.sceneVideoUrl || null}, ${projectData.contentType}, 
            ${projectData.videoDurationSeconds || 5}, ${projectData.status || 'pending'}, 
            ${projectData.progress || 0}, ${projectData.enhancedPrompt || null}, 
            ${projectData.outputImageUrl || null}, ${projectData.outputVideoUrl || null}, 
            ${projectData.creditsUsed}, ${projectData.actualCost || 0}, 
            ${projectData.resolution || '1920x1080'}, ${projectData.quality || 'standard'}, 
            ${(projectData as any).productSize || 'normal'}, ${projectData.errorMessage || null}, 
            ${projectData.klingVideoTaskId || null}, ${projectData.klingSoundTaskId || null}, 
            ${projectData.includeAudio || false}, ${projectData.fullTaskDetails || null}, 
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
          RETURNING *
        `) : await tx.execute(sql`
          INSERT INTO projects (
            user_id, title, description, product_image_url, scene_image_url, 
            scene_video_url, content_type, video_duration_seconds, status, 
            progress, enhanced_prompt, output_image_url, output_video_url, 
            credits_used, actual_cost, resolution, quality, error_message,
            kling_video_task_id, kling_sound_task_id, include_audio, 
            full_task_details, created_at, updated_at
          ) VALUES (
            ${projectData.userId}, ${projectData.title}, ${projectData.description}, 
            ${projectData.productImageUrl}, ${projectData.sceneImageUrl || null}, 
            ${projectData.sceneVideoUrl || null}, ${projectData.contentType}, 
            ${projectData.videoDurationSeconds || 5}, ${projectData.status || 'pending'}, 
            ${projectData.progress || 0}, ${projectData.enhancedPrompt || null}, 
            ${projectData.outputImageUrl || null}, ${projectData.outputVideoUrl || null}, 
            ${projectData.creditsUsed}, ${projectData.actualCost || 0}, 
            ${projectData.resolution || '1920x1080'}, ${projectData.quality || 'standard'}, 
            ${projectData.errorMessage || null}, ${projectData.klingVideoTaskId || null}, 
            ${projectData.klingSoundTaskId || null}, ${projectData.includeAudio || false}, 
            ${projectData.fullTaskDetails || null}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
          RETURNING *
        `);

        if (!projectResult.rows || projectResult.rows.length === 0) {
          throw new Error('Failed to create project');
        }

        const project = projectResult.rows[0] as Project;
        console.log(`✅ Project created in transaction: ${project.id}`);

        // 3. Deduct credits from user (unless admin in production)
        // In development, always deduct credits for better testing
        const shouldDeductCredits = !isAdmin || process.env.NODE_ENV === 'development';
        if (shouldDeductCredits) {
          const newCredits = currentCredits - projectData.creditsUsed;
          await tx.execute(sql`
            UPDATE users 
            SET credits = ${newCredits}, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ${projectData.userId}
          `);
          console.log(`💰 Credits deducted in transaction: ${projectData.creditsUsed} (${currentCredits} → ${newCredits})`);
          if (isAdmin) {
            console.log(`🔧 Development mode: Credits deducted from admin for testing`);
          }
        } else {
          console.log(`👑 Admin privileges: Credits not deducted in production`);
        }

        // 4. Create job within transaction (using the created project ID)
        const jobResult = await tx.execute(sql`
          INSERT INTO jobs (
            type, project_id, user_id, priority, data, status, 
            progress, retry_count, max_retries, created_at, updated_at
          ) VALUES (
            ${jobData.type}, ${project.id}, ${jobData.userId}, 
            ${jobData.priority || 1}, ${jobData.data}, 'pending', 
            0, 0, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
          RETURNING *
        `);

        if (!jobResult.rows || jobResult.rows.length === 0) {
          throw new Error('Failed to create job');
        }

        const job = jobResult.rows[0] as Job;
        console.log(`🎯 Job created in transaction: ${job.id}`);

        console.log("✅ Atomic transaction completed successfully!");
        return { project, job };
        
      } catch (error) {
        console.error("❌ Transaction failed, rolling back:", error);
        throw error; // This will trigger rollback automatically
      }
    });
  }

  // Job Queue operations
  async createJob(jobData: CreateJobInput): Promise<Job> {
    try {
      // Production-compatible insert - uses raw SQL to handle both old and new schema
      const result = await db.execute(sql`
        INSERT INTO jobs (
          type, project_id, user_id, priority, data, status, 
          progress, retry_count, max_retries, created_at, updated_at
        ) VALUES (
          ${jobData.type}, ${jobData.projectId}, ${jobData.userId}, 
          ${jobData.priority || 1}, ${jobData.data}, 'pending', 
          0, 0, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        RETURNING *
      `);

      if (!result.rows || result.rows.length === 0) {
        throw new Error('Failed to create job - no data returned');
      }

      return result.rows[0] as Job;
    } catch (error) {
      console.error('Failed to create job:', error);
      throw error;
    }
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
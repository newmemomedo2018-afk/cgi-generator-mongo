import { z } from "zod";
import { sql } from "drizzle-orm";
import { pgTable, serial, varchar, text, integer, timestamp, boolean, decimal, pgEnum } from "drizzle-orm/pg-core";

// Enum definitions for PostgreSQL
export const projectStatusEnum = pgEnum('project_status', [
  'pending', 
  'processing', 
  'enhancing_prompt', 
  'generating_image', 
  'generating_video', 
  'completed', 
  'failed'
]);

export const contentTypeEnum = pgEnum('content_type', ['image', 'video']);
export const transactionStatusEnum = pgEnum('transaction_status', ['pending', 'completed', 'failed']);
export const jobStatusEnum = pgEnum('job_status', ['pending', 'processing', 'completed', 'failed']);

// Users table (PostgreSQL) - Production compatible schema
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  profileImageUrl: text('profile_image_url'),
  credits: integer('credits').default(5).notNull(),
  isAdmin: boolean('is_admin').default(false).notNull(),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Projects table (PostgreSQL)  
export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  productImageUrl: text('product_image_url').notNull(),
  sceneImageUrl: text('scene_image_url'),
  sceneVideoUrl: text('scene_video_url'),
  contentType: contentTypeEnum('content_type').notNull(),
  videoDurationSeconds: integer('video_duration_seconds').default(5).notNull(),
  status: projectStatusEnum('status').default('pending').notNull(),
  progress: integer('progress').default(0).notNull(),
  enhancedPrompt: text('enhanced_prompt'),
  outputImageUrl: text('output_image_url'),
  outputVideoUrl: text('output_video_url'),
  creditsUsed: integer('credits_used').notNull(),
  actualCost: integer('actual_cost').default(0).notNull(), // in millicents
  resolution: varchar('resolution', { length: 50 }).default('1024x1024').notNull(),
  quality: varchar('quality', { length: 50 }).default('standard').notNull(),
  errorMessage: text('error_message'),
  // Kling AI task tracking
  klingVideoTaskId: varchar('kling_video_task_id', { length: 255 }),
  klingSoundTaskId: varchar('kling_sound_task_id', { length: 255 }),
  includeAudio: boolean('include_audio').default(false).notNull(),
  fullTaskDetails: text('full_task_details'), // JSON string
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Transactions table (PostgreSQL)
export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(), // in USD
  credits: integer('credits').notNull(),
  stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 255 }),
  status: transactionStatusEnum('status').default('pending').notNull(),
  processedAt: timestamp('processed_at'),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Jobs table for background processing (PostgreSQL)
export const jobs = pgTable('jobs', {
  id: serial('id').primaryKey(),
  type: varchar('type', { length: 100 }).notNull(), // 'image_generation', 'video_generation', etc.
  projectId: integer('project_id').references(() => projects.id).notNull(),
  userId: integer('user_id').references(() => users.id).notNull(),
  status: jobStatusEnum('status').default('pending').notNull(),
  priority: integer('priority').default(0).notNull(),
  progress: integer('progress').default(0).notNull(),
  data: text('data'), // JSON string with job parameters
  result: text('result'), // JSON string with job results
  errorMessage: text('error_message'),
  retryCount: integer('retry_count').default(0).notNull(),
  maxRetries: integer('max_retries').default(3).notNull(),
  processingStartedAt: timestamp('processing_started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Manual Zod schemas (compatible with Drizzle - Production compatible)
export const insertUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  profileImageUrl: z.string().optional(),
  credits: z.number().min(0).default(5),
  isAdmin: z.boolean().default(false),
  stripeCustomerId: z.string().optional(),
  stripeSubscriptionId: z.string().optional(),
});

// Client-side project creation schema (excludes server-managed fields)
export const createProjectInputSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  productImageUrl: z.string(),
  sceneImageUrl: z.string().optional(),
  sceneVideoUrl: z.string().optional(),
  contentType: z.enum(['image', 'video']),
  videoDurationSeconds: z.number().min(5).max(10).default(5),
  resolution: z.string().default('1024x1024'),
  quality: z.string().default('standard'),
  includeAudio: z.boolean().default(false),
});

// Full insert schema for database operations
export const insertProjectSchema = z.object({
  userId: z.number(),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  productImageUrl: z.string(),
  sceneImageUrl: z.string().optional(),
  sceneVideoUrl: z.string().optional(),
  contentType: z.enum(['image', 'video']),
  videoDurationSeconds: z.number().min(5).max(10).default(5),
  status: z.enum(['pending', 'processing', 'enhancing_prompt', 'generating_image', 'generating_video', 'completed', 'failed']).default('pending'),
  progress: z.number().min(0).max(100).default(0),
  enhancedPrompt: z.string().optional(),
  outputImageUrl: z.string().optional(),
  outputVideoUrl: z.string().optional(),
  creditsUsed: z.number().min(0),
  actualCost: z.number().min(0).default(0),
  resolution: z.string().default('1024x1024'),
  quality: z.string().default('standard'),
  errorMessage: z.string().optional(),
  klingVideoTaskId: z.string().optional(),
  klingSoundTaskId: z.string().optional(),
  includeAudio: z.boolean().default(false),
  fullTaskDetails: z.string().optional(), // JSON string
});

export const insertTransactionSchema = z.object({
  userId: z.number(),
  amount: z.string().regex(/^\d+\.\d{2}$/), // decimal string format
  credits: z.number().min(1),
  stripePaymentIntentId: z.string().optional(),
  status: z.enum(['pending', 'completed', 'failed']).default('pending'),
  processedAt: z.date().optional(),
});

// Client-side job creation schema (minimal fields)
export const createJobInputSchema = z.object({
  type: z.string().min(1),
  projectId: z.number(),
  userId: z.number(),
  priority: z.number().min(0).default(0),
  data: z.string().optional(), // JSON string
});

// Full insert schema for database operations
export const insertJobSchema = z.object({
  type: z.string().min(1),
  projectId: z.number(),
  userId: z.number(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']).default('pending'),
  priority: z.number().min(0).default(0),
  progress: z.number().min(0).max(100).default(0),
  data: z.string().optional(), // JSON string
  result: z.string().optional(), // JSON string
  errorMessage: z.string().optional(),
  retryCount: z.number().min(0).default(0),
  maxRetries: z.number().min(1).default(3),
  processingStartedAt: z.date().optional(),
  completedAt: z.date().optional(),
});

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = z.infer<typeof insertUserSchema>;

export type Project = typeof projects.$inferSelect;
export type NewProject = z.infer<typeof insertProjectSchema>;
export type CreateProjectInput = z.infer<typeof createProjectInputSchema>;

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = z.infer<typeof insertTransactionSchema>;

export type Job = typeof jobs.$inferSelect;
export type NewJob = z.infer<typeof insertJobSchema>;
export type CreateJobInput = z.infer<typeof createJobInputSchema>;
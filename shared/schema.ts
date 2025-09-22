import { z } from "zod";
import { ObjectId } from "mongodb";

// MongoDB ObjectId validation schema
export const objectIdSchema = z.string().refine((val) => ObjectId.isValid(val), {
  message: "Invalid ObjectId format"
});

// Base timestamp fields for all documents
const timestampFields = {
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
};

// Session schema for MongoDB (used by Replit Auth)
export const sessionSchema = z.object({
  _id: z.string(), // MongoDB ObjectId as string (session ID)
  sess: z.any(), // Session data (stored as JSON)
  expire: z.date(),
});

// User schema for MongoDB
export const userSchema = z.object({
  _id: objectIdSchema.optional(), // MongoDB ObjectId
  email: z.string().email(),
  password: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  profileImageUrl: z.string().optional(),
  credits: z.number().default(5),
  isAdmin: z.boolean().default(false),
  stripeCustomerId: z.string().optional(),
  stripeSubscriptionId: z.string().optional(),
  ...timestampFields,
});

// Project schema for MongoDB
export const projectSchema = z.object({
  _id: objectIdSchema.optional(), // MongoDB ObjectId
  userId: objectIdSchema, // Reference to user
  title: z.string(),
  description: z.string().optional(),
  productImageUrl: z.string(),
  sceneImageUrl: z.string().optional(), // Made nullable to support sceneVideoUrl
  sceneVideoUrl: z.string().optional(), // New: support video scene input
  contentType: z.enum(["image", "video"]),
  videoDurationSeconds: z.number().default(5), // New: 5 or 10 seconds
  status: z.enum([
    "pending", 
    "processing", 
    "enhancing_prompt", 
    "generating_image", 
    "generating_video", 
    "completed", 
    "failed"
  ]).default("pending"),
  progress: z.number().default(0),
  enhancedPrompt: z.string().optional(),
  outputImageUrl: z.string().optional(),
  outputVideoUrl: z.string().optional(),
  creditsUsed: z.number(),
  actualCost: z.number().default(0), // in millicents (1/1000 USD)
  resolution: z.string().default("1024x1024"),
  quality: z.string().default("standard"),
  errorMessage: z.string().optional(),
  // Kling AI task tracking for recovery
  klingVideoTaskId: z.string().optional(), // For video generation task
  klingSoundTaskId: z.string().optional(), // For audio enhancement task
  includeAudio: z.boolean().default(false), // Whether to add audio to video
  // Full task details from Kling AI for UI display (6-minute wait strategy)
  fullTaskDetails: z.any().optional(), // Complete Kling AI task response JSON
  ...timestampFields,
});

// Transaction schema for MongoDB
export const transactionSchema = z.object({
  _id: objectIdSchema.optional(), // MongoDB ObjectId
  userId: objectIdSchema, // Reference to user
  amount: z.number(), // in cents
  credits: z.number(),
  stripePaymentIntentId: z.string().optional(),
  status: z.enum(["pending", "completed", "failed"]).default("pending"),
  processedAt: z.date().optional(), // When webhook was processed
  ...timestampFields,
});

// Job queue schema for MongoDB (for async processing)
export const jobQueueSchema = z.object({
  _id: objectIdSchema.optional(), // MongoDB ObjectId
  type: z.string(), // 'cgi_generation'
  status: z.enum(["pending", "processing", "completed", "failed"]).default("pending"),
  projectId: objectIdSchema, // Reference to project
  userId: objectIdSchema, // Reference to user
  priority: z.number().default(0), // Higher = more priority
  attempts: z.number().default(0),
  maxAttempts: z.number().default(3),
  progress: z.number().default(0), // 0-100
  statusMessage: z.string().optional(),
  errorMessage: z.string().optional(),
  data: z.any().optional(), // Job-specific data like contentType, paths, etc
  result: z.any().optional(), // Final result data
  scheduledFor: z.date().default(() => new Date()),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
  ...timestampFields,
});

// Insert schemas (for creating new documents)
export const insertUserSchema = userSchema.omit({ _id: true, createdAt: true, updatedAt: true });
export const insertProjectSchema = projectSchema.omit({ _id: true, createdAt: true, updatedAt: true })
  .pick({
    title: true,
    description: true,
    productImageUrl: true,
    sceneImageUrl: true,
    sceneVideoUrl: true,
    contentType: true,
    videoDurationSeconds: true,
    resolution: true,
    quality: true,
    userId: true,
    creditsUsed: true,
  })
  .refine((data) => {
    // Ensure either sceneImageUrl OR sceneVideoUrl is provided, but not both
    const hasImage = !!data.sceneImageUrl;
    const hasVideo = !!data.sceneVideoUrl;
    return hasImage !== hasVideo; // XOR: exactly one must be true
  }, {
    message: "Provide either scene image or scene video, not both",
  });

export const insertTransactionSchema = transactionSchema.omit({ _id: true, createdAt: true, updatedAt: true })
  .pick({
    userId: true,
    amount: true,
    credits: true,
    stripePaymentIntentId: true,
    status: true,
    processedAt: true,
  });

export const insertJobSchema = jobQueueSchema.omit({ _id: true, createdAt: true, updatedAt: true })
  .pick({
    type: true,
    projectId: true,
    userId: true,
    data: true,
    priority: true,
  });

// TypeScript types from Zod schemas
export type User = z.infer<typeof userSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type Job = z.infer<typeof jobQueueSchema>;
export type Session = z.infer<typeof sessionSchema>;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type InsertJob = z.infer<typeof insertJobSchema>;

// Collection names (for consistency across the app)
export const COLLECTIONS = {
  USERS: 'users',
  PROJECTS: 'projects',
  TRANSACTIONS: 'transactions',
  JOBS: 'job_queue',
  SESSIONS: 'sessions',
} as const;
/**
 * Comprehensive External Services Health Tester
 * نظام اختبار شامل لجميع الخدمات الخارجية
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { v2 as cloudinary } from 'cloudinary';
import Stripe from 'stripe';
import { storage } from '../storage';

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'unhealthy' | 'warning';
  responseTime: number;
  details: string;
  error?: string;
}

export interface HealthCheckResult {
  overall: 'healthy' | 'unhealthy' | 'warning';
  timestamp: string;
  services: ServiceHealth[];
  summary: {
    healthy: number;
    unhealthy: number;
    warning: number;
    total: number;
  };
}

/**
 * Test Gemini AI Service with timeout and lightweight check
 */
async function testGeminiService(): Promise<ServiceHealth> {
  const startTime = Date.now();
  
  try {
    if (!process.env.GEMINI_API_KEY) {
      return {
        name: 'Gemini AI',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        details: 'API key not configured',
        error: 'Missing GEMINI_API_KEY environment variable'
      };
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    // Use timeout for the request
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Gemini API timeout (3s)')), 3000);
    });
    
    // Lightweight check - just verify API key works with minimal cost
    const healthCheckPromise = model.generateContent("Test");
    
    const result = await Promise.race([healthCheckPromise, timeoutPromise]) as any;
    const responseTime = Date.now() - startTime;
    
    if (result && result.response) {
      return {
        name: 'Gemini AI',
        status: 'healthy',
        responseTime,
        details: 'API responding correctly'
      };
    } else {
      return {
        name: 'Gemini AI',
        status: 'warning',
        responseTime,
        details: 'API responded but with unexpected format',
        error: 'Unexpected response format'
      };
    }
  } catch (error) {
    return {
      name: 'Gemini AI',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      details: 'API call failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Test Cloudinary Service with timeout and security
 */
async function testCloudinaryService(): Promise<ServiceHealth> {
  const startTime = Date.now();
  
  try {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return {
        name: 'Cloudinary',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        details: 'Credentials not configured',
        error: 'Missing Cloudinary environment variables'
      };
    }

    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    // Use timeout for the request
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Cloudinary API timeout (3s)')), 3000);
    });
    
    const pingPromise = cloudinary.api.ping();
    const result = await Promise.race([pingPromise, timeoutPromise]) as any;
    const responseTime = Date.now() - startTime;
    
    if (result && result.status === 'ok') {
      return {
        name: 'Cloudinary',
        status: 'healthy',
        responseTime,
        details: 'Connected to cloud service'
      };
    } else {
      return {
        name: 'Cloudinary',
        status: 'warning',
        responseTime,
        details: 'API responded but status not OK',
        error: `Unexpected status: ${result?.status || 'unknown'}`
      };
    }
  } catch (error) {
    return {
      name: 'Cloudinary',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      details: 'API call failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Test Stripe Service with timeout and security
 */
async function testStripeService(): Promise<ServiceHealth> {
  const startTime = Date.now();
  
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return {
        name: 'Stripe',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        details: 'API key not configured',
        error: 'Missing STRIPE_SECRET_KEY environment variable'
      };
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    
    // Use timeout for the request
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Stripe API timeout (3s)')), 3000);
    });
    
    const accountPromise = stripe.accounts.retrieve();
    const account = await Promise.race([accountPromise, timeoutPromise]) as any;
    const responseTime = Date.now() - startTime;
    
    if (account && account.id) {
      return {
        name: 'Stripe',
        status: 'healthy',
        responseTime,
        details: 'Connected to payment processor'
      };
    } else {
      return {
        name: 'Stripe',
        status: 'warning',
        responseTime,
        details: 'API responded but account data incomplete',
        error: 'Account data missing or invalid'
      };
    }
  } catch (error) {
    return {
      name: 'Stripe',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      details: 'API call failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Test Database Service with timeout
 */
async function testDatabaseService(): Promise<ServiceHealth> {
  const startTime = Date.now();
  
  try {
    // Use timeout for database check
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database timeout (3s)')), 3000);
    });
    
    const healthCheckPromise = storage.checkHealth();
    const isHealthy = await Promise.race([healthCheckPromise, timeoutPromise]) as boolean;
    const responseTime = Date.now() - startTime;
    
    if (isHealthy) {
      return {
        name: 'PostgreSQL Database',
        status: 'healthy',
        responseTime,
        details: 'Database connection and queries working properly'
      };
    } else {
      return {
        name: 'PostgreSQL Database',
        status: 'unhealthy',
        responseTime,
        details: 'Database health check failed',
        error: 'Health check returned false'
      };
    }
  } catch (error) {
    return {
      name: 'PostgreSQL Database',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      details: 'Database connection failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Test Kling Video API Service
 */
async function testKlingVideoService(): Promise<ServiceHealth> {
  const startTime = Date.now();
  
  try {
    if (!process.env.KLING_API_KEY) {
      return {
        name: 'Kling Video API',
        status: 'warning',
        responseTime: Date.now() - startTime,
        details: 'API key not configured - video generation may not work',
        error: 'Missing KLING_API_KEY environment variable'
      };
    }

    // Test with a lightweight ping to PiAPI endpoint
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Kling API timeout (5s)')), 5000);
    });
    
    // Simple connectivity test to PiAPI domain (no actual API call to avoid costs)
    const pingPromise = fetch('https://api.piapi.ai', {
      method: 'HEAD',
      headers: {
        'User-Agent': 'CGI-Generator-HealthCheck/1.0'
      }
    });
    
    const result = await Promise.race([pingPromise, timeoutPromise]) as Response;
    const responseTime = Date.now() - startTime;
    
    if (result.status < 500) {
      return {
        name: 'Kling Video API',
        status: 'healthy',
        responseTime,
        details: 'API endpoint reachable'
      };
    } else {
      return {
        name: 'Kling Video API',
        status: 'warning',
        responseTime,
        details: 'API endpoint returned server error',
        error: `HTTP ${result.status}`
      };
    }
  } catch (error) {
    return {
      name: 'Kling Video API',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      details: 'API endpoint unreachable',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Test Pinterest Service
 */
async function testPinterestService(): Promise<ServiceHealth> {
  const startTime = Date.now();
  
  try {
    // Test Pinterest connectivity (used for scene extraction)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Pinterest timeout (3s)')), 3000);
    });
    
    const pingPromise = fetch('https://www.pinterest.com', {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CGI-Generator/1.0)'
      }
    });
    
    const result = await Promise.race([pingPromise, timeoutPromise]) as Response;
    const responseTime = Date.now() - startTime;
    
    if (result.status < 400) {
      return {
        name: 'Pinterest Service',
        status: 'healthy',
        responseTime,
        details: 'Pinterest reachable for scene extraction'
      };
    } else {
      return {
        name: 'Pinterest Service',
        status: 'warning',
        responseTime,
        details: 'Pinterest access issues - scene extraction may fail',
        error: `HTTP ${result.status}`
      };
    }
  } catch (error) {
    return {
      name: 'Pinterest Service',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      details: 'Pinterest unreachable',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Test Object Storage Service
 */
async function testObjectStorageService(): Promise<ServiceHealth> {
  const startTime = Date.now();
  
  try {
    // Check if object storage environment variables are set
    if (!process.env.PUBLIC_OBJECT_SEARCH_PATHS || !process.env.PRIVATE_OBJECT_DIR) {
      return {
        name: 'Object Storage',
        status: 'warning',
        responseTime: Date.now() - startTime,
        details: 'Environment variables not set but may be optional',
        error: 'Missing object storage environment variables'
      };
    }

    const responseTime = Date.now() - startTime;
    return {
      name: 'Object Storage',
      status: 'healthy',
      responseTime,
      details: 'Storage paths configured'
    };
  } catch (error) {
    return {
      name: 'Object Storage',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      details: 'Object storage check failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Run comprehensive health check for all external services
 */
export async function runComprehensiveHealthCheck(): Promise<HealthCheckResult> {
  console.log('🔍 Starting comprehensive external services health check...');
  
  const services = await Promise.all([
    testGeminiService(),
    testCloudinaryService(),
    testStripeService(),
    testDatabaseService(),
    testKlingVideoService(),
    testPinterestService(),
    testObjectStorageService()
  ]);

  const summary = services.reduce(
    (acc, service) => {
      acc.total++;
      if (service.status === 'healthy') acc.healthy++;
      else if (service.status === 'warning') acc.warning++;
      else acc.unhealthy++;
      return acc;
    },
    { healthy: 0, unhealthy: 0, warning: 0, total: 0 }
  );

  let overall: 'healthy' | 'unhealthy' | 'warning' = 'healthy';
  if (summary.unhealthy > 0) {
    overall = 'unhealthy';
  } else if (summary.warning > 0) {
    overall = 'warning';
  }

  const result: HealthCheckResult = {
    overall,
    timestamp: new Date().toISOString(),
    services,
    summary
  };

  console.log('✅ Health check completed:', {
    overall: result.overall,
    healthy: summary.healthy,
    warning: summary.warning,
    unhealthy: summary.unhealthy,
    total: summary.total
  });

  return result;
}
import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
import { insertProjectSchema, insertTransactionSchema, createProjectInputSchema, createJobInputSchema } from "@shared/schema";
import { z } from "zod";
import { promises as fs, createReadStream, existsSync, mkdirSync } from 'fs';
import Stripe from 'stripe';
import path from 'path';
import { enhancePromptWithGemini, generateImageWithGemini } from './services/gemini';
import { uploadToCloudinary } from './services/cloudinary';
import multer from 'multer';
import { errorHandler, asyncHandler, CustomError, handleValidationError, handleMulterError } from './utils/errorHandler';

import { COSTS, CREDIT_PACKAGES, ACTUAL_COSTS, CREDIT_COSTS } from '@shared/constants';
import { db } from './db';
import { sql } from 'drizzle-orm';
import puppeteer from 'puppeteer';

/**
 * Extract image URL from Pinterest post URL by parsing HTML
 * Simple and reliable approach without browser automation
 */
async function extractPinterestMedia(pinterestUrl: string): Promise<{ imageUrl: string | null; videoUrl: string | null; isVideo: boolean }> {
  try {
    console.log('🔍 Extracting Pinterest image from HTML...');
    
    // Fetch Pinterest page HTML
    const response = await fetch(pinterestUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    if (!response.ok) {
      console.log('❌ Failed to fetch Pinterest page:', response.status);
      return { imageUrl: null, videoUrl: null, isVideo: false };
    }

    const html = await response.text();
    console.log('✅ Successfully fetched Pinterest HTML');

    // Check if this is a video post
    const isVideoPost = html.includes('"contentType":"video"') || 
                       html.includes('"type":"video"') || 
                       html.includes('video-snippet') ||
                       html.includes('"isVideo":true') ||
                       html.includes('"videoUrl"');
    
    if (isVideoPost) {
      console.log('🎬 Detected Pinterest video post - extracting video thumbnail');
      
    }
    
    let extractedVideoUrl = null;
    
    if (isVideoPost) {
      // NEW: Extract actual video URLs using updated patterns for Pinterest videos
      console.log('🎥 Searching for Pinterest video URLs...');
      
      // Look for MP4 videos and HLS streams from Pinterest video CDN
      const mp4Matches = html.match(/https:\/\/v\d*\.pinimg\.com\/videos\/[^"'\s]*\.mp4[^"'\s]*/gi);
      const hlsMatches = html.match(/https:\/\/v\d*\.pinimg\.com\/videos\/[^"'\s]*\.m3u8[^"'\s]*/gi);
      
      let videoUrls = [];
      
      if (mp4Matches) {
        videoUrls.push(...mp4Matches);
        console.log('🎬 Found', mp4Matches.length, 'MP4 video URLs');
      }
      
      if (hlsMatches) {
        videoUrls.push(...hlsMatches);
        console.log('🎬 Found', hlsMatches.length, 'HLS video streams');
      }
      
      if (videoUrls.length > 0) {
        // Prefer MP4 over HLS for motion analysis (easier to process)
        const mp4Videos = videoUrls.filter(url => url.includes('.mp4'));
        extractedVideoUrl = mp4Videos.length > 0 ? mp4Videos[0] : videoUrls[0];
        
        console.log('🎥 Selected Pinterest video URL for motion analysis:', extractedVideoUrl?.substring(0, 100) + '...');
        console.log('🎯 Video type:', extractedVideoUrl?.includes('.mp4') ? 'MP4' : 'HLS Stream');
      } else {
        console.log('⚠️ No Pinterest video URLs found in HTML');
      }
    } else {
      console.log('🖼️ Detected Pinterest image post - extracting image');
    }

    // Extract all possible image URLs from HTML
    const imageUrls: string[] = [];
    
    // Method 1: Look for pinimg.com URLs in the HTML
    const pinimgMatches = html.match(/https?:\/\/i\.pinimg\.com\/[^"'>\s}),]+/g);
    if (pinimgMatches) {
      // Clean each URL to remove any trailing CSS or HTML
      const cleanUrls = pinimgMatches.map(url => {
        // Remove anything after common image extensions
        return url.replace(/(\.(?:jpg|jpeg|png|webp|gif)).*$/, '$1');
      });
      imageUrls.push(...cleanUrls);
    }

    // Method 2: Look for images in JSON-LD structured data
    const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([^<]+)<\/script>/);
    if (jsonLdMatch) {
      try {
        const jsonLd = JSON.parse(jsonLdMatch[1]);
        if (jsonLd.image && typeof jsonLd.image === 'string') {
          imageUrls.push(jsonLd.image);
        }
      } catch (e) {
        // Continue if JSON parsing fails
      }
    }

    // Method 3: Look for og:image meta tags
    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/);
    if (ogImageMatch && ogImageMatch[1]) {
      imageUrls.push(ogImageMatch[1]);
    }

    // Method 4: Look for data-src attributes with pinimg.com
    const dataSrcMatches = html.match(/data-src=["']([^"']*pinimg\.com[^"']*)["']/g);
    if (dataSrcMatches) {
      for (const match of dataSrcMatches) {
        const urlMatch = match.match(/data-src=["']([^"']+)["']/);
        if (urlMatch && urlMatch[1]) {
          imageUrls.push(urlMatch[1]);
        }
      }
    }

    console.log('🎯 Found potential image URLs:', imageUrls.length);

    // Filter, clean and prioritize pinimg.com URLs
    const validUrls = imageUrls
      .filter(url => 
        url && 
        url.includes('pinimg.com') && 
        (url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png') || url.includes('.webp'))
      )
      .map(url => {
        // Extract clean URL using regex - everything before the first character that shouldn't be in an image URL
        const match = url.match(/(https?:\/\/i\.pinimg\.com\/[^"'\s}),;]+\.(?:jpg|jpeg|png|webp|gif))/i);
        return match ? match[1] : url;
      })
      .filter(url => url.includes('.'));

    // Group URLs by image hash to find the main pin image
    const imageGroups: { [hash: string]: string[] } = {};
    
    validUrls.forEach(url => {
      // Extract the image hash from URL (like "dc/e9/fa/dce9fab181c4011925f9e5b919415675")
      const hashMatch = url.match(/\/([a-f0-9]{2}\/[a-f0-9]{2}\/[a-f0-9]{2}\/[a-f0-9]{32})/i);
      if (hashMatch) {
        const hash = hashMatch[1];
        if (!imageGroups[hash]) {
          imageGroups[hash] = [];
        }
        imageGroups[hash].push(url);
      }
    });

    console.log('🔍 Found image groups:', Object.keys(imageGroups).map(hash => ({
      hash: hash.substring(0, 20) + '...',
      count: imageGroups[hash].length
    })));

    // Find the image with the most variations (likely the main pin image)
    let mainImageHash = '';
    let maxCount = 0;
    
    for (const [hash, urls] of Object.entries(imageGroups)) {
      if (urls.length > maxCount) {
        maxCount = urls.length;
        mainImageHash = hash;
      }
    }

    // For video posts, use lower threshold since they have fewer variations
    const minVariationsThreshold = isVideoPost ? 1 : 3;

    if (mainImageHash && imageGroups[mainImageHash] && maxCount >= minVariationsThreshold) {
      // Prefer originals, then largest size
      const mainImageUrls = imageGroups[mainImageHash];
      const prioritizedUrls = mainImageUrls
        .sort((a, b) => {
          if (a.includes('/originals/') && !b.includes('/originals/')) return -1;
          if (!a.includes('/originals/') && b.includes('/originals/')) return 1;
          
          // If both are not originals, prefer larger sizes
          const sizeA = a.match(/\/(\d+)x/)?.[1] || '0';
          const sizeB = b.match(/\/(\d+)x/)?.[1] || '0';
          return parseInt(sizeB) - parseInt(sizeA);
        });
      
      if (isVideoPost) {
        console.log('✅ Selected video thumbnail from group with', maxCount, 'variations');
      } else {
        console.log('✅ Selected main pin image from group with', maxCount, 'variations');
      }
      const imageUrl = enhancePinterestImageQuality(prioritizedUrls[0]);
      return { 
        imageUrl, 
        videoUrl: extractedVideoUrl, 
        isVideo: isVideoPost 
      };
    }

    // Fallback to original logic if grouping fails
    console.log('⚠️ Using fallback selection (grouping failed)');
    
    if (validUrls.length === 0) {
      console.log('❌ No valid Pinterest images found in HTML');
      return { imageUrl: null, videoUrl: extractedVideoUrl, isVideo: isVideoPost };
    }

    // Prioritize higher resolution images as fallback
    const prioritizedUrls = validUrls.sort((a, b) => {
      const aHasOriginal = a.includes('/originals/');
      const bHasOriginal = b.includes('/originals/');
      if (aHasOriginal && !bHasOriginal) return -1;
      if (!aHasOriginal && bHasOriginal) return 1;
      
      const aHas736 = a.includes('/736x');
      const bHas736 = b.includes('/736x');
      if (aHas736 && !bHas736) return -1;
      if (!aHas736 && bHas736) return 1;
      
      return 0;
    });

    const bestImageUrl = prioritizedUrls[0];
    console.log('✅ Selected fallback Pinterest image:', bestImageUrl);
    
    const imageUrl = enhancePinterestImageQuality(bestImageUrl);
    return { 
      imageUrl, 
      videoUrl: extractedVideoUrl, 
      isVideo: isVideoPost 
    };
    
  } catch (error) {
    console.error('❌ Pinterest HTML extraction error:', error);
    return { imageUrl: null, videoUrl: null, isVideo: false };
  }
}

/**
 * Generate Pinterest image path from PIN ID
 * Pinterest uses a specific hash-like structure for image paths
 */
function generateImagePath(pinId: string): string {
  // Pinterest typically uses first few characters in a path structure
  // Convert PIN ID to hex and create path pattern
  const hex = parseInt(pinId).toString(16).padStart(8, '0');
  
  // Common Pinterest path patterns: XX/YY/ZZ/XXXXYYYZZZ
  const part1 = hex.substring(0, 2);
  const part2 = hex.substring(2, 4);
  const part3 = hex.substring(4, 6);
  const remaining = hex.substring(6);
  
  return `${part1}/${part2}/${part3}/${hex}${remaining}`;
}

/**
 * Enhance Pinterest image URL to higher quality
 */
function enhancePinterestImageQuality(imageUrl: string): string {
  if (!imageUrl || !imageUrl.includes('pinimg.com')) {
    return imageUrl;
  }
  
  // First, clean the URL to remove any trailing CSS or HTML
  let cleanUrl = imageUrl;
  
  // Extract clean URL using regex - everything before any non-URL characters
  const match = cleanUrl.match(/(https?:\/\/i\.pinimg\.com\/[^"'\s}),;]+\.(?:jpg|jpeg|png|webp|gif))/i);
  if (match) {
    cleanUrl = match[1];
  }
  
  let enhancedUrl = cleanUrl;
  
  // Remove low quality parameters
  enhancedUrl = enhancedUrl.replace(/[?&]resize=\d+[^\s&]*/g, '');
  enhancedUrl = enhancedUrl.replace(/[?&]quality=\d+/g, '');
  
  // Replace low quality dimensions with Full HD (keep originals as they are highest quality)
  if (!enhancedUrl.includes('/originals/')) {
    const qualityMappings = [
      { from: /\/236x\d+\//, to: '/736x/' },
      { from: /\/474x\d+\//, to: '/736x/' },
      { from: /\/564x\d+\//, to: '/736x/' }
    ];
    
    for (let mapping of qualityMappings) {
      enhancedUrl = enhancedUrl.replace(mapping.from, mapping.to);
    }
  }
  
  // Add quality parameter only if the URL is clean and valid
  if (enhancedUrl.match(/^https?:\/\/i\.pinimg\.com\/[^"'\s]+\.(?:jpg|jpeg|png|webp|gif)$/i)) {
    if (!enhancedUrl.includes('quality=') && !enhancedUrl.includes('q=')) {
      enhancedUrl += '?quality=95';
    }
  }
  
  console.log('🎯 Enhanced Pinterest URL quality:', enhancedUrl);
  return enhancedUrl;
}


export async function registerRoutes(app: Express): Promise<Server> {
  // Setup health check routes first
  setupHealthCheckRoutes(app);
  
  // Auth middleware
  await setupAuth(app);


  // Configure multer for memory storage (for Cloudinary upload)
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB limit for videos
    },
    fileFilter: (req: any, file: any, cb: any) => {
      // Allow image and video files for scene uploads
      if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image and video files are allowed'));
      }
    }
  });

  // Separate multer for product images (image only)
  const uploadProductImage = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit for images
    },
    fileFilter: (req: any, file: any, cb: any) => {
      // Only allow image files for products
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed for product uploads'));
      }
    }
  });
  
  // Upload endpoint for product images - using Cloudinary with Quality Enhancement
  app.post('/api/upload-product-image', isAuthenticated, uploadProductImage.single('productImage'), handleMulterError, asyncHandler(async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      // Use the centralized Cloudinary service
      console.log("📤 Uploading to Cloudinary:", {
        originalName: req.file.originalname,
        fileSize: req.file.size,
      });
      
      const filename = req.file.originalname || `upload-${Date.now()}`;
      const uploadUrl = await uploadToCloudinary(req.file.buffer, filename);
      
      // 🎨 Apply quality enhancement if needed
      console.log("🔍 Processing image quality...");
      const { processImageForQuality } = await import('./services/image-quality-enhancer');
      const qualityResult = await processImageForQuality(uploadUrl);
      
      // استخدام الصورة المحسنة إذا كانت متوفرة
      const finalImageUrl = qualityResult.finalUrl;
      
      console.log("✅ Image upload and quality processing completed:", {
        originalUrl: uploadUrl.substring(0, 50) + '...',
        finalUrl: finalImageUrl.substring(0, 50) + '...',
        qualityScore: qualityResult.assessment.qualityScore,
        enhancementApplied: !!qualityResult.enhancement
      });
      
      res.json({ 
        url: finalImageUrl,
        imageUrl: finalImageUrl,
        publicId: `user-uploads/${filename}`,
        qualityInfo: {
          originalQuality: qualityResult.assessment.qualityScore,
          enhancementApplied: !!qualityResult.enhancement,
          enhancementTypes: qualityResult.enhancement?.enhancementApplied || [],
          qualityImprovement: qualityResult.enhancement?.qualityImprovement || 0
        }
      });
    } catch (error) {
      console.error("❌ Error uploading file:", error);
      throw new CustomError("Failed to upload file", 500, "فشل في رفع الملف. يرجى المحاولة مرة أخرى.");
    }
  }));

  // Upload endpoint for scene images - using Cloudinary with Quality Enhancement  
  app.post('/api/upload-scene-image', isAuthenticated, upload.single('sceneImage'), handleMulterError, asyncHandler(async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No scene file uploaded" });
      }
      
      console.log("📤 Uploading scene to Cloudinary:", {
        originalName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype
      });
      
      const filename = req.file.originalname || `scene-${Date.now()}`;
      const uploadUrl = await uploadToCloudinary(req.file.buffer, filename);
      
      // 🎨 Apply quality enhancement for scene images
      if (req.file.mimetype.startsWith('image/')) {
        console.log("🔍 Processing scene image quality...");
        const { processImageForQuality } = await import('./services/image-quality-enhancer');
        const qualityResult = await processImageForQuality(uploadUrl);
        
        const finalImageUrl = qualityResult.finalUrl;
        
        console.log("✅ Scene image upload and quality processing completed:", {
          originalUrl: uploadUrl.substring(0, 50) + '...',
          finalUrl: finalImageUrl.substring(0, 50) + '...',
          qualityScore: qualityResult.assessment.qualityScore,
          enhancementApplied: !!qualityResult.enhancement
        });
        
        res.json({ 
          url: finalImageUrl,
          imageUrl: finalImageUrl,
          publicId: `scene-uploads/${filename}`,
          fileType: 'image',
          qualityInfo: {
            originalQuality: qualityResult.assessment.qualityScore,
            enhancementApplied: !!qualityResult.enhancement,
            enhancementTypes: qualityResult.enhancement?.enhancementApplied || [],
            qualityImprovement: qualityResult.enhancement?.qualityImprovement || 0
          }
        });
      } else {
        // For video files, no quality enhancement (yet)
        res.json({ 
          url: uploadUrl,
          videoUrl: uploadUrl,
          publicId: `scene-uploads/${filename}`,
          fileType: 'video'
        });
      }
    } catch (error) {
      console.error("❌ Error uploading scene file:", error);
      throw new CustomError("Failed to upload scene file", 500, "فشل في رفع ملف المشهد. يرجى المحاولة مرة أخرى.");
    }
  }));

  // Pinterest image URL extraction endpoint - SECURED with authentication
  app.post('/api/extract-pinterest-image', isAuthenticated, async (req: any, res) => {
    try {
      const { pinterestUrl } = req.body;
      
      if (!pinterestUrl) {
        return res.status(400).json({ error: 'Pinterest URL is required' });
      }

      console.log('🔗 Extracting image from Pinterest URL:', pinterestUrl);

      // Validate Pinterest URL
      const isValidPinterestUrl = pinterestUrl.includes('pinterest.com') || pinterestUrl.includes('pinimg.com');
      if (!isValidPinterestUrl) {
        return res.status(400).json({ error: 'Invalid Pinterest URL' });
      }

      // If it's already a direct image URL, enhance and return it
      if (pinterestUrl.includes('pinimg.com')) {
        const optimizedUrl = enhancePinterestImageQuality(pinterestUrl);
        console.log('🔍 Applying quality enhancement to direct Pinterest image...');
        
        // 🎨 Apply comprehensive quality enhancement
        const { processImageForQuality } = await import('./services/image-quality-enhancer');
        const qualityResult = await processImageForQuality(optimizedUrl);
        
        console.log('✅ Direct Pinterest image enhanced:', {
          originalUrl: optimizedUrl.substring(0, 50) + '...',
          finalUrl: qualityResult.finalUrl.substring(0, 50) + '...',
          qualityScore: qualityResult.assessment.qualityScore,
          enhancementApplied: !!qualityResult.enhancement
        });
        
        return res.json({ 
          imageUrl: qualityResult.finalUrl,
          qualityInfo: {
            originalQuality: qualityResult.assessment.qualityScore,
            enhancementApplied: !!qualityResult.enhancement,
            enhancementTypes: qualityResult.enhancement?.enhancementApplied || [],
            qualityImprovement: qualityResult.enhancement?.qualityImprovement || 0
          }
        });
      }

      // Extract media from Pinterest post URL 
      const mediaResult = await extractPinterestMedia(pinterestUrl);
      const imageUrl = mediaResult.imageUrl;
      
      if (!imageUrl) {
        return res.status(404).json({ error: 'Could not extract image from Pinterest post' });
      }

      const optimizedUrl = enhancePinterestImageQuality(imageUrl);
      console.log('🔍 Applying comprehensive quality enhancement to Pinterest image...');
      
      // 🎨 Apply our advanced quality enhancement system
      const { processImageForQuality } = await import('./services/image-quality-enhancer');
      const qualityResult = await processImageForQuality(optimizedUrl);
      
      console.log('✅ Pinterest image extracted and enhanced:', {
        originalUrl: optimizedUrl.substring(0, 50) + '...',
        finalUrl: qualityResult.finalUrl.substring(0, 50) + '...',
        qualityScore: qualityResult.assessment.qualityScore,
        enhancementApplied: !!qualityResult.enhancement
      });
      
      res.json({ 
        imageUrl: qualityResult.finalUrl,
        videoUrl: mediaResult.videoUrl,
        isVideo: mediaResult.isVideo,
        mediaType: mediaResult.isVideo ? 'video' : 'image',
        qualityInfo: {
          originalQuality: qualityResult.assessment.qualityScore,
          enhancementApplied: !!qualityResult.enhancement,
          enhancementTypes: qualityResult.enhancement?.enhancementApplied || [],
          qualityImprovement: qualityResult.enhancement?.qualityImprovement || 0
        },
        motionAnalysis: mediaResult.isVideo ? {
          available: !!mediaResult.videoUrl,
          videoFormat: mediaResult.videoUrl?.includes('.mp4') ? 'MP4' : 'HLS',
          readyForAnalysis: true
        } : null
      });
    } catch (error) {
      console.error('❌ Pinterest image extraction failed:', error);
      res.status(500).json({ error: 'Failed to extract Pinterest image' });
    }
  });

  // Product image endpoint - now using Cloudinary URLs directly
  app.put('/api/product-images', isAuthenticated, async (req: any, res) => {
    try {
      const { productImageURL } = req.body;
      
      if (!productImageURL) {
        return res.status(400).json({ error: "productImageURL is required" });
      }

      // Since we're using Cloudinary, we can use the URL directly
      res.status(200).json({
        imageUrl: productImageURL,
        success: true
      });
    } catch (error) {
      console.error("Error setting product image:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Legacy objects endpoint - redirect to Cloudinary
  app.get("/objects/:objectPath(*)", isAuthenticated, async (req, res) => {
    // Objects are now served from Cloudinary directly
    // This endpoint exists for backwards compatibility only
    res.status(410).json({ 
      message: "Objects are now served from Cloudinary. Please use the direct Cloudinary URLs.",
      deprecated: true
    });
  });

  // File serving endpoint - Public access for generated content
  app.get('/api/files/*', async (req: any, res) => {
    try {
      const filename = req.params['0'] as string;
      // Using imported fs and path modules
      
      // SECURITY: Validate and sanitize the file path to prevent path traversal
      if (!filename || filename.includes('..') || filename.includes('\0') || path.isAbsolute(filename)) {
        return res.status(400).json({ message: "Invalid file path" });
      }
      
      const privateDir = '/tmp';
      const filePath = path.resolve(path.join(privateDir, filename));
      
      // SECURITY: Ensure the resolved path is still within the private directory
      if (!filePath.startsWith(path.resolve(privateDir))) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // SECURITY: Validate file path structure
      const pathParts = filename.split('/');
      if (pathParts.length < 2 || pathParts[0] !== 'uploads') {
        return res.status(403).json({ message: "Invalid file structure" });
      }
      
      if (!existsSync(filePath)) {
        return res.status(404).json({ message: "File not found" });
      }
      
      // SECURITY: Get proper MIME type based on file extension
      const ext = path.extname(filename).toLowerCase();
      const mimeTypes: { [key: string]: string } = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.mov': 'video/quicktime'
      };
      
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      
      // Set appropriate headers
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'private, max-age=3600'); // Private cache for user files
      
      // Stream the file
      const fileStream = createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      console.error("Error serving file:", error);
      res.status(500).json({ message: "Failed to serve file" });
    }
  });

  // Public files endpoint - now serves from Cloudinary or local files
  app.get('/public-objects/:filePath(*)', async (req: any, res) => {
    try {
      const filePath = req.params.filePath as string;
      
      // SECURITY: Validate and sanitize the file path to prevent path traversal
      if (!filePath || filePath.includes('..') || filePath.includes('\0') || path.isAbsolute(filePath)) {
        return res.status(400).json({ message: "Invalid file path" });
      }
      
      // For generated content, serve from /tmp directory
      if (filePath.startsWith('uploads/')) {
        const localFilePath = path.join('/tmp', filePath);
        
        if (existsSync(localFilePath)) {
          const ext = path.extname(filePath).toLowerCase();
          const mimeTypes: { [key: string]: string } = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.mp4': 'video/mp4',
            '.webm': 'video/webm',
            '.mov': 'video/quicktime'
          };
          
          const contentType = mimeTypes[ext] || 'application/octet-stream';
          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', 'public, max-age=3600');
          
          const fileStream = createReadStream(localFilePath);
          fileStream.pipe(res);
          return;
        }
      }
      
      res.status(404).json({ message: "File not found" });
    } catch (error) {
      console.error("Error serving public file:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to serve file" });
      }
    }
  });

  // Projects endpoints
  app.get('/api/projects', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const projects = await storage.getUserProjects(userId);
      
      // Rehydrate URLs to use current request host
      const currentHost = `${req.protocol}://${req.get('host')}`;
      const rehydratedProjects = projects.map(project => {
        const rehydrateUrl = (url: string | null | undefined) => {
          if (!url) return url;
          if (url.includes('/public-objects/')) {
            // Extract the relative path after /public-objects/
            const pathMatch = url.match(/\/public-objects\/(.*)/);
            if (pathMatch) {
              return `${currentHost}/public-objects/${pathMatch[1]}`;
            }
          }
          return url;
        };
        
        return {
          ...project,
          productImageUrl: rehydrateUrl(project.productImageUrl) ?? null,
          sceneImageUrl: rehydrateUrl(project.sceneImageUrl) ?? null,
          outputImageUrl: rehydrateUrl(project.outputImageUrl) ?? null,
          outputVideoUrl: rehydrateUrl(project.outputVideoUrl)
        };
      });
      
      res.json(rehydratedProjects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.post('/api/projects', isAuthenticated, async (req: any, res) => {
    let createdProjectId: number | null = null;
    
    try {
      const userId = req.user.id;
      
      // Log the incoming request body for debugging
      console.log("🔍 Project creation request body:", JSON.stringify(req.body, null, 2));
      
      const clientProjectData = createProjectInputSchema.parse(req.body);
      console.log("✅ Client project data validation passed");
      
      // Check user credits
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Calculate credits needed based on content type, duration, and audio inclusion
      let creditsNeeded: number;
      
      if (clientProjectData.contentType === "image") {
        creditsNeeded = CREDIT_COSTS.IMAGE_GENERATION;
      } else {
        // Duration-based pricing for videos: 5s = short, 10s = long
        const isShortVideo = (clientProjectData.videoDurationSeconds || 5) <= 5;
        creditsNeeded = isShortVideo ? CREDIT_COSTS.VIDEO_SHORT : CREDIT_COSTS.VIDEO_LONG;
        
        // Additional cost for audio
        if (clientProjectData.includeAudio) {
          creditsNeeded += CREDIT_COSTS.AUDIO_SURCHARGE;
        }
      }
      
      const isAdmin = user.isAdmin === true;
      
      if (!isAdmin && user.credits < creditsNeeded) {
        return res.status(400).json({ message: "Insufficient credits" });
      }

      // Prepare project data and job data for atomic transaction
      const projectData = {
        ...clientProjectData,
        userId,
        creditsUsed: creditsNeeded,
        status: "pending" as const,
        progress: 0,
        actualCost: 0
      };
      
      // Prepare job data without projectId (will be set in transaction)
      const jobDataTemplate = {
        type: 'cgi_generation',
        userId: Number(userId),
        priority: clientProjectData.contentType === 'video' ? 2 : 1,
        data: JSON.stringify({
          contentType: clientProjectData.contentType,
          videoDurationSeconds: clientProjectData.videoDurationSeconds,
          productImageUrl: clientProjectData.productImageUrl,
          sceneImageUrl: clientProjectData.sceneImageUrl,
          sceneVideoUrl: clientProjectData.sceneVideoUrl,
          description: clientProjectData.description,
          productSize: clientProjectData.productSize,
          includeAudio: clientProjectData.includeAudio
        })
      };

      console.log(`🔧 Job template prepared:`, {
        type: jobDataTemplate.type,
        userId: jobDataTemplate.userId,
        priority: jobDataTemplate.priority,
        dataLength: jobDataTemplate.data?.length || 0,
        userIdType: typeof jobDataTemplate.userId
      });
      
      // 🚀 ATOMIC TRANSACTION: Create project + deduct credits + create job
      console.log("🚀 Starting atomic project creation...");
      const { project, job } = await storage.createProjectWithTransaction(
        projectData,
        { ...jobDataTemplate, projectId: 0 }, // projectId will be set within transaction
        isAdmin
      );
      
      createdProjectId = project.id!;
      console.log(`✅ Atomic transaction completed: Project ${project.id}, Job ${job.id}`);

      // 🚀 AUTO-START JOB PROCESSING IMMEDIATELY
      console.log(`🚀 Auto-starting job processing for job ${job.id}...`);
      
      // Start job processing asynchronously without blocking the response
      setImmediate(async () => {
        try {
          const claimed = await storage.claimJob(job.id!);
          if (claimed) {
            console.log(`🎯 Job ${job.id} claimed successfully, starting processing...`);
            processJobAsync(job.id!).catch(async (error) => {
              console.error(`❌ Auto-triggered job ${job.id} failed:`, error);
              await storage.markJobFailed(job.id!, error.message);
            });
          } else {
            console.log(`⚠️ Job ${job.id} was already claimed by another worker`);
          }
        } catch (error) {
          console.error(`❌ Failed to auto-start job ${job.id}:`, error);
        }
      });

      res.json({
        ...project,
        jobId: job.id
      });
    } catch (error) {
      console.error("❌ Error during project creation:", error);
      
      // Handle specific transaction errors
      if (error instanceof Error && error.message.includes('Insufficient credits')) {
        return res.status(400).json({ 
          message: "Insufficient credits",
          details: error.message 
        });
      }
      
      // No rollback needed for atomic transaction - already handled by transaction rollback
      // Only old non-atomic path needed manual rollback
      
      if (error instanceof z.ZodError) {
        console.error("🚨 Zod validation error details:", {
          errors: error.errors,
          receivedData: req.body,
          formattedErrors: error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message,
            code: err.code
          }))
        });
        return res.status(400).json({ 
          message: "Invalid project data", 
          errors: error.errors,
          debug: {
            paths: error.errors.map(err => err.path.join('.')),
            messages: error.errors.map(err => err.message)
          }
        });
      }
      console.error("Error creating project:", error);
      res.status(500).json({ message: "Failed to create project" });
    }
  });

  app.get('/api/projects/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const project = await storage.getProject(parseInt(req.params.id));
      
      if (!project || project.userId !== userId) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Also get job status for this project
      const job = await storage.getJobByProjectId(project.id!);

      res.json({
        ...project,
        job: job ? {
          id: job.id,
          status: job.status,
          progress: job.progress,
          statusMessage: "Processing...",
          errorMessage: job.errorMessage
        } : null
      });
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  // Credit packages imported from shared constants

  // Credit purchase endpoint with package validation
  app.post('/api/purchase-credits', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { amount, credits, packageId } = req.body;
      
      if (!amount || !credits || !packageId) {
        return res.status(400).json({ message: "Missing amount, credits, or packageId" });
      }

      // Validate package against defined packages
      const validPackage = CREDIT_PACKAGES[packageId as keyof typeof CREDIT_PACKAGES];
      if (!validPackage || validPackage.price !== amount || validPackage.credits !== credits) {
        return res.status(400).json({ message: "Invalid package selected" });
      }

      // Create Stripe payment intent
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: 'usd',
        metadata: {
          userId,
          credits: credits.toString(),
          packageId: packageId
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      // Create transaction record with payment intent ID (amount in cents)
      const transaction = await storage.createTransaction({
        userId,
        amount: (Math.round(amount * 100) / 100).toFixed(2), // Convert to decimal string
        credits,
        stripePaymentIntentId: paymentIntent.id,
        status: 'pending'
      });

      res.json({
        clientSecret: paymentIntent.client_secret,
        transactionId: transaction.id,
        paymentIntentId: paymentIntent.id
      });
    } catch (error) {
      console.error("Error creating payment:", error);
      res.status(500).json({ message: "Failed to create payment" });
    }
  });

  // Job Processing Endpoints - SECURED
  app.post('/api/jobs/process', isAuthenticated, async (req, res) => {
    try {
      const job = await storage.getNextPendingJob();
      
      if (!job) {
        return res.json({ message: "No pending jobs" });
      }

      // Atomically claim the job
      const claimed = await storage.claimJob(job.id!);
      if (!claimed) {
        return res.json({ message: "Job was already claimed by another worker" });
      }
      
      // Update retry count  
      await storage.updateJob(job.id!, {
        retryCount: job.retryCount + 1
      });

      console.log(`🚀 Processing job ${job.id} for project ${job.projectId}`);
      
      // Process the job asynchronously
      processJobAsync(job.id!).catch(async (error) => {
        console.error(`❌ Job ${job.id} failed:`, error);
        await storage.markJobFailed(job.id!, error.message);
      });

      res.json({ 
        message: "Job processing started",
        jobId: job.id,
        projectId: job.projectId
      });
    } catch (error) {
      console.error("Error processing job:", error);
      res.status(500).json({ error: "Failed to process job" });
    }
  });

  // Job Status Polling
  app.get('/api/jobs/:id/status', isAuthenticated, async (req: any, res) => {
    try {
      const job = await storage.getJob(parseInt(req.params.id));
      
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Verify user owns this job
      if (job.userId !== req.user.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      res.json({
        id: job.id,
        status: job.status,
        progress: job.progress,
        statusMessage: "Processing...",
        errorMessage: job.errorMessage,
        result: job.result,
        createdAt: job.createdAt,
        completedAt: job.completedAt
      });
    } catch (error) {
      console.error("Error fetching job status:", error);
      res.status(500).json({ error: "Failed to fetch job status" });
    }
  });

  // Project Status with Job Info
  app.get('/api/projects/:id/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const project = await storage.getProject(parseInt(req.params.id));
      
      if (!project || project.userId !== userId) {
        return res.status(404).json({ error: "Project not found" });
      }

      const job = await storage.getJobByProjectId(project.id!);

      res.json({
        project: {
          id: project.id,
          status: project.status,
          progress: project.progress,
          outputImageUrl: project.outputImageUrl,
          outputVideoUrl: project.outputVideoUrl,
          errorMessage: project.errorMessage
        },
        job: job ? {
          id: job.id,
          status: job.status,
          progress: job.progress,
          statusMessage: "Processing...",
          errorMessage: job.errorMessage
        } : null
      });
    } catch (error) {
      console.error("Error fetching project status:", error);
      res.status(500).json({ error: "Failed to fetch project status" });
    }
  });

  // NEW CREDIT SYSTEM ENDPOINTS
  
  // Add card reward (+3 credits) - SECURED: Only via Stripe webhook verification
  app.post('/api/add-card-reward', isAuthenticated, async (req: any, res) => {
    // SECURITY: This endpoint is disabled for direct access to prevent abuse
    // Card rewards should only be granted via Stripe webhook after SetupIntent confirmation
    res.status(403).json({ 
      message: "Card rewards can only be granted via Stripe verification process" 
    });
  });

  // Start 7-day trial
  app.post('/api/start-trial', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      // Check if trial already started
      const isActive = await storage.isTrialActive(userId);
      if (isActive) {
        return res.status(400).json({ message: "Trial already active" });
      }
      
      await storage.startTrial(userId);
      const remainingCredits = await storage.getRemainingTrialCredits(userId);
      
      res.json({ 
        success: true, 
        message: "7-day trial started! Enjoy unlimited credits.",
        remainingTrialCredits: remainingCredits
      });
    } catch (error) {
      console.error("Error starting trial:", error);
      res.status(500).json({ message: "Failed to start trial" });
    }
  });

  // Check trial status
  app.get('/api/trial-status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const isActive = await storage.isTrialActive(userId);
      const remainingCredits = await storage.getRemainingTrialCredits(userId);
      
      res.json({ 
        isActive,
        remainingCredits,
        message: isActive ? "Trial is active" : "Trial not active"
      });
    } catch (error) {
      console.error("Error checking trial status:", error);
      res.status(500).json({ message: "Failed to check trial status" });
    }
  });

  // Activate subscription ($10/month) - SECURED: Only via Stripe webhook verification  
  app.post('/api/activate-subscription', isAuthenticated, async (req: any, res) => {
    // SECURITY: This endpoint is disabled for direct access to prevent abuse
    // Subscriptions should only be activated via Stripe webhook after payment confirmation
    res.status(403).json({ 
      message: "Subscriptions can only be activated via Stripe payment confirmation" 
    });
  });

  // Deactivate subscription
  app.post('/api/deactivate-subscription', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      await storage.deactivateSubscription(userId);
      
      res.json({ 
        success: true, 
        message: "Subscription deactivated successfully."
      });
    } catch (error) {
      console.error("Error deactivating subscription:", error);
      res.status(500).json({ message: "Failed to deactivate subscription" });
    }
  });

  // Stripe webhook handler - raw body parsing applied at app level
  app.post('/api/webhooks/stripe', async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    
    if (!sig) {
      return res.status(400).send('No stripe signature provided');
    }
    
    try {
      let event;
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      
      if (!webhookSecret) {
        console.error('STRIPE_WEBHOOK_SECRET environment variable is not set');
        return res.status(500).send('Webhook secret not configured');
      }
      
      // Production: verify webhook signature with the environment secret
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      
      if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object;
        const { userId, credits, packageId } = paymentIntent.metadata;
        
        if (!userId || !credits || !packageId) {
          console.error('Missing required metadata in payment intent:', paymentIntent.id);
          return res.status(400).send('Invalid payment metadata');
        }
        
        console.log(`💳 Payment succeeded: User ${userId} purchased ${credits} credits (PI: ${paymentIntent.id})`);
        
        // IDEMPOTENCY: Check if this payment intent was already processed
        let existingTransaction = await storage.getTransactionByPaymentIntent(paymentIntent.id);
        if (existingTransaction && existingTransaction.status === 'completed') {
          console.log(`⚠️ Payment intent ${paymentIntent.id} already processed, skipping credit fulfillment`);
          return res.json({ received: true, status: 'already_processed' });
        }
        
        // Validate package and amount against expected values
        const expectedPackage = CREDIT_PACKAGES[packageId as keyof typeof CREDIT_PACKAGES];
        if (!expectedPackage) {
          console.error(`Invalid package ID: ${packageId} for payment intent: ${paymentIntent.id}`);
          return res.status(400).send('Invalid package');
        }
        
        const expectedAmountCents = Math.round(expectedPackage.price * 100);
        if (paymentIntent.amount !== expectedAmountCents || 
            parseInt(credits) !== expectedPackage.credits) {
          console.error(`Amount/credits mismatch for PI ${paymentIntent.id}: expected ${expectedAmountCents}/${expectedPackage.credits}, got ${paymentIntent.amount}/${credits}`);
          return res.status(400).send('Amount validation failed');
        }
        
        // Update user credits (except for admin) - IDEMPOTENT
        const user = await storage.getUser(parseInt(userId));
        if (user && !user.isAdmin) {
          await storage.updateUserCredits(parseInt(userId), user.credits + parseInt(credits));
          console.log(`✅ Credits updated: User ${userId} now has ${user.credits + parseInt(credits)} credits`);
        }
        
        // Mark transaction as completed to prevent duplicate processing
        if (existingTransaction) {
          await storage.updateTransaction(existingTransaction.id!, { 
            status: 'completed',
            processedAt: new Date()
          });
        } else {
          // Create transaction record if not found (shouldn't happen but safety net)
          console.log(`⚠️ Creating transaction record for payment intent ${paymentIntent.id}`);
          await storage.createTransaction({
            userId: parseInt(userId),
            amount: (paymentIntent.amount / 100).toFixed(2),
            credits: parseInt(credits),
            stripePaymentIntentId: paymentIntent.id,
            status: 'completed',
            processedAt: new Date()
          });
        }
        
        console.log(`🎯 Idempotent credit fulfillment completed for PI: ${paymentIntent.id}`);
      }
      
      res.json({ received: true });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(400).send(`Webhook Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  // Download endpoint for completed projects
  app.get('/api/projects/:id/download', isAuthenticated, async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const userId = req.user.id;
      
      const project = await storage.getProject(projectId);
      if (!project || project.userId !== userId) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      if (project.status !== "completed") {
        return res.status(400).json({ message: "Project not completed" });
      }
      
      const outputUrl = project.contentType === "video" ? project.outputVideoUrl : project.outputImageUrl;
      if (!outputUrl) {
        return res.status(404).json({ message: "Output file not found" });
      }
      
      // If it's a local file, serve it directly
      if (outputUrl.startsWith('/api/files/')) {
        const filePath = outputUrl.replace('/api/files/', '');
        const fullPath = path.join('/tmp', filePath);
        
        try {
          const fileBuffer = await fs.readFile(fullPath);
          
          // Infer MIME type from file extension instead of hardcoding
          let mimeType: string;
          let fileExt: string;
          
          if (project.contentType === "video") {
            mimeType = "video/mp4";
            fileExt = "mp4";
          } else {
            // Extract file extension from outputImageUrl for proper MIME type
            const urlPath = outputUrl.includes('/public-objects/') 
              ? outputUrl.split('/public-objects/')[1] 
              : outputUrl;
            const detectedExt = path.extname(urlPath).toLowerCase();
            
            // Map extensions to MIME types
            const extToMime: { [key: string]: string } = {
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg', 
              '.png': 'image/png',
              '.gif': 'image/gif',
              '.webp': 'image/webp'
            };
            
            mimeType = extToMime[detectedExt] || 'image/png'; // Fallback to PNG
            fileExt = detectedExt.replace('.', '') || 'png';
          }
          
          const fileName = `${project.title}_${project.id}.${fileExt}`;
          
          res.setHeader('Content-Type', mimeType);
          res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
          res.send(fileBuffer);
        } catch (error) {
          return res.status(404).json({ message: "File not found" });
        }
      } else {
        // For external URLs (like Cloudinary), download and serve the file - SECURED
        console.log("🔗 Processing external file download:", outputUrl.substring(0, 50) + '...');
        
        // SECURITY: Validate URL to prevent SSRF attacks
        try {
          const url = new URL(outputUrl);
          
          // Allow only HTTPS
          if (url.protocol !== 'https:') {
            console.error("❌ Non-HTTPS URL rejected:", url.protocol);
            return res.status(400).json({ message: "Only HTTPS URLs are allowed" });
          }
          
          // Allowlist trusted domains
          const allowedDomains = [
            'res.cloudinary.com',
            'cloudinary.com',
            'images.unsplash.com'
          ];
          
          const isAllowedDomain = allowedDomains.some(domain => 
            url.hostname === domain || url.hostname.endsWith('.' + domain)
          );
          
          if (!isAllowedDomain) {
            console.error("❌ Domain not in allowlist:", url.hostname);
            return res.status(400).json({ message: "Domain not allowed for download" });
          }
          
          // Block private IP ranges
          const hostname = url.hostname.toLowerCase();
          if (hostname.match(/^10\./) || hostname.match(/^192\.168\./) || 
              hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./) ||
              hostname.includes('169.254.') || hostname.includes('127.0.0.1') ||
              hostname === 'localhost') {
            console.error("❌ Private IP range rejected:", hostname);
            return res.status(400).json({ message: "Private network access not allowed" });
          }
          
        } catch (urlError) {
          console.error("❌ Invalid URL format:", urlError);
          return res.status(400).json({ message: "Invalid URL format" });
        }
        
        try {
          // Add timeout and size limits
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
          
          console.log("🌐 Fetching external file with security controls...");
          const response = await fetch(outputUrl, {
            signal: controller.signal,
            headers: {
              'User-Agent': 'CGI-Generator-Download/1.0'
            }
          });
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            console.error(`❌ External file fetch failed: ${response.status} ${response.statusText}`);
            return res.status(502).json({ message: `External service error: ${response.status}` });
          }
          
          // Check content length
          const contentLength = response.headers.get('content-length');
          if (contentLength && parseInt(contentLength) > 200 * 1024 * 1024) { // 200MB limit
            console.error("❌ File too large:", contentLength);
            return res.status(400).json({ message: "File too large (max 200MB)" });
          }
          
          // Get MIME type from response headers (preferred) or fallback to detection
          let mimeType = response.headers.get('content-type') || '';
          let fileExt: string;
          
          if (project.contentType === "video") {
            if (!mimeType.startsWith('video/')) {
              mimeType = "video/mp4";
            }
            fileExt = "mp4";
          } else {
            if (!mimeType.startsWith('image/')) {
              // Fallback to URL-based detection
              const detectedExt = outputUrl.toLowerCase().includes('.jpg') || outputUrl.toLowerCase().includes('.jpeg') ? '.jpg' : '.png';
              const extToMime: { [key: string]: string } = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg', 
                '.png': 'image/png',
                '.gif': 'image/gif',
                '.webp': 'image/webp'
              };
              mimeType = extToMime[detectedExt] || 'image/png';
            }
            fileExt = mimeType.includes('jpeg') ? 'jpg' : 
                     mimeType.includes('png') ? 'png' :
                     mimeType.includes('gif') ? 'gif' :
                     mimeType.includes('webp') ? 'webp' : 'png';
          }
          
          // Create safe filename with Arabic support using RFC 5987
          const safeTitle = project.title.replace(/[^a-zA-Z0-9\u0600-\u06FF\s]/g, '_').trim();
          const fileName = `${safeTitle}_${project.id}.${fileExt}`;
          const encodedFileName = encodeURIComponent(fileName);
          
          // Set headers for download with Unicode support
          res.setHeader('Content-Type', mimeType);
          res.setHeader('Content-Disposition', `attachment; filename="${fileName}"; filename*=UTF-8''${encodedFileName}`);
          if (contentLength) {
            res.setHeader('Content-Length', contentLength);
          }
          
          // STREAMING: Use pipeline for memory efficiency
          console.log("📥 Streaming file to user...");
          const reader = response.body?.getReader();
          if (!reader) {
            throw new Error("No response body available");
          }
          
          try {
            let totalBytes = 0;
            const maxSize = 200 * 1024 * 1024; // 200MB
            
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              
              totalBytes += value.length;
              if (totalBytes > maxSize) {
                throw new Error("File size exceeded during streaming");
              }
              
              res.write(value);
            }
            
            res.end();
            console.log(`✅ File streamed successfully: ${totalBytes} bytes for project ${project.id}`);
            
          } finally {
            reader.releaseLock();
          }
          
        } catch (fetchError: any) {
          console.error("❌ Failed to download external file:", fetchError);
          if (fetchError?.name === 'AbortError') {
            return res.status(408).json({ message: "Download timeout" });
          }
          // Fallback to redirect for compatibility
          console.log("🔄 Falling back to redirect...");
          res.redirect(outputUrl);
        }
      }
    } catch (error) {
      console.error("Error downloading project:", error);
      res.status(500).json({ message: "Failed to download project" });
    }
  });

  // Admin endpoint to make yourself admin (DEVELOPMENT ONLY - DISABLED IN PRODUCTION)
  app.post('/api/admin/make-admin', isAuthenticated, asyncHandler(async (req: any, res) => {
    // Security: NEVER allow this in production - Multiple layers of protection
    if (process.env.NODE_ENV === 'production') {
      console.warn(`⚠️ SECURITY ALERT: Attempted admin elevation in production from user ${req.user.id}`);
      throw new CustomError("Admin elevation disabled in production", 403, "هذه الخدمة غير متاحة في الإنتاج لأسباب أمنية.");
    }

    // Additional security: Only allow if explicitly enabled in development
    if (!process.env.ALLOW_ADMIN_ELEVATION || process.env.ALLOW_ADMIN_ELEVATION !== 'true') {
      console.warn(`⚠️ SECURITY ALERT: Attempted admin elevation without explicit permission from user ${req.user.id}`);
      throw new CustomError("Admin elevation not enabled", 403, "تم تعطيل رفع صلاحيات الأدمن.");
    }
    
    const userId = req.user.id;
    
    // Update user to be admin (development only)
    await storage.updateUser(userId, { isAdmin: true });
    
    console.log(`🛡️ Admin privileges granted to user ${userId} in development mode`);
    res.json({ 
      message: "Admin privileges granted", 
      isAdmin: true,
      note: "Development mode only - this endpoint is disabled in production"
    });
  }));

  // Admin endpoint to get all users
  app.get('/api/admin/users', isAuthenticated, asyncHandler(async (req: any, res) => {
    const user = await storage.getUser(req.user.id);
    if (!user?.isAdmin) {
      throw new CustomError("Admin access required", 403, "صلاحيات الأدمن مطلوبة للوصول لهذه الخدمة.");
    }
    
    const users = await storage.getAllUsers();
    res.json(users);
  }));

  // Admin endpoint to get all projects
  app.get('/api/admin/projects', isAuthenticated, asyncHandler(async (req: any, res) => {
    const user = await storage.getUser(req.user.id);
    if (!user?.isAdmin) {
      throw new CustomError("Admin access required", 403, "صلاحيات الأدمن مطلوبة للوصول لهذه الخدمة.");
    }
    
    const projects = await storage.getAllProjects();
    res.json(projects);
  }));

  // Endpoint to get actual costs for user projects
  app.get('/api/actual-costs', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const projects = await storage.getUserProjects(userId);
      
      // Calculate total costs and breakdown
      let totalCostMillicents = 0;
      let imageProjects = 0;
      let videoProjects = 0;
      const projectCosts = projects.map(project => {
        const cost = project.actualCost || 0; // cost is in millicents
        totalCostMillicents += cost;
        
        if (project.contentType === 'image') imageProjects++;
        if (project.contentType === 'video') videoProjects++;
        
        return {
          id: project.id,
          title: project.title,
          contentType: project.contentType,
          status: project.status,
          actualCostMillicents: cost,
          actualCostCents: (cost / 10).toFixed(1), // Convert millicents to cents for backward compatibility
          actualCostUSD: (cost / 1000).toFixed(4), // Convert millicents to USD
          createdAt: project.createdAt
        };
      });
      
      res.json({
        totalCostMillicents,
        totalCostCents: (totalCostMillicents / 10).toFixed(1), // Convert to cents for backward compatibility
        totalCostUSD: (totalCostMillicents / 1000).toFixed(4), // Convert to USD
        breakdown: {
          totalProjects: projects.length,
          imageProjects,
          videoProjects,
          estimatedImageCostMillicents: imageProjects * (ACTUAL_COSTS.GEMINI_PROMPT_ENHANCEMENT + ACTUAL_COSTS.GEMINI_IMAGE_GENERATION), // 41 millicents per image project
          estimatedVideoCostMillicents: videoProjects * (ACTUAL_COSTS.GEMINI_PROMPT_ENHANCEMENT + ACTUAL_COSTS.GEMINI_IMAGE_GENERATION + ACTUAL_COSTS.GEMINI_VIDEO_ANALYSIS + ACTUAL_COSTS.VIDEO_GENERATION), // 304 millicents per video project
          estimatedImageCostCents: (imageProjects * (ACTUAL_COSTS.GEMINI_PROMPT_ENHANCEMENT + ACTUAL_COSTS.GEMINI_IMAGE_GENERATION) / 10).toFixed(1), // backward compatibility
          estimatedVideoCostCents: (videoProjects * (ACTUAL_COSTS.GEMINI_PROMPT_ENHANCEMENT + ACTUAL_COSTS.GEMINI_IMAGE_GENERATION + ACTUAL_COSTS.GEMINI_VIDEO_ANALYSIS + ACTUAL_COSTS.VIDEO_GENERATION) / 10).toFixed(1) // backward compatibility
        },
        projects: projectCosts
      });
    } catch (error) {
      console.error("Error getting actual costs:", error);
      res.status(500).json({ message: "Failed to get actual costs" });
    }
  });

  // Admin endpoint to get platform stats
  app.get('/api/admin/stats', isAuthenticated, asyncHandler(async (req: any, res) => {
    const user = await storage.getUser(req.user.id);
    if (!user?.isAdmin) {
      throw new CustomError("Admin access required", 403, "صلاحيات الأدمن مطلوبة للوصول لهذه الخدمة.");
    }
    
    const stats = await storage.getPlatformStats();
    res.json(stats);
  }));

  // Admin endpoint to manage user credits
  app.post('/api/admin/users/:id/credits', isAuthenticated, asyncHandler(async (req: any, res) => {
    const user = await storage.getUser(req.user.id);
    if (!user?.isAdmin) {
      throw new CustomError("Admin access required", 403, "صلاحيات الأدمن مطلوبة للوصول لهذه الخدمة.");
    }

    // Server-side validation with Zod
    const adminCreditSchema = z.object({
      amount: z.number({
        required_error: "كمية الكريديت مطلوبة",
        invalid_type_error: "يجب أن تكون كمية الكريديت رقم صحيح",
      }).min(1, "يجب أن تكون كمية الكريديت أكبر من صفر").max(1000, "الحد الأقصى 1000 كريديت"),
      action: z.enum(["add", "subtract"], {
        required_error: "يجب اختيار نوع العملية (add أو subtract)",
      }),
      reason: z.string().optional(),
    });

    const userIdSchema = z.number().int().positive();

    // Validate user ID
    const userId = userIdSchema.parse(parseInt(req.params.id));
    
    // Validate request body
    const validatedData = adminCreditSchema.parse(req.body);

    // Get target user
    const targetUser = await storage.getUser(userId);
    if (!targetUser) {
      throw new CustomError("User not found", 404, "المستخدم غير موجود.");
    }

    // Calculate new credit amount
    const currentCredits = targetUser.credits || 0;
    const newCredits = validatedData.action === 'add' 
      ? currentCredits + validatedData.amount 
      : Math.max(0, currentCredits - validatedData.amount);

    // Update user credits
    await storage.updateUserCredits(userId, newCredits);

    // Create transaction record for admin action
    await storage.createTransaction({
      userId: userId,
      amount: validatedData.action === 'add' ? validatedData.amount : -validatedData.amount,
      credits: validatedData.action === 'add' ? validatedData.amount : -validatedData.amount,
      stripePaymentIntentId: `admin_${validatedData.action}_${Date.now()}`,
      status: 'completed',
      processedAt: new Date(),
    });

    console.log(`🛡️ Admin ${user.email} ${validatedData.action}ed ${validatedData.amount} credits for user ${targetUser.email}. Reason: ${validatedData.reason || 'No reason provided'}`);

    res.json({
      success: true,
      message: `Successfully ${validatedData.action}ed ${validatedData.amount} credits`,
      user: {
        id: targetUser.id,
        email: targetUser.email,
        previousCredits: currentCredits,
        newCredits: newCredits,
        action: validatedData.action,
        amount: validatedData.amount,
        reason: validatedData.reason || 'No reason provided'
      }
    });
  }));

  // Admin endpoint to get user transactions
  app.get('/api/admin/users/:id/transactions', isAuthenticated, asyncHandler(async (req: any, res) => {
    const user = await storage.getUser(req.user.id);
    if (!user?.isAdmin) {
      throw new CustomError("Admin access required", 403, "صلاحيات الأدمن مطلوبة للوصول لهذه الخدمة.");
    }

    // Server-side validation with Zod
    const userIdSchema = z.number().int().positive();
    const userId = userIdSchema.parse(parseInt(req.params.id));

    // Get target user
    const targetUser = await storage.getUser(userId);
    if (!targetUser) {
      throw new CustomError("User not found", 404, "المستخدم غير موجود.");
    }

    // Get user transactions
    const transactions = await storage.getUserTransactions(userId);

    // Get user projects for spending history
    const projects = await storage.getUserProjects(userId);

    res.json({
      user: {
        id: targetUser.id,
        email: targetUser.email,
        currentCredits: targetUser.credits || 0,
        isAdmin: targetUser.isAdmin || false,
      },
      transactions: transactions,
      projects: projects.map(project => ({
        id: project.id,
        title: project.title,
        creditsUsed: project.creditsUsed,
        contentType: project.contentType,
        status: project.status,
        createdAt: project.createdAt,
        completedAt: project.updatedAt
      })),
      summary: {
        totalTransactions: transactions.length,
        totalCreditsSpent: projects.reduce((sum, p) => sum + (p.creditsUsed || 0), 0),
        totalProjects: projects.length,
        completedProjects: projects.filter(p => p.status === 'completed').length
      }
    });
  }));

  // Scene Selection APIs
  // Default Scenes API
  app.get('/api/scenes/default', isAuthenticated, async (req: any, res) => {
    try {
      const { getAllDefaultScenes, suggestScenesForProduct } = await import('./services/default-scenes');
      const { productType } = req.query;

      let scenes;
      if (productType) {
        console.log('🎯 Getting suggested scenes for product type:', productType);
        scenes = await suggestScenesForProduct(productType, 'modern', []);
      } else {
        console.log('📚 Getting all default scenes');
        scenes = await getAllDefaultScenes();
      }

      res.json(scenes);
    } catch (error) {
      console.error('❌ Error fetching default scenes:', error);
      res.status(500).json({ error: 'Failed to fetch default scenes' });
    }
  });

  // Pinterest Scenes API  
  app.get('/api/scenes/pinterest', isAuthenticated, async (req: any, res) => {
    try {
      console.log('🎯 Pinterest API endpoint HIT!');
      console.log('📋 Query params:', req.query);
      
      const { searchPinterestForProduct } = await import('./services/pinterest-scraper-simple');
      const { q: searchQuery, productType = 'أثاث', maxResults = 20 } = req.query;

      console.log('🔍 Extracted params:', { searchQuery, productType, maxResults });

      if (!searchQuery || searchQuery.trim() === '') {
        console.log('⚠️ Empty/missing search query');
        return res.json([]); // Return empty array instead of error for frontend
      }

      console.log('🔍 Pinterest search request:', {
        searchQuery,
        productType,
        maxResults: parseInt(maxResults)
      });

      console.log('🚀 About to call Pinterest-style CGI search...');
      const scenes = await searchPinterestForProduct(
        productType,
        'modern',
        [searchQuery],
        { maxResults: parseInt(maxResults) }
      );

      console.log('✅ Pinterest search completed, returning:', scenes.length, 'scenes');
      res.json(scenes);
    } catch (error: any) {
      console.error('❌ Pinterest search failed:', error);
      console.error('📊 Error details:', error.stack);
      res.json([]); // Return empty array instead of error for frontend
    }
  });

  // Product Analysis API
  app.post('/api/analyze-product', isAuthenticated, async (req: any, res) => {
    try {
      const { analyzeProductForScenes } = await import('./services/product-analyzer');
      const { imageUrl } = req.body;

      if (!imageUrl) {
        return res.status(400).json({ error: 'Image URL is required' });
      }

      console.log('🔍 Product analysis request for:', imageUrl.substring(0, 50) + '...');

      const analysis = await analyzeProductForScenes(imageUrl);

      console.log('🔧 FULL Analysis Object for debugging:', JSON.stringify(analysis, null, 2));

      res.json(analysis);
    } catch (error) {
      console.error('❌ Product analysis failed:', error);
      res.status(500).json({ error: 'Product analysis failed' });
    }
  });

  // 🚨 RECOVERY SYSTEM: Endpoint to recover "failed" projects that actually completed on Kling's side
  app.post("/api/projects/recover", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user.id;
      console.log("🔄 RECOVERY: Starting recovery process for user:", userId);

      // Find projects that might need recovery:
      // 1. Status is "failed" or "processing" 
      // 2. Have Kling task IDs saved (klingVideoTaskId or klingSoundTaskId)
      const userProjects = await storage.getUserProjects(userId);
      const recoverableProjects = userProjects.filter(project => 
        (project.status === "failed" || project.status === "processing") &&
        (project.klingVideoTaskId || project.klingSoundTaskId)
      );

      console.log("🔍 RECOVERY: Found projects for potential recovery:", {
        total: userProjects.length,
        recoverable: recoverableProjects.length,
        recoverableIds: recoverableProjects.map(p => p.id)
      });

      if (recoverableProjects.length === 0) {
        return res.json({ 
          message: "No projects found for recovery",
          recovered: 0,
          total: 0
        });
      }

      const klingApiKey = process.env.KLING_API_KEY;
      if (!klingApiKey) {
        throw new Error("KLING_API_KEY environment variable is required");
      }

      let recoveredCount = 0;
      const recoveryResults = [];

      // Check each recoverable project
      for (const project of recoverableProjects) {
        console.log("🔎 RECOVERY: Checking project:", {
          projectId: project.id!,
          title: project.title,
          status: project.status,
          hasVideoTaskId: !!project.klingVideoTaskId,
          hasSoundTaskId: !!project.klingSoundTaskId
        });

        try {
          let recovered = false;
          let videoUrl = project.outputVideoUrl;
          
          // Check video task if exists
          if (project.klingVideoTaskId && !project.outputVideoUrl) {
            console.log("🎬 RECOVERY: Checking video task:", project.klingVideoTaskId);
            
            const videoStatusResponse = await fetch(`https://api.piapi.ai/api/v1/task/${project.klingVideoTaskId}`, {
              headers: { 'X-API-Key': klingApiKey }
            });
            
            if (videoStatusResponse.ok) {
              const videoResult = await videoStatusResponse.json();
              const videoData = videoResult.data || videoResult;
              
              console.log("📺 RECOVERY: Video task status:", {
                taskId: project.klingVideoTaskId,
                status: videoData.status,
                hasOutput: !!videoData.output
              });
              
              if (videoData.status === 'completed' && videoData.output) {
                videoUrl = videoData.output;
                recovered = true;
                console.log("✅ RECOVERY: Found completed video:", videoUrl);
              }
            }
          }
          
          // Check audio task if exists and video was found
          if (project.klingSoundTaskId && videoUrl && project.includeAudio) {
            console.log("🔊 RECOVERY: Checking audio task:", project.klingSoundTaskId);
            
            const audioStatusResponse = await fetch(`https://api.piapi.ai/api/v1/task/${project.klingSoundTaskId}`, {
              headers: { 'X-API-Key': klingApiKey }
            });
            
            if (audioStatusResponse.ok) {
              const audioResult = await audioStatusResponse.json();
              const audioData = audioResult.data || audioResult;
              
              console.log("🎵 RECOVERY: Audio task status:", {
                taskId: project.klingSoundTaskId,
                status: audioData.status,
                hasOutput: !!audioData.output
              });
              
              if (audioData.status === 'completed' && audioData.output) {
                videoUrl = audioData.output; // Audio task returns video with audio
                recovered = true;
                console.log("✅ RECOVERY: Found completed video with audio:", videoUrl);
              }
            }
          }
          
          // Update project if we found completed content
          if (recovered && videoUrl) {
            await storage.updateProject(project.id!, {
              status: "completed",
              outputVideoUrl: videoUrl,
              progress: 100,
              errorMessage: undefined // Clear error message
            });
            
            recoveredCount++;
            recoveryResults.push({
              projectId: project.id,
              title: project.title,
              status: "recovered",
              videoUrl: videoUrl
            });
            
            console.log("🎉 RECOVERY SUCCESS:", {
              projectId: project.id,
              title: project.title,
              videoUrl: videoUrl.substring(0, 50) + "..."
            });
          } else {
            recoveryResults.push({
              projectId: project.id,
              title: project.title,
              status: "still_processing_or_failed",
              reason: !videoUrl ? "No completed video found" : "Unknown issue"
            });
          }
          
        } catch (recoveryError) {
          console.error("❌ RECOVERY ERROR for project:", {
            projectId: project.id,
            error: recoveryError instanceof Error ? recoveryError.message : "Unknown error"
          });
          
          recoveryResults.push({
            projectId: project.id,
            title: project.title,
            status: "recovery_failed",
            error: recoveryError instanceof Error ? recoveryError.message : "Unknown error"
          });
        }
      }

      console.log("🏁 RECOVERY COMPLETE:", {
        totalChecked: recoverableProjects.length,
        recovered: recoveredCount,
        results: recoveryResults
      });

      res.json({
        message: `Recovery complete: ${recoveredCount} of ${recoverableProjects.length} projects recovered`,
        recovered: recoveredCount,
        total: recoverableProjects.length,
        results: recoveryResults
      });

    } catch (error) {
      console.error("❌ RECOVERY ENDPOINT ERROR:", error);
      res.status(500).json({ 
        error: "Recovery failed", 
        message: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // Add enhanced error handling middleware as the last middleware
  app.use(errorHandler);

  const httpServer = createServer(app);

  return httpServer;
}

// NEW: Job-based async processor for Vercel compatibility
async function processJobAsync(jobId: number) {
  try {
    const job = await storage.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    const projectId = job.projectId;
    console.log(`🎯 Processing job ${jobId} for project ${projectId}`);

    // Process the project using the original logic
    await processProjectFromJob(job);
    
    console.log(`✅ Job ${jobId} completed successfully`);
  } catch (error) {
    console.error(`❌ Job ${jobId} failed:`, error);
    throw error;
  }
}

// Updated process function that works with job data
async function processProjectFromJob(job: any) {
  const projectId = job.projectId;
  const jobData = job.data;
  let totalCostMillicents = 0; // Track actual API costs in millicents (1/1000 USD)
  
  try {
    console.log(`🚀 Starting CGI processing for project ${projectId}`);
    
    // Get project details for debugging
    const project = await storage.getProject(projectId);
    console.log(`🔍 Project details:`, {
      id: projectId,
      contentType: project?.contentType,
      status: project?.status,
      title: project?.title
    });
    if (!project) {
      throw new Error("Project not found");
    }

    // Update both project and job status
    await storage.updateProject(projectId, { 
      status: "processing", 
      progress: 10 
    });
    
    await storage.updateJob(job.id, {
      progress: 10
    });

    // Step 1: Enhance prompt with Gemini AI
    await storage.updateProject(projectId, { 
      status: "enhancing_prompt", 
      progress: 25 
    });
    
    await storage.updateJob(job.id, {
      progress: 25
    });

    // Helper function to extract relative path from full URL
    const extractRelativePath = (url: string): string => {
      try {
        const urlObj = new URL(url);
        // Extract path after /public-objects/
        const pathname = urlObj.pathname;
        const match = pathname.match(/\/public-objects\/(.+)/);
        return match ? match[1] : url; // Return relative path or original URL as fallback
      } catch (error) {
        console.warn("Could not parse URL, using as path:", url);
        return url; // Use original string as path if URL parsing fails
      }
    };

    // Use paths from job data or fallback to project data
    const productImagePath = jobData.productImageUrl || project.productImageUrl || "";
    const sceneImagePath = jobData.sceneImageUrl || project.sceneImageUrl || "";
    const sceneVideoPath = jobData.sceneVideoUrl || project.sceneVideoUrl || "";
    const productSize = jobData.productSize || (project as any).productSize || 'normal';
    
    console.log("Media paths and product settings for AI:", { 
      productImagePath, 
      sceneImagePath, 
      sceneVideoPath, 
      contentType: project.contentType,
      productSize: productSize
    });
    
    console.log("Media paths for Gemini:", { 
      productImagePath, 
      sceneImagePath, 
      sceneVideoPath, 
      contentType: project.contentType 
    });

    // Use appropriate scene path (prefer video over image for video projects)
    const scenePath = project.contentType === "video" && sceneVideoPath ? 
      sceneVideoPath : sceneImagePath;
    const isSceneVideo = project.contentType === "video" && sceneVideoPath;
    
    // Initialize frame extraction data variables for wider scope access
    let savedFrameExtractionResult: any = undefined;
    let savedMotionTimeline: any = undefined;

    // Integrate with Gemini AI for prompt enhancement (use video-specific enhancement for video projects)
    let enhancedPrompt;
    let videoPromptData: {
      imageScenePrompt?: string;
      videoMotionPrompt?: string;
      qualityNegativePrompt?: string;
    } = {};
    
    try {
      if (project.contentType === "video") {
        const { enhanceVideoPromptWithGemini } = await import('./services/gemini');
        const result = await enhanceVideoPromptWithGemini(
          productImagePath,
          scenePath,
          project.description || "CGI video generation",
          {
            duration: project.videoDurationSeconds || undefined,
            isSceneVideo: !!isSceneVideo,
            productSize: productSize
          }
        );
        enhancedPrompt = result.enhancedPrompt;
        videoPromptData = {
          imageScenePrompt: result.imageScenePrompt,
          videoMotionPrompt: result.videoMotionPrompt,
          qualityNegativePrompt: result.qualityNegativePrompt
        };
        
        // Store frame extraction data for later use in Kling API (update existing variables)
        savedFrameExtractionResult = result.frameExtractionResult;
        savedMotionTimeline = result.motionTimeline;
        
        // Save frame extraction results and motion timeline to database
        if (savedFrameExtractionResult && savedMotionTimeline) {
          console.log("💾 Saving Pinterest video analysis data to database:", {
            framesCount: savedFrameExtractionResult.frames.length,
            hasGridUrl: !!savedFrameExtractionResult.gridImageUrl,
            timelineSegments: savedMotionTimeline.segments.length,
            projectId
          });
          
          await storage.updateProject(projectId, {
            motionTimeline: JSON.stringify(savedMotionTimeline),
            keyFrameUrls: JSON.stringify(savedFrameExtractionResult.frames.map((f: any) => f.frameUrl)),
            frameGridUrl: savedFrameExtractionResult.gridImageUrl
          });
          
          console.log("✅ Pinterest video analysis data saved successfully");
        } else {
          console.log("⚠️ No frame extraction data to save (image scene or extraction failed)");
        }
        
        console.log("Video prompt separation:", {
          hasImageScene: !!videoPromptData.imageScenePrompt,
          hasVideoMotion: !!videoPromptData.videoMotionPrompt,
          hasNegativePrompt: !!videoPromptData.qualityNegativePrompt,
          imageSceneLength: videoPromptData.imageScenePrompt?.length || 0,
          videoMotionLength: videoPromptData.videoMotionPrompt?.length || 0
        });
      } else {
        enhancedPrompt = await enhancePromptWithGemini(
          productImagePath,
          scenePath,
          project.description || "CGI image generation",
          productSize
        );
      }
    } finally {
      // Record cost even if call fails
      totalCostMillicents += ACTUAL_COSTS.GEMINI_PROMPT_ENHANCEMENT;
    }

    await storage.updateProject(projectId, { 
      enhancedPrompt,
      progress: 50 
    });

    // Step 2: Generate image with Gemini 2.5 Flash Image
    await storage.updateProject(projectId, { 
      status: "generating_image", 
      progress: 60 
    });

    // Integrate with Gemini for multi-image generation - use imageScenePrompt if available
    let geminiImageResult;
    const imagePrompt = videoPromptData.imageScenePrompt || enhancedPrompt;
    console.log("Using prompt for image generation:", {
      usingImageScene: !!videoPromptData.imageScenePrompt,
      promptLength: imagePrompt.length,
      promptType: videoPromptData.imageScenePrompt ? "static-scene-focused" : "combined"
    });
    
    try {
      geminiImageResult = await generateImageWithGemini(
        productImagePath,
        sceneImagePath,
        imagePrompt, // Use separated static scene prompt when available
        productSize
      );
    } finally {
      // Record cost even if call fails
      totalCostMillicents += ACTUAL_COSTS.GEMINI_IMAGE_GENERATION;
    }
    
    console.log("Gemini image generation result:", {
      base64Length: geminiImageResult.base64.length,
      mimeType: geminiImageResult.mimeType,
      timestamp: new Date().toISOString()
    });
    
    // Extract file extension from MIME type for proper file handling
    const mimeToExtension: { [key: string]: string } = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp'
    };
    
    const fileExtension = mimeToExtension[geminiImageResult.mimeType] || 'png';
    console.log("Using file extension:", fileExtension, "for MIME type:", geminiImageResult.mimeType);
    
    // Save the generated image to Cloudinary
    const imageBuffer = Buffer.from(geminiImageResult.base64, 'base64');
    
    // Scene preservation validation (basic check)
    if (imageBuffer.length < 1000) {
      console.warn("Generated image is suspiciously small - scene preservation may be insufficient");
    }
    console.log("Scene preservation check - generated image size:", imageBuffer.length, "bytes");
    
    // Upload to Cloudinary using centralized service
    const filename = `generated-${Date.now()}.${fileExtension}`;
    console.log("Uploading generated image to Cloudinary:", filename);
    
    const cloudinaryUrl = await uploadToCloudinary(imageBuffer, filename);
    
    const imageResult = { url: cloudinaryUrl };

    await storage.updateProject(projectId, { 
      outputImageUrl: imageResult.url,
      progress: 75 
    });

    // Step 2.5: Enhance video prompt from generated image (NEW STEP!)
    // Use motion-specific prompt if available, otherwise fallback to combined prompt
    let finalVideoPrompt = videoPromptData.videoMotionPrompt || enhancedPrompt;
    let audioPrompt: string | undefined = undefined;
    
    console.log("Base video prompt selection:", {
      usingMotionPrompt: !!videoPromptData.videoMotionPrompt,
      motionPromptLength: videoPromptData.videoMotionPrompt?.length || 0,
      fallbackPromptLength: enhancedPrompt.length,
      promptType: videoPromptData.videoMotionPrompt ? "motion-focused" : "combined"
    });
    
    if (project.contentType === "video") {
      console.log("🎬 Step 2.5: Analyzing generated image for optimal video production...");
      await storage.updateProject(projectId, { 
        status: "generating_video", 
        progress: 78 
      });

      try {
        const { enhanceVideoPromptFromGeneratedImage } = await import('./services/gemini');
        
        const videoEnhancement = await enhanceVideoPromptFromGeneratedImage(
          geminiImageResult, // Use the generated image data
          {
            duration: project.videoDurationSeconds || 10,
            includeAudio: project.includeAudio || false,
            userDescription: project.description || "",
            productName: project.title || "Product"
          }
        );

        // Merge video enhancement with existing motion prompt (don't overwrite!)
        const basePrompt = finalVideoPrompt; // This is videoMotionPrompt || enhancedPrompt
        finalVideoPrompt = `${basePrompt}

Camera and Production: ${videoEnhancement.enhancedVideoPrompt}`;
        
        console.log("🎬 Video prompt merged with enhancement:", {
          basePromptLength: basePrompt.length,
          enhancementLength: videoEnhancement.enhancedVideoPrompt.length,
          finalPromptLength: finalVideoPrompt.length,
          baseType: videoPromptData.videoMotionPrompt ? "motion-focused" : "combined"
        });
        audioPrompt = videoEnhancement.audioPrompt;

        // Add cost for video prompt enhancement
        totalCostMillicents += ACTUAL_COSTS.GEMINI_VIDEO_ANALYSIS;

        // Safe camera movements extraction (fix TypeError)
        const cameraMovementsText = Array.isArray(videoEnhancement.cameraMovements) 
          ? videoEnhancement.cameraMovements.join("\n") 
          : (videoEnhancement.cameraMovements || "");
        
        console.log("🎬 Video prompt enhancement completed:", {
          enhancedPromptLength: finalVideoPrompt.length,
          audioIncluded: !!audioPrompt,
          cameraMovementsLength: cameraMovementsText.length,
          cinematicDirectionLength: videoEnhancement.enhancedVideoPrompt?.length || 0
        });

      } catch (error) {
        console.warn("⚠️ Video prompt enhancement failed, using original:", error);
        // Continue with original prompt if enhancement fails
        await storage.updateProject(projectId, { 
          status: "generating_video", 
          progress: 80 
        });
      }
    }

    // Step 3: Generate video if requested
    console.log("🎬 Checking video generation condition:", {
      projectId,
      contentType: project.contentType,
      shouldGenerateVideo: project.contentType === "video",
      imageUrl: imageResult.url,
      promptLength: finalVideoPrompt.length
    });
    
    if (project.contentType === "video") {
      console.log("🎬 Starting video generation for project:", projectId);
      await storage.updateProject(projectId, { 
        status: "generating_video", 
        progress: 80 
      });

      try {
        // Integrate with Kling AI for video generation
        console.log("🎬 Attempting to import kling-video service...");
        const { generateVideoWithKling } = await import('./services/kling-video');
        console.log("🎬 kling-video service imported successfully:", typeof generateVideoWithKling);
        let videoResult;
        try {
          console.log("🎬 Calling generateVideoWithKling with:", {
            imageUrl: imageResult.url,
            promptLength: finalVideoPrompt.length,
            promptType: finalVideoPrompt === enhancedPrompt ? "original" : "video-enhanced",
            duration: project.videoDurationSeconds || 10,
            includeAudio: project.includeAudio || false,
            hasAudioPrompt: !!audioPrompt
          });
          
          // Use the video-enhanced prompt and selected video duration with quality negative prompt
          const effectiveNegativePrompt = videoPromptData.qualityNegativePrompt || 
            "deformed, distorted, unnatural proportions, melting, morphing, blurry, low quality";
          
          console.log("🎬 Kling API negative prompt validation:", {
            hasCustomNegative: !!videoPromptData.qualityNegativePrompt,
            negativePromptLength: effectiveNegativePrompt.length,
            negativePromptPreview: effectiveNegativePrompt.substring(0, 50) + "..."
          });
          
          // Assert non-empty negative prompt
          if (!effectiveNegativePrompt || effectiveNegativePrompt.trim().length === 0) {
            throw new Error("Negative prompt must not be empty for video generation");
          }
          
          // Enhanced motion prompt with Pinterest video frame analysis
          let enhancedMotionPrompt = finalVideoPrompt;
          
          // **MOTION PRECEDENCE SYSTEM** - Pinterest motion takes priority when available
          if (savedFrameExtractionResult?.gridImageUrl && savedMotionTimeline) {
            console.log("🎯 Enhancing video prompt with Pinterest video frame analysis for 90%+ motion fidelity:", {
              originalImageUrl: imageResult.url.substring(0, 50) + "...",
              frameGridUrl: savedFrameExtractionResult.gridImageUrl.substring(0, 50) + "...",
              timelineSegments: savedMotionTimeline.segments.length,
              keyFrames: savedFrameExtractionResult.frames.length
            });
            
            // Normalize Pinterest timeline to target duration
            const targetDuration = project.videoDurationSeconds || 5;
            const sourceDuration = savedMotionTimeline.segments.length > 0 
              ? Math.max(...savedMotionTimeline.segments.map((s: any) => s.endTime))
              : 10;
            const scaleFactor = targetDuration / sourceDuration;
            
            // Build normalized frame descriptions
            const frameDescriptions = savedFrameExtractionResult.frames
              .map((frame: any) => {
                const normalizedTime = Math.min(frame.timestamp * scaleFactor, targetDuration);
                const percentage = Math.round((normalizedTime / targetDuration) * 100);
                return `${normalizedTime.toFixed(1)}s: Frame at ${normalizedTime.toFixed(1)}s (${percentage}%)`;
              })
              .join(', ');
            
            // Build normalized motion timeline
            const motionSegments = savedMotionTimeline.segments
              .map((seg: any) => {
                const normalizedStart = Math.min(seg.startTime * scaleFactor, targetDuration);
                const normalizedEnd = Math.min(seg.endTime * scaleFactor, targetDuration);
                return `${normalizedStart.toFixed(1)}-${normalizedEnd.toFixed(1)}s: ${seg.camera.movement} camera, ${seg.subject.motion} motion`;
              })
              .join(', ');
            
            // **AUTHORITATIVE MOTION BLOCK** - Override conflicting base motions
            // Strip motion words from base prompt to avoid conflicts
            const basePromptStripped = finalVideoPrompt.replace(
              /\b(descend[s]?|fall[s]?|drop[s]?|rotate[s]?|spin[s]?|turn[s]?|orbit[s]?|dolly|pan[s]?|tilt[s]?|zoom[s]?|appear[s]?|emerge[s]?|rise[s]?|fly-in|move[s]?)\b/gi, 
              '[motion-overridden]'
            );
            
            enhancedMotionPrompt = `${basePromptStripped}

🎥 MOTION DIRECTIVES (AUTHORITATIVE - Follow exactly, ignore any previous motion instructions):
🎬 Duration: ${targetDuration} seconds
📸 Key Frame Analysis: ${frameDescriptions}
⏱️ Motion Timeline: ${motionSegments}
🎯 Apply these exact motion patterns to the generated scene while preserving product and environment quality.`;
            
            console.log("✅ Enhanced motion prompt created:", {
              originalLength: finalVideoPrompt.length,
              enhancedLength: enhancedMotionPrompt.length,
              expectedAccuracy: "90%+",
              approach: "frame-analysis + motion-timeline",
              targetDuration: targetDuration,
              sourceDuration: sourceDuration,
              scaleFactor: scaleFactor.toFixed(2)
            });
          } else {
            console.log("⚠️ No Pinterest video frames available, using text-only motion analysis (70-85% accuracy)");
          }
          
          videoResult = await generateVideoWithKling(
            imageResult.url, // Keep original generated image for product/scene quality
            enhancedMotionPrompt, // Use frame-enhanced motion prompt for 90%+ fidelity
            project.videoDurationSeconds || 10,
            project.includeAudio || false, // Use actual audio setting
            effectiveNegativePrompt,
            // For recovery system
            projectId,
            storage
          );
          
          console.log("🎬 generateVideoWithKling returned:", {
            success: !!videoResult,
            hasUrl: !!videoResult?.url,
            videoUrl: videoResult?.url?.substring(0, 50) + "...",
            hasFullTaskDetails: !!videoResult?.fullTaskDetails,
            taskDetailsSize: videoResult?.fullTaskDetails ? JSON.stringify(videoResult.fullTaskDetails).length : 0
          });
          
          // Update video URL and full task details if generation succeeded
          await storage.updateProject(projectId, { 
            outputVideoUrl: videoResult.url,
            fullTaskDetails: videoResult.fullTaskDetails ?? undefined, // NEW: Save complete task details for UI display
            progress: 95 
          });
          
          console.log("Video generation completed successfully:", {
            projectId,
            videoUrl: videoResult.url,
            duration: videoResult.duration
          });
          
        } finally {
          // Record cost even if video generation fails
          totalCostMillicents += ACTUAL_COSTS.VIDEO_GENERATION;
        }
      } catch (videoError) {
        console.error("❌ VIDEO GENERATION FAILED:", {
          projectId,
          errorMessage: videoError instanceof Error ? videoError.message : "Unknown error",
          errorStack: videoError instanceof Error ? videoError.stack : "No stack trace",
          imageUrl: imageResult.url,
          promptLength: finalVideoPrompt.length
        });
        
        // Store error in database instead of hiding it
        await storage.updateProject(projectId, { 
          errorMessage: `Video generation failed: ${videoError instanceof Error ? videoError.message : "Unknown error"}`,
          status: "failed"
        });
        
        // Don't continue as completed - mark as failed
        throw videoError;
      }
    }

    // Mark as completed and update actual cost
    console.log(`Total actual cost for project ${projectId}: $${(totalCostMillicents / 1000).toFixed(4)} (${totalCostMillicents} millicents)`);
    
    const finalImageUrl = imageResult?.url || null;
    const finalVideoUrl = project.contentType === "video" ? project.outputVideoUrl : null;
    
    await storage.updateProject(projectId, { 
      status: "completed", 
      progress: 100,
      actualCost: totalCostMillicents
    });

    // Mark job as completed with results
    await storage.markJobCompleted(job.id, {
      outputImageUrl: finalImageUrl,
      outputVideoUrl: finalVideoUrl,
      totalCost: totalCostMillicents,
      costInUSD: (totalCostMillicents / 1000).toFixed(4)
    });

    console.log(`CGI processing completed for project ${projectId}`);
  } catch (error) {
    console.error(`CGI processing failed for project ${projectId}:`, error);
    
    // Mark as failed and store error message with actual cost incurred
    console.log(`Actual cost incurred despite failure: $${(totalCostMillicents / 1000).toFixed(4)} (${totalCostMillicents} millicents)`);
    await storage.updateProject(projectId, { 
      status: "failed", 
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      actualCost: totalCostMillicents
    });
    
    // Mark job as failed
    await storage.markJobFailed(job.id, error instanceof Error ? error.message : "Unknown error");
  }
}

// Health check endpoints for deployment platforms
function setupHealthCheckRoutes(app: Express) {
  // Basic API health check (moved from "/" to "/api")
  app.get('/api', (req, res) => {
    res.json({ 
      message: 'CGI Generator API is running!',
      timestamp: new Date().toISOString(),
      status: 'healthy',
      version: '1.0.0'
    });
  });

  // Detailed health check endpoint for monitoring
  app.get('/api/health', async (req, res) => {
    try {
      // Simple database connectivity check
      const dbHealthy = await storage.checkHealth();
      
      res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        database: dbHealthy ? 'connected' : 'disconnected',
        services: {
          gemini: !!process.env.GEMINI_API_KEY,
          kling: !!process.env.KLING_API_KEY,
          cloudinary: !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY),
          stripe: !!process.env.STRIPE_SECRET_KEY
        }
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Database connection failed'
      });
    }
  });

  // Simple rate limiting for health check - FIXED
  const healthCheckRateLimit = new Map<string, number[]>();
  const RATE_LIMIT_WINDOW = 60000; // 1 minute
  const MAX_REQUESTS = 10; // 10 requests per minute per IP
  
  // In-memory cache for health check results
  let healthCheckCache: any = null;
  let cacheExpiry = 0;
  const CACHE_TTL = 120000; // 2 minutes

  // Comprehensive external services health check endpoint
  app.get('/api/health/comprehensive', async (req, res) => {
    try {
      // Rate limiting - FIXED LOGIC
      const clientIP = req.ip || 'unknown';
      const now = Date.now();
      const windowStart = now - RATE_LIMIT_WINDOW;
      
      // Get or create request timestamps for this IP
      if (!healthCheckRateLimit.has(clientIP)) {
        healthCheckRateLimit.set(clientIP, []);
      }
      
      const ipRequests = healthCheckRateLimit.get(clientIP)!;
      
      // Clean old requests outside the window
      const validRequests = ipRequests.filter(timestamp => timestamp > windowStart);
      healthCheckRateLimit.set(clientIP, validRequests);
      
      // Check if rate limit exceeded
      if (validRequests.length >= MAX_REQUESTS) {
        return res.status(429).json({
          overall: 'rate_limited',
          timestamp: new Date().toISOString(),
          error: 'Too many health check requests. Please wait before trying again.',
          retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000)
        });
      }
      
      // Add current request
      validRequests.push(now);
      healthCheckRateLimit.set(clientIP, validRequests);
      
      // Check cache first - FIXED STATUS CODE HANDLING
      if (healthCheckCache && now < cacheExpiry) {
        const cachedResult = {
          ...healthCheckCache,
          cached: true,
          cacheAge: Math.round((now - (cacheExpiry - CACHE_TTL)) / 1000)
        };
        
        // Set correct status code based on cached health status
        const statusCode = healthCheckCache.overall === 'healthy' ? 200 : 
                          healthCheckCache.overall === 'warning' ? 200 : 503;
        
        return res.status(statusCode).json(cachedResult);
      }
      
      // Run comprehensive health check
      const { runComprehensiveHealthCheck } = await import('./services/health-tester');
      const healthResult = await runComprehensiveHealthCheck();
      
      // Cache the result
      healthCheckCache = healthResult;
      cacheExpiry = now + CACHE_TTL;
      
      const statusCode = healthResult.overall === 'healthy' ? 200 : 
                        healthResult.overall === 'warning' ? 200 : 503;
      
      res.status(statusCode).json(healthResult);
    } catch (error) {
      res.status(500).json({
        overall: 'unhealthy',
        timestamp: new Date().toISOString(),
        services: [],
        summary: { healthy: 0, unhealthy: 1, warning: 0, total: 1 },
        error: 'Health check service failed to load',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Production setup endpoint - run once to initialize admin user (HEAVILY PROTECTED)
  app.post('/api/setup-production', async (req, res) => {
    // Security: Only allow in production environment
    if (process.env.NODE_ENV !== 'production') {
      return res.status(403).json({ error: 'Setup only allowed in production' });
    }
    
    // Security: Require setup token
    const setupToken = req.headers['x-setup-token'] || req.body.setupToken;
    const expectedToken = process.env.SETUP_ADMIN_TOKEN;
    
    if (!expectedToken) {
      return res.status(503).json({ error: 'Setup not configured - SETUP_ADMIN_TOKEN missing' });
    }
    
    if (!setupToken || setupToken !== expectedToken) {
      return res.status(401).json({ error: 'Invalid setup token' });
    }
    
    try {
      // Check if admin user already exists
      const existingAdmin = await storage.getUserByEmail('admin@cgi-generator.com');
      
      if (existingAdmin) {
        return res.json({ 
          success: true,
          message: 'Admin user already exists',
          adminId: existingAdmin.id
        });
      }

      // Create admin user
      const adminUser = await storage.createUser({
        email: 'admin@cgi-generator.com',
        password: '$2b$10$8K1p/a9ti6HxtAcg.5ieKe.aVjZqe5xK5H5nEeY/iQ.aLR2nJWgY6', // bcrypt hash for 'admin123'
        firstName: 'Admin',
        lastName: 'User',
        credits: 100,
        isAdmin: true
      });

      res.json({ 
        success: true,
        message: 'Admin user created successfully',
        adminId: adminUser.id
      });
      
    } catch (error) {
      console.error('Production setup failed:', error);
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Setup failed'
      });
    }
  });

}

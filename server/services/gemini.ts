import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import fs from 'fs';
import fetch from 'node-fetch';
// ObjectStorage removed - using Cloudinary now
import { VideoMotionPattern, VideoKeyFrame, MotionTimeline } from '@shared/schema';
import { extractVideoFrames, createMotionTimelineFromPattern, VideoFrameExtractionResult } from './video-frame-extractor';

const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY || ""
);
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY || "");

// ObjectStorage removed - using Cloudinary/direct file access

// Function to get image from Object Storage with correct MIME type detection
export async function getImageDataFromStorage(filePath: string): Promise<{base64: string; mimeType: string}> {
  try {
    console.log("Getting image from storage:", filePath);
    
    // Check if it's a URL (from local file system) or relative path
    let filename = null;
    
    if (filePath.startsWith('http')) {
      // Security: Only allow trusted domains for external image fetching
      const allowedDomains = [
        'res.cloudinary.com',
        'images.unsplash.com',
        'cloudinary.com',
        'i.pinimg.com',           // Pinterest images - main domain  
        'pinimg.com',             // Pinterest images - CDN
        's.pinimg.com',           // Pinterest images - static CDN
        'i.pinimg.pinimg.com'     // Pinterest images - alternative CDN
      ];
      
      let url: URL;
      try {
        url = new URL(filePath);
      } catch {
        throw new Error(`Invalid URL format: ${filePath}`);
      }
      
      const isAllowedDomain = allowedDomains.some(domain => 
        url.hostname === domain || url.hostname.endsWith('.' + domain)
      );
      
      if (!isAllowedDomain) {
        throw new Error(`Domain not allowed: ${url.hostname}. Only trusted image domains are supported.`);
      }
      
      console.log("Fetching external image:", filePath);
      
      try {
        // Add timeout and size limits for security
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch(filePath, { 
          signal: controller.signal as any,
          headers: {
            'User-Agent': 'CGI-Generator/1.0'
          }
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch external image: ${response.status} ${response.statusText}`);
        }
        
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.startsWith('image/')) {
          throw new Error(`Invalid content type: ${contentType}. Only images are allowed.`);
        }
        
        // Check content length before downloading
        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength) > 15 * 1024 * 1024) { // 15MB limit
          throw new Error(`Image too large: ${contentLength} bytes. Maximum 15MB allowed.`);
        }
        
        const buffer = await response.arrayBuffer();
        
        // Double-check size after download
        if (buffer.byteLength > 15 * 1024 * 1024) {
          throw new Error(`Image too large: ${buffer.byteLength} bytes. Maximum 15MB allowed.`);
        }
        
        const base64 = Buffer.from(buffer).toString('base64');
        
        console.log("External image loaded successfully:", {
          url: filePath,
          domain: url.hostname,
          bufferLength: buffer.byteLength,
          base64Length: base64.length,
          mimeType: contentType
        });
        
        return { base64, mimeType: contentType };
      } catch (error) {
        console.error("Error fetching external image:", error);
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error(`Request timeout: Failed to load image within 10 seconds`);
        }
        throw new Error(`Failed to load external image: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else if (filePath.includes('/api/files/uploads/')) {
      // Handle relative paths like /api/files/uploads/filename.jpg
      const match = filePath.match(/\/api\/files\/uploads\/(.+)/);
      if (match) {
        // Security: Prevent directory traversal attacks
        const extractedPath = match[1];
        if (extractedPath.includes('..') || extractedPath.includes('/')) {
          throw new Error(`Invalid file path: directory traversal detected`);
        }
        filename = extractedPath;
      }
    } else if (filePath.startsWith('product-')) {
      // Handle bare filenames like product-1234567890-123456789.jpg
      // Security: Only accept bare filename without path components
      if (filePath.includes('/') || filePath.includes('..')) {
        throw new Error(`Invalid filename: path components not allowed`);
      }
      filename = filePath;
    }
    
    if (filename) {
      // Import path for security checks
      const path = await import('path');
      
      // Security: Use basename to ensure only filename is used
      const safeFilename = path.basename(filename);
      
      // Security: Reject any filename with suspicious characters
      if (safeFilename.includes('..') || safeFilename !== filename) {
        throw new Error(`Invalid filename: security validation failed`);
      }
      
      const localPath = `/tmp/uploads/${safeFilename}`;
      
      // Security: Verify resolved path is within expected directory
      const resolvedPath = path.resolve(localPath);
      const expectedDir = path.resolve('/tmp/uploads');
      if (!resolvedPath.startsWith(expectedDir + path.sep) && resolvedPath !== expectedDir) {
        throw new Error(`Invalid file path: outside allowed directory`);
      }
      
      console.log("Reading local file:", localPath);
      
      // Import fs/promises (path already imported above)
      const fs = await import('fs/promises');
      
      try {
        // Check if file exists
        await fs.access(localPath);
        
        // Read file and determine MIME type
        const buffer = await fs.readFile(localPath);
        const ext = path.extname(filename).toLowerCase();
        
        const mimeTypes: { [key: string]: string } = {
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.gif': 'image/gif',
          '.webp': 'image/webp'
        };
        
        const mimeType = mimeTypes[ext] || 'image/jpeg';
        const base64 = buffer.toString('base64');
        
        console.log("Image loaded from local file:", {
          filePath: localPath,
          bufferLength: buffer.length,
          base64Length: base64.length,
          mimeType,
          fileName: filename
        });
        
        return { base64, mimeType };
      } catch (fileError) {
        console.error("Error reading local file:", fileError);
        throw new Error(`File not found: ${localPath}`);
      }
    }
    
    // If no local file found, throw error
    throw new Error(`Could not load image from: ${filePath}. File not found in local storage or Cloudinary.`);
  } catch (error) {
    console.error("Error getting image from storage:", error);
    throw error;
  }
}

export async function enhancePromptWithGemini(
  productImagePath: string,
  sceneImagePath: string,
  userDescription: string,
  productSize: 'normal' | 'emphasized' = 'normal'
): Promise<string> {
  try {
    console.log("Gemini API request details:", {
      productImagePath,
      sceneImagePath,
      userDescription: userDescription.substring(0, 50),
      apiKeyExists: !!process.env.GEMINI_API_KEY,
      apiKeyLength: process.env.GEMINI_API_KEY?.length || 0
    });

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Load images with correct MIME types from Object Storage
    console.log("Loading images from Object Storage...");
    const [productImageData, sceneImageData] = await Promise.all([
      getImageDataFromStorage(productImagePath),
      getImageDataFromStorage(sceneImagePath)
    ]);

    // Use same clear labeling approach as image generation

const analysisAndPrompt = `
You are a senior CGI compositor.

USER_DIRECTIVES (Arabic may appear): "${userDescription}"
⚠️ You MUST obey USER_DIRECTIVES exactly. If any instruction conflicts with other rules below, USER_DIRECTIVES WIN.

TASK: Write a brief ENGLISH prompt (<= 160 words) for an image model to do a COMPLETE PRODUCT REPLACEMENT.

INPUTS:
• IMAGE_1 = PRODUCT IMAGE (the new item to insert)
• IMAGE_2 = SCENE IMAGE (contains the old item to be replaced)

REQUIRE:
1) TOTAL REMOVAL of the old item in IMAGE_2 (erase bottle/can, labels, cap, liquid, shadows, reflections).
2) FULL REPLACEMENT with the product from IMAGE_1 in the exact same position, angle, and apparent scale.
3) Keep ALL branding/details of the new product unchanged.
4) Match scene lighting, reflections, and shadows.
5) Preserve the scene background and all non-product elements.

OUTPUT: Only the final English prompt text (no lists, no markdown).
`;


    const result = await model.generateContent([
      "PRODUCT IMAGE - new item to use:",
      {
        inlineData: {
          data: productImageData.base64,
          mimeType: productImageData.mimeType
        }
      },
      "SCENE IMAGE - background with item to replace:",
      {
        inlineData: {
          data: sceneImageData.base64,
          mimeType: sceneImageData.mimeType
        }
      },
      analysisAndPrompt
    ]);
    
    const response = await result.response;
    const enhancedPrompt = response.text();
    
    console.log("Gemini enhanced prompt:", enhancedPrompt);
    return enhancedPrompt;
  } catch (error) {
    console.error("Gemini API error:", error);
    // Fallback prompt if Gemini fails
    return `Professional CGI integration of product into scene with realistic lighting, shadows, and natural placement. High quality, photorealistic rendering. ${userDescription}`;
  }
}

// Image Generation using Gemini 2.5 Flash Image with structured output
export async function generateImageWithGemini(
  productImagePath: string,
  sceneImagePath: string,
  enhancedPrompt: string,
  productSize: 'normal' | 'emphasized' = 'normal'
): Promise<{base64: string; mimeType: string}> {
  try {
    console.log("Gemini Image Generation request:", {
      productImagePath,
      sceneImagePath,
      promptLength: enhancedPrompt.length,
      promptPreview: enhancedPrompt.substring(0, 100) + "..."
    });

    // استخدام Gemini 2.5 Flash Image model
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-image-preview" });

    // Load images with correct MIME types from Object Storage
    console.log("Loading images for Gemini Image Generation...");
    const [productImageData, sceneImageData] = await Promise.all([
      getImageDataFromStorage(productImagePath),
      getImageDataFromStorage(sceneImagePath)
    ]);

    // Send request to Gemini with clear English instructions (Arabic prompts cause text responses instead of images)
    const result = await model.generateContent([
      "PRODUCT IMAGE - analyze this item that needs to be placed:",
      {
        inlineData: {
          data: productImageData.base64,
          mimeType: productImageData.mimeType
        }
      },
      "SCENE IMAGE - analyze this background where the item should be placed:",
      {
        inlineData: {
          data: sceneImageData.base64,
          mimeType: sceneImageData.mimeType
        }
      },
      `TASK: Intelligently analyze both images and create a realistic CGI integration with ENHANCED SCENE PRESERVATION.

🔍 SCENE ANALYSIS PHASE:
1. Study the SCENE IMAGE atmosphere: lighting style, mood, color temperature, shadows direction
2. Identify spatial relationships: furniture positions, room layout, perspective angles
3. Analyze existing elements: textures, materials, architectural details, decorative items
4. Detect potential conflicts: items that occupy the same space where product should be placed

🎯 SMART INTEGRATION STEPS:
1. Understand the exact product from the first image (shape, colors, materials, design)
2. Find the most logical and natural location in the scene where this product would fit
3. REMOVE any existing conflicting items completely (no traces, shadows, or outlines left behind)
4. Place the product with exact same appearance from PRODUCT IMAGE
5. Preserve the original scene's lighting characteristics, shadow patterns, and color temperature
6. Maintain the scene's architectural features, room proportions, and spatial relationships
7. Ensure the product follows the same perspective and viewing angle as the scene

🌟 SCENE PRESERVATION REQUIREMENTS:
- Keep the original room's lighting mood and atmosphere intact
- Preserve wall colors, floor patterns, ceiling details, and architectural elements
- Maintain the same camera angle, perspective, and depth of field
- Respect the original scene's style (modern, classic, rustic, etc.)
- Keep background elements positioned exactly as in the original scene
- Preserve the natural flow and composition of the space

USER CONTEXT: ${enhancedPrompt}

${productSize === 'emphasized' ? 
'SIZING: Make the product 25-30% larger than normal while respecting scene proportions and perspective' : 
'SIZING: Use natural proportions that perfectly match the scene scale and perspective'}

🚨 CRITICAL QUALITY REQUIREMENTS:
- Use the exact product appearance from the PRODUCT IMAGE only (no modifications to colors, textures, or design)
- Final result must be photorealistic with professional CGI quality
- No extra products, duplicate items, or additional elements beyond what's requested
- Perfect anatomical proportions for any living creatures (if present)
- Sharp focus and high detail matching the original scene quality
- Natural lighting integration that follows the scene's established light sources
- Return only an image output; do not include any text or descriptions`
    ]);

    const response = await result.response;
    
    // Get the generated image from response
    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) {
      throw new Error('No image generated by Gemini - no candidates in response');
    }

    const parts = candidates[0].content.parts;
    if (!parts || parts.length === 0) {
      throw new Error('No content parts in Gemini response');
    }

    // Search for the image in the response with multiple format support
    for (const part of parts) {
      // Check for inlineData format (most common)
      if (part.inlineData && part.inlineData.mimeType?.startsWith('image/')) {
        const imageBase64 = part.inlineData.data;
        const mimeType = part.inlineData.mimeType;
        
        console.log("Gemini image generated successfully (inlineData):", {
          base64Length: imageBase64.length,
          mimeType,
          responseStructure: 'inlineData'
        });
        
        return { base64: imageBase64, mimeType };
      }
      
      // Check for fileData format (alternative format)
      if (part.fileData && part.fileData.mimeType?.startsWith('image/')) {
        const fileUri = part.fileData.fileUri;
        const mimeType = part.fileData.mimeType;
        
        console.log("Gemini fileData detected - fetching remote URI:", {
          fileUri,
          mimeType,
          responseStructure: 'fileData'
        });
        
        if (fileUri) {
          try {
            // Fetch the remote file URI to get actual image bytes
            const response = await fetch(fileUri);
            if (!response.ok) {
              throw new Error(`Failed to fetch file from URI: ${response.status}`);
            }
            
            // Get the image bytes and convert to base64
            const imageBuffer = await response.arrayBuffer();
            const imageBase64 = Buffer.from(imageBuffer).toString('base64');
            
            // Use MIME type from headers if available, fallback to part.fileData.mimeType
            const actualMimeType = response.headers.get('content-type') || mimeType;
            
            console.log("Gemini image fetched successfully (fileData):", {
              base64Length: imageBase64.length,
              mimeType: actualMimeType,
              originalUri: fileUri,
              responseStructure: 'fileData'
            });
            
            return { base64: imageBase64, mimeType: actualMimeType };
          } catch (fetchError) {
            console.error("Failed to fetch fileData URI:", fetchError);
            // Continue to next part instead of failing entirely
          }
        }
      }
    }

    // Enhanced error logging with exhaustive response structure analysis
    console.error('Gemini response structure analysis:', JSON.stringify({
      candidatesCount: candidates.length,
      partsCount: parts.length,
      partTypes: parts.map(p => Object.keys(p)),
      fullParts: parts.slice(0, 2), // Log first 2 parts for debugging
      detailedPartAnalysis: parts.map((part, index) => ({
        partIndex: index,
        keys: Object.keys(part),
        hasInlineData: !!part.inlineData,
        hasFileData: !!part.fileData,
        inlineDataMimeType: part.inlineData?.mimeType,
        fileDataMimeType: part.fileData?.mimeType,
        textContent: part.text?.substring(0, 100)
      }))
    }, null, 2));

    // Add scene preservation validation warning
    console.warn('Scene preservation may be insufficient - no image generated');
    
    throw new Error('No image data found in Gemini response - check response structure analysis above');
    
  } catch (error) {
    console.error("Gemini Image Generation error:", error);
    throw new Error(`Failed to generate image with Gemini: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Enhanced Video Prompt Generation for Cinematic AI Video Generation
export async function enhanceVideoPromptWithGemini(
  productImagePath: string,
  sceneMediaPath: string, // Could be image or video path
  userDescription: string,
  options: {
    duration?: number; // 5 or 10 seconds
    isSceneVideo?: boolean; // true if sceneMediaPath is a video
    productSize?: 'normal' | 'emphasized'; // Product size preference
  } = {}
): Promise<{
  enhancedPrompt: string;
  cameraMovement?: string;
  shotList?: string;
  imageScenePrompt?: string; // NEW: For static scene generation
  videoMotionPrompt?: string; // NEW: For motion/animation only
  qualityNegativePrompt?: string; // NEW: Anti-distortion negative prompt
  frameExtractionResult?: VideoFrameExtractionResult; // NEW: Extracted frames from Pinterest video
  motionTimeline?: MotionTimeline; // NEW: Structured motion timeline
}> {
  try {
    console.log("Gemini Video Prompt Enhancement:", {
      productImagePath,
      sceneMediaPath,
      userDescription: userDescription.substring(0, 50),
      duration: options.duration || 5,
      isSceneVideo: options.isSceneVideo || false,
      apiKeyExists: !!process.env.GEMINI_API_KEY
    });

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Load product image (always required)
    console.log("Loading media for video prompt generation...");
    const productImageData = await getImageDataFromStorage(productImagePath);
    
    // Enhanced: Process both images and videos for scene analysis
    let sceneImageData = null;
    let extractedMotionPattern = null;
    let frameExtractionResult: VideoFrameExtractionResult | undefined = undefined;
    let motionTimeline: MotionTimeline | undefined = undefined;
    
    if (options.isSceneVideo) {
      // NEW: Pinterest Video Motion Analysis + Frame Extraction
      console.log("🎬 Starting comprehensive Pinterest video analysis...");
      
      // Step 1: Extract motion patterns using Gemini AI
      console.log("🧠 Analyzing motion patterns with Gemini AI...");
      extractedMotionPattern = await analyzeVideoMotionPatterns(sceneMediaPath);
      
      // Step 2: Extract keyframes for visual reference  
      console.log("📸 Extracting keyframes for visual reference...");
      try {
        frameExtractionResult = await extractVideoFrames(sceneMediaPath);
        console.log("✅ Frame extraction completed:", {
          framesExtracted: frameExtractionResult.frames.length,
          gridImageUrl: !!frameExtractionResult.gridImageUrl,
          videoDuration: frameExtractionResult.duration
        });
        
        // Step 3: Create structured motion timeline
        if (extractedMotionPattern && frameExtractionResult) {
          motionTimeline = createMotionTimelineFromPattern(
            extractedMotionPattern,
            frameExtractionResult.duration,
            frameExtractionResult.frames
          );
          console.log("⏰ Motion timeline created with", motionTimeline.segments.length, "segments");
        }
        
      } catch (frameError) {
        console.warn("⚠️ Frame extraction failed, continuing with motion analysis only:", frameError);
        // Continue without frame extraction - motion analysis is still valuable
      }
      
      console.log("✅ Comprehensive video analysis completed:", {
        hasMotionData: !!extractedMotionPattern,
        hasFrames: !!frameExtractionResult,
        hasTimeline: !!motionTimeline,
        motionType: extractedMotionPattern?.primaryMotion || 'none'
      });
      
      // For video analysis, we still use null for sceneImageData since we're analyzing motion
      sceneImageData = null;
    } else {
      sceneImageData = await getImageDataFromStorage(sceneMediaPath);
    }

    const durationSeconds = options.duration || 5;
    const isShortVideo = durationSeconds <= 5;

    const prompt = `
🎯 TWO-PHASE CGI VIDEO SYSTEM: Separate Static Scene from Motion

ANALYZE the images:
1. PRODUCT: Identify key features and design
2. SCENE: Environment, lighting, layout

USER REQUEST: "${userDescription}"

${extractedMotionPattern ? `
🎬 PINTEREST VIDEO MOTION PATTERN ANALYSIS:
📊 EXTRACTED MOTION DATA FROM PINTEREST VIDEO:
- PRIMARY MOTION: ${extractedMotionPattern.primaryMotion}
- CAMERA MOVEMENTS: ${extractedMotionPattern.cameraMovements.join(", ")}
- OBJECT MOTIONS: ${extractedMotionPattern.objectMotions.join(", ")}
- TIMING DURATION: ${extractedMotionPattern.timing.duration}s
- SHOT TYPES: ${extractedMotionPattern.cinematography.shotTypes.join(", ")}
- TRANSITIONS: ${extractedMotionPattern.cinematography.transitions.join(", ")}

🎯 MOTION ADAPTATION INSTRUCTIONS:
- RECOMMENDED FOR PRODUCT: ${extractedMotionPattern.applicableToProduct.recommended ? 'YES' : 'NO'}
- ADAPTATIONS NEEDED: ${extractedMotionPattern.applicableToProduct.adaptations.join("; ")}
- PRESERVE ELEMENTS: ${extractedMotionPattern.applicableToProduct.preserveElements.join("; ")}

🚨 CRITICAL: Apply these EXACT motion patterns to the new product video:
- Use the same camera movement style: ${extractedMotionPattern.primaryMotion}
- Apply similar object motion timing and rhythm
- Maintain the same cinematographic quality and transitions
- Adapt the motion to work naturally with the new product
` : ''}

📏 PRODUCT SIZE PREFERENCE: ${options.productSize || 'normal'}
${options.productSize === 'emphasized' ? `
- المنتج يجب أن يكون مُبرز وبارز كنقطة تركيز في المشهد
- زود حجم المنتج بنسبة 20-30% عن الحجم الطبيعي
- ضع إضاءة إضافية على المنتج ليظهر بوضوح أكبر
- اجعل المنتج في موضع مركزي يلفت الانتباه
- أضف تدرج ضوئي خفيف حول المنتج ليبرز عن الخلفية` : `
- اجعل المنتج بحجم طبيعي ومتناسق مع باقي عناصر المشهد
- لا تزود أو تقلل الحجم، خليه مناسب للمكان
- الإضاءة طبيعية ومتوازنة مع باقي المشهد
- المنتج يندمج بشكل طبيعي دون إبراز زائد`}

🔍 CRITICAL TASK: INTELLIGENT CONFLICT ANALYSIS + TWO PHASES:

PHASE 0 - SMART CONFLICT ANALYSIS:
- Analyze user request: "${userDescription}"
- Identify existing scene elements that CONFLICT with new product
- Examples of conflicts:
  * Adding chandelier → Remove hanging plants, existing lighting fixtures
  * Adding sofa → Remove chairs or furniture in same area  
  * Adding wall art → Remove existing paintings on same wall
  * Adding table → Remove existing table or floor items
- Plan REMOVAL of conflicting elements BEFORE adding new product

PHASE 1 - IMAGE SCENE SETUP (Static Elements After Smart Removal):
- FIRST: Remove ALL conflicting elements completely (no traces)
- What objects should EXIST in the initial scene?
- ONLY add people if explicitly mentioned in user request
- Where should elements be POSITIONED after clearing conflicts?
- What should the environment/lighting LOOK LIKE?

PHASE 2 - VIDEO MOTION (What Changes/Moves):
- What should MOVE during the ${durationSeconds} seconds?
- What ACTIONS should happen?
- What EXPRESSIONS or REACTIONS should change?

EXAMPLE SEPARATION:
- User: "قطة تجري ثم تقف علي الكنبة وتبص للنجفة بأنبهار"
- PHASE 1 (Static): Cat positioned in scene, sofa visible, chandelier prominent in frame
- PHASE 2 (Motion): Cat runs from starting point → stops on sofa → looks up at chandelier with amazement expression

🚨 MANDATORY QUALITY RULES - PHOTOREALISTIC CGI:
- ALL LIVING CREATURES (people, animals) must have PERFECT NATURAL PROPORTIONS
- NO DISTORTION: Faces, bodies, limbs must be anatomically correct
- ANIMALS must look EXACTLY like real animals (proper head size, body shape, fur texture)
- PEOPLE must have natural human proportions (normal head-to-body ratio, realistic facial features)
- NO MELTING, MORPHING, or UNNATURAL BLENDING of elements
- Each element should appear as if photographed in real life, not artificial or cartoon-like
- SHARP FOCUS and HIGH DETAIL for all elements
- Professional CGI quality comparable to Hollywood film standards

UNIVERSAL REQUEST INTERPRETATION RULES FOR VIDEO:
1. ANY request from the user MUST be implemented literally in the final video
2. If user asks to ADD something → ADD it visibly and clearly in the video
3. If user asks to CHANGE something → CHANGE it exactly as requested
4. If user asks to REMOVE something → COMPLETELY ELIMINATE it with no traces remaining from the video
5. If user specifies QUANTITIES → Use exact numbers (not approximate)
6. If user specifies POSITIONS → Place elements exactly where requested in the video
7. If user mentions COLORS → Apply those exact colors in the video
8. If user describes EMOTIONS/EXPRESSIONS → Show them clearly on faces throughout the video
9. NEVER interpret requests as "abstract concepts" - make them VISIBLE and CONCRETE in the video
10. 🚨 CRITICAL: NEVER add people, humans, or characters unless EXPLICITLY mentioned in user request
11. 🚨 DEFAULT SCENE: Product + Environment ONLY (no people unless requested)

CRITICAL ARABIC LANGUAGE SUPPORT: The user request might be in Arabic. You MUST understand and interpret Arabic properly:

ARABIC PHRASES FOR PEOPLE AND OBJECTS:
- "أضف ناس منبهرين بالمنتج" / "ضيف ناس منبهرين بالمنتج" = "Add people amazed by the product" → MANDATORY: Include actual human figures (2-4 people) in the video scene with visible expressions of amazement, wonder, or admiration while looking at or interacting with the product. Do NOT interpret this metaphorically.
- "أضف أشخاص منبهرين بالمنتج" = "Add people amazed by the product" → MANDATORY: Same as above, include actual human people showing amazement, NOT just visual storytelling
- "لا تضيف أشخاص" / "بدون ناس" / "ما في ناس" = "Don't add people" / "Without people" → Do NOT include any human figures
- "شخص واحد" / "واحد منبهر" = "one person" → Include exactly 1 person
- "شخصين" / "اثنين منبهرين" = "two people" → Include exactly 2 people
- "ثلاثة أشخاص" / "ثلاث ناس" = "three people" → Include exactly 3 people
- "أربعة" / "أربع أشخاص" = "four people" → Include exactly 4 people
- "خمسة" / "خمس أشخاص" = "five people" → Include exactly 5 people
- "كتير ناس" / "ناس كثيرة" = "many people" → Include 5+ people in background

ARABIC VIDEO DIRECTION PHRASES:
- "أضف حركة للكاميرا" = "Add camera movement" → Include smooth camera motion
- "زوم على المنتج" = "Zoom on the product" → Focus closer on the product
- "اعرض المنتج من كل الجهات" = "Show the product from all sides" → 360-degree or orbital camera movement
- "خليه يتحرك ببطء" = "Make it move slowly" → Slow, cinematic camera movement
- "أضف حركة سريعة" = "Add fast movement" → Dynamic, energetic camera work
- "اعمل فيديو مثير" = "Make an exciting video" → Dramatic camera movements and transitions
- "خليه يبان أحسن" = "Make it look better" → Enhance visual appeal through camera work
- "لا تحرك الكاميرا كثير" / "بدون حركة سريعة" = "Don't move camera too much" / "Without fast movement" → Use minimal, smooth movements
- "ابدأ من بعيد" = "Start from far" → Begin with wide shot
- "اقرب في النهاية" = "Get close at the end" → End with close-up shot

IMPORTANT VIDEO INTERPRETATION RULES:
1. CHECK FOR NEGATION FIRST: Words like "لا" / "بدون" / "ما في" mean DO NOT include that element
2. If user mentions "ناس" or "أشخاص" (people) WITHOUT negation, MANDATORY: include actual human figures in the video - DO NOT interpret this as mood, atmosphere, or visual storytelling
3. If user mentions "منبهر" or "معجب" (amazed/impressed), show people with expressions of wonder, surprise, or admiration
4. When adding people, use EXACT quantities if specified (شخصين = exactly 2 people)
5. If user mentions camera-related Arabic words like "كاميرا" (camera) or "تصوير" (filming), focus on camera movements
6. If user mentions speed like "بطء" (slow) or "سريع" (fast), adjust the pacing accordingly
7. If user mentions showing "من كل الجهات" (from all sides), suggest orbital or multi-angle shots
8. Translate the EMOTION and ENERGY level, not just literal words
9. NEVER interpret people requests as "visual storytelling" or "mood" - they mean literal human figures
10. ALWAYS output your response in ENGLISH, even if the input is Arabic

🎯 MANDATORY OUTPUT FORMAT - STRICT JSON ONLY:
You must respond with VALID JSON in this exact format:

{
  "imageScenePrompt": "Description of STATIC elements for initial scene - objects, people positions, lighting, environment",
  "videoMotionPrompt": "Description of MOTION/ANIMATION only - what moves, changes, reacts during the ${durationSeconds} seconds",
  "combinedVideoPrompt": "Professional video brief with action verbs: Begin with, Move camera, Show, Focus on, End with",
  "qualityNegativePrompt": "Comma-separated list of things to avoid: deformed, distorted, unnatural proportions, melting, morphing",
  "motionInstructions": "Specific motion timing and camera work details"
}

🚨 CRITICAL QUALITY REQUIREMENTS (Include in qualityNegativePrompt):
- For PEOPLE: "deformed faces, distorted body proportions, extra limbs, malformed anatomy, unnatural head size"
- For ANIMALS: "distorted animal anatomy, unnatural proportions, melting fur, deformed limbs, wrong body shape"  
- For ELEMENT CONFLICTS: "overlapping objects, floating objects, conflicting elements, objects occupying same space, duplicate furniture, multiple chandeliers, multiple of same object"
- GENERAL: "blurry, low quality, amateur CGI, morphing, melting, unnatural blending, poor object removal, incomplete element deletion, traces of removed objects"

RESPOND ONLY WITH VALID JSON - NO OTHER TEXT BEFORE OR AFTER THE JSON
`;

    const contentParts = [];
    
    // Add product image (always included)
    contentParts.push({
      inlineData: {
        data: productImageData.base64,
        mimeType: productImageData.mimeType
      }
    });

    // Add scene image if available (skip if scene is video for now)
    if (sceneImageData) {
      contentParts.push({
        inlineData: {
          data: sceneImageData.base64,
          mimeType: sceneImageData.mimeType
        }
      });
    }

    // Add prompt text last
    contentParts.push(prompt);

    const result = await model.generateContent(contentParts);
    const response = await result.response;
    const fullResponse = response.text();
    
    // Parse JSON response from Gemini
    let parsedResponse: {
      imageScenePrompt?: string;
      videoMotionPrompt?: string; 
      combinedVideoPrompt?: string;
      qualityNegativePrompt?: string;
      motionInstructions?: string;
    } = {};
    
    try {
      // Try to extract JSON from response (handle cases where Gemini adds extra text)
      const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
        console.log("Successfully parsed Gemini JSON response:", {
          hasImageScene: !!parsedResponse.imageScenePrompt,
          hasVideoMotion: !!parsedResponse.videoMotionPrompt,
          hasCombined: !!parsedResponse.combinedVideoPrompt,
          hasNegativePrompt: !!parsedResponse.qualityNegativePrompt
        });
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.warn("Failed to parse Gemini JSON response, falling back to text parsing:", parseError);
      
      // Fallback to text-based parsing if JSON parsing fails
      const imageSceneMatch = fullResponse.match(/imageScenePrompt['"]\s*:\s*['"]([^'"]*)['"]/);
      const videoMotionMatch = fullResponse.match(/videoMotionPrompt['"]\s*:\s*['"]([^'"]*)['"]/);
      const combinedPromptMatch = fullResponse.match(/combinedVideoPrompt['"]\s*:\s*['"]([^'"]*)['"]/);
      
      parsedResponse = {
        imageScenePrompt: imageSceneMatch ? imageSceneMatch[1] : '',
        videoMotionPrompt: videoMotionMatch ? videoMotionMatch[1] : '',
        combinedVideoPrompt: combinedPromptMatch ? combinedPromptMatch[1] : fullResponse,
        qualityNegativePrompt: 'deformed, distorted, unnatural proportions, melting, morphing', // Default
        motionInstructions: ''
      };
    }
    
    // Extract the separated prompts with fallbacks
    const imageScenePrompt = parsedResponse.imageScenePrompt || '';
    const videoMotionPrompt = parsedResponse.videoMotionPrompt || ''; 
    const combinedVideoPrompt = parsedResponse.combinedVideoPrompt || fullResponse;
    const qualityNegativePrompt = parsedResponse.qualityNegativePrompt || 'deformed, distorted, unnatural proportions';
    
    // Use combined prompt as main enhanced prompt, fallback to full response
    const enhancedPrompt = combinedVideoPrompt;
    
    // Extract camera movement suggestions (basic parsing)
    const cameraMovementMatch = fullResponse.match(/camera[^.]*?(pan|zoom|dolly|orbit|push|pull|tilt|track)[^.]*\./i);
    const cameraMovement = cameraMovementMatch ? cameraMovementMatch[0] : undefined;
    
    // Extract shot progression (basic parsing)  
    const shotListMatch = fullResponse.match(/(\d+-\d+s:|wide|medium|close|establishing|detail)[^.]*\./gi);
    const shotList = shotListMatch ? shotListMatch.join(' → ') : undefined;
    
    console.log("Enhanced video prompt generated with separation:", {
      fullResponseLength: fullResponse.length,
      imageSceneLength: imageScenePrompt.length,
      videoMotionLength: videoMotionPrompt.length,
      combinedPromptLength: combinedVideoPrompt.length,
      duration: durationSeconds,
      cameraMovement: cameraMovement?.substring(0, 100),
      shotList: shotList?.substring(0, 100)
    });
    
    return {
      enhancedPrompt,
      cameraMovement,
      shotList,
      imageScenePrompt, // NEW: Static scene description
      videoMotionPrompt, // NEW: Motion-only description
      qualityNegativePrompt, // NEW: Anti-distortion negative prompt
      frameExtractionResult, // NEW: Extracted frames from Pinterest video
      motionTimeline // NEW: Structured motion timeline
    };
    
  } catch (error) {
    console.error("Gemini Video Prompt Enhancement error:", error);
    
    // Fallback cinematic prompt if Gemini fails
    const duration = options.duration || 5;
    const fallbackPrompt = `Professional cinematic ${duration}-second video showcasing the product in the scene. Begin with an establishing shot, then smoothly ${duration <= 5 ? 'zoom in to highlight product details' : 'move around the product with dynamic camera work'}, ending with a hero shot. Use smooth camera movements, professional lighting, and commercial video quality. ${userDescription}`;
    
    return {
      enhancedPrompt: fallbackPrompt,
      cameraMovement: duration <= 5 ? "Smooth zoom-in focus" : "Dynamic orbital movement",
      shotList: duration <= 5 ? "Wide → Close-up" : "Wide → Medium → Close-up → Hero"
    };
  }
}

// Enhanced Video Prompt From Generated Image - NEW FUNCTION
export async function enhanceVideoPromptFromGeneratedImage(
  generatedImageData: {base64: string; mimeType: string},
  projectDetails: {
    duration: number; // 5 or 10 seconds
    includeAudio: boolean;
    userDescription: string;
    productName?: string;
  }
): Promise<{
  enhancedVideoPrompt: string;
  audioPrompt?: string;
  cameraMovements: string;
  cinematicDirection: string;
}> {
  try {
    console.log("🎬 Gemini Video Enhancement from Generated Image:", {
      imageSize: generatedImageData.base64.length,
      mimeType: generatedImageData.mimeType,
      duration: projectDetails.duration,
      includeAudio: projectDetails.includeAudio,
      userDescription: projectDetails.userDescription.substring(0, 50) + "..."
    });

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const durationSeconds = projectDetails.duration;
    const isShortVideo = durationSeconds <= 5;

    const prompt = `
انت خبير cgi 🎯 قم بعمل برومبيت لتحويل هذه الصورة الثابتة الي صورة متحركة وذلك عن طريق موقع kling 

البداية لازم تحلل الصورة كويس جدا وتعرف ايه هي العناصر بالظبط وتركز علي العنصر المهم في الصورة الي هو اكبر عنصر

مع مراعاه طلب المستخدم: "${projectDetails.userDescription}" لو هو عايز يضيف شيء للفيديو

كتابة البرومبيت يكون كالتلي اعداد المشهد:
- ايه اللي يتحرك خلال الـ${durationSeconds} ثواني؟
- ايه الاكشن اللي يحصل؟
- ايه التعبيرات اللي تتغير؟
- الكاميرا تكون اذاي كل شيء بيتم اذاي بالظبط

بمعني انت كخبير cgi لازم توضح كل شيء بالكامل عشان يحول الصورة الثابته دي لصورة متحركة بهدف استعارض المنتج الكبير بشكل جيد وجميل 

🚨 قواعد الجودة الاجبارية - CGI فوتوريليستك:
- كل الكائنات الحية اذا وجدت لازم تكون بنسب طبيعية مثالية
- ممنوع التشويه: الوشوش والاجسام لازم تكون صح تشريحياً

🎯 اخرج الرد بصيغة JSON صحيحة:
{
  "imageScenePrompt": "وصف العناصر الثابتة",
  "videoMotionPrompt": "وصف الحركة بس",
  "combinedVideoPrompt": "البرومبت المتكامل",
  "qualityNegativePrompt": "الاشياء اللي نتجنبها",
  "motionInstructions": "تفاصيل التوقيت والكاميرا"
}
`;

    console.log("🤖 Sending analysis request to Gemini...");

    const result = await model.generateContent([
      {
        inlineData: {
          data: generatedImageData.base64,
          mimeType: generatedImageData.mimeType
        }
      },
      prompt
    ]);

    const response = await result.response;
    const text = response.text();

    console.log("✅ Gemini video analysis complete:", {
      responseLength: text.length,
      containsJSON: text.includes('{') && text.includes('}'),
      containsVideoMotionPrompt: text.includes('videoMotionPrompt'),
      containsCombinedPrompt: text.includes('combinedVideoPrompt')
    });

    // Parse the JSON response
    let parsedResponse: {
      imageScenePrompt?: string;
      videoMotionPrompt?: string;
      combinedVideoPrompt?: string;
      qualityNegativePrompt?: string;
      motionInstructions?: string;
    } = {};
    
    try {
      // Try to extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
        console.log("Successfully parsed Gemini JSON video response:", {
          hasImageScene: !!parsedResponse.imageScenePrompt,
          hasVideoMotion: !!parsedResponse.videoMotionPrompt,
          hasCombined: !!parsedResponse.combinedVideoPrompt,
          hasMotionInstructions: !!parsedResponse.motionInstructions
        });
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.warn("Failed to parse Gemini JSON video response, using text fallback:", parseError);
      // Use entire text as combined prompt if JSON parsing fails
      parsedResponse = {
        combinedVideoPrompt: text,
        motionInstructions: `${durationSeconds}-second video with smooth camera movement`,
        videoMotionPrompt: text
      };
    }

    // Map JSON response to expected output format
    const cameraMovements = parsedResponse.motionInstructions || 
      `Smooth ${durationSeconds}-second camera movement showcasing the product with cinematic flow`;
    
    const cinematicDirection = parsedResponse.videoMotionPrompt || 
      `Professional ${durationSeconds}-second product showcase with dynamic visual progression`;
    
    const audioPrompt = projectDetails.includeAudio ? 
      "Natural ambient environmental sounds matching the scene atmosphere with subtle product-related audio effects" : 
      undefined;

    // Create the enhanced video prompt for Kling AI using the combined prompt from JSON
    const enhancedVideoPrompt = parsedResponse.combinedVideoPrompt || `
PROFESSIONAL CGI VIDEO GENERATION:

🎬 CINEMATOGRAPHY:
${cameraMovements}

🎭 VISUAL NARRATIVE:
${cinematicDirection}

⏱️ TIMING: ${durationSeconds} seconds
🎯 FOCUS: Maintain product prominence throughout the sequence
💫 QUALITY: Ultra-realistic CGI with seamless motion and perfect lighting continuity
📐 ASPECT: Professional composition with balanced framing
✨ STYLE: Cinematic, commercial-grade video production

TECHNICAL REQUIREMENTS:
- Smooth, professional camera work
- Consistent lighting and shadows
- Natural product movement within scene
- High-resolution output (1080p minimum)
- Fluid ${durationSeconds}-second duration
- Commercial-quality post-production feel
`;

    console.log("🎬 Video prompt enhancement completed:", {
      enhancedPromptLength: enhancedVideoPrompt.length,
      audioIncluded: !!audioPrompt,
      cameraMovementsLength: cameraMovements.length,
      cinematicDirectionLength: cinematicDirection.length
    });

    return {
      enhancedVideoPrompt,
      audioPrompt,
      cameraMovements,
      cinematicDirection
    };

  } catch (error) {
    console.error("❌ Gemini video enhancement error:", error);
    
    // Provide intelligent fallback based on project details
    const fallbackCameraMovement = projectDetails.duration <= 5 ? 
      "Smooth 5-second product focus with subtle camera push-in and gentle rotation" :
      "Dynamic 10-second sequence with opening wide shot, smooth dolly movement, and close-up product showcase finale";
    
    const fallbackVideoPrompt = `
Professional CGI video: ${fallbackCameraMovement}. 
Ultra-realistic ${projectDetails.duration}-second commercial-quality sequence showcasing the product.
Cinematic lighting, smooth motion, high-resolution output.
${projectDetails.userDescription}
`;

    return {
      enhancedVideoPrompt: fallbackVideoPrompt,
      audioPrompt: projectDetails.includeAudio ? 
        "Natural ambient environmental sounds matching the scene atmosphere with subtle product-related audio effects" : 
        undefined,
      cameraMovements: fallbackCameraMovement,
      cinematicDirection: `Professional ${projectDetails.duration}-second product showcase sequence`
    };
  }
}


/**
 * Analyze Pinterest video for motion patterns using Gemini AI
 * @param videoUrl Pinterest video URL or path
 * @returns Motion pattern analysis
 */
async function analyzeVideoMotionPatterns(videoUrl: string): Promise<VideoMotionPattern | null> {
  try {
    console.log("🎬 Starting REAL Pinterest video motion analysis...", {
      videoUrl: videoUrl.substring(0, 100) + "...",
      model: "gemini-2.0-flash-exp"
    });

    // Step 1: Download the video with proper headers for Pinterest
    console.log("🔽 Downloading Pinterest video...");
    const videoResponse = await fetch(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'video/mp4,video/*,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Referer': 'https://www.pinterest.com/'
      }
    });
    
    if (!videoResponse.ok) {
      console.error("❌ Pinterest video download failed:", {
        status: videoResponse.status,
        statusText: videoResponse.statusText,
        url: videoUrl.substring(0, 100) + "..."
      });
      throw new Error(`Failed to download video: ${videoResponse.status} ${videoResponse.statusText}`);
    }
    
    const videoArrayBuffer = await videoResponse.arrayBuffer();
    const videoBuffer = Buffer.from(videoArrayBuffer);
    const localVideoPath = `./temp-video-${Date.now()}.mp4`;
    fs.writeFileSync(localVideoPath, videoBuffer);
    
    console.log(`✅ Video downloaded (${videoBuffer.length} bytes)`);

    // Step 2: Upload to Gemini
    console.log("⬆️ Uploading video to Gemini...");
    const uploadResult = await fileManager.uploadFile(localVideoPath, {
      mimeType: 'video/mp4',
      displayName: 'Pinterest Video Motion Analysis'
    });
    
    console.log('✅ Video uploaded:', uploadResult.file.name);

    // Step 3: Wait for processing
    console.log('⏳ Waiting for video processing...');
    let file = await fileManager.getFile(uploadResult.file.name);
    while (file.state === 'PROCESSING') {
      console.log('🔄 Still processing...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      file = await fileManager.getFile(uploadResult.file.name);
    }
    
    if (file.state === 'FAILED') {
      throw new Error('Video processing failed');
    }
    
    console.log('✅ Video processed successfully!');

    // Step 4: Analyze with Gemini
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    const prompt = `
🎬 تحليل فيديو Pinterest للحركة والديناميكية

تحليل هذا الفيديو بدقة واستخراج جميع patterns الحركة:

📋 تحليل مطلوب:

1. الحركة الأساسية:
   - نوع حركة الكاميرا (pan, tilt, zoom, dolly, static)
   - اتجاه وسرعة الحركة
   - سلاسة وثبات الحركة

2. حركة الأشياء:
   - ما هي الأشياء المتحركة؟
   - نوع واتجاه الحركة
   - توقيت الحركات

3. العناصر السينمائية:
   - نوع اللقطات (wide, medium, close-up)
   - أسلوب الانتقالات
   - تغييرات الإضاءة

4. التوقيت:
   - مدة الفيديو
   - اللحظات المهمة
   - إيقاع التغييرات

5. تطبيق على منتج:
   - هل يمكن تطبيق هذه الحركة على منتج آخر؟
   - ما التعديلات المطلوبة؟
   - أي عناصر يجب الحفاظ عليها؟

أجب بصيغة JSON:
{
  "primaryMotion": "وصف الحركة الأساسية",
  "cameraMovements": ["قائمة", "الحركات", "المحددة"],
  "objectMotions": ["قائمة", "حركات", "الأشياء"],
  "timing": {
    "duration": رقم_بالثواني,
    "keyMoments": [
      {"time": وقت_بالثواني, "action": "ما يحدث"}
    ]
  },
  "cinematography": {
    "shotTypes": ["wide", "medium", "close"],
    "transitions": ["cut", "fade", "pan"],
    "lightingChanges": ["وصف الإضاءة"]
  },
  "applicableToProduct": {
    "recommended": true/false,
    "adaptations": ["تعديلات مطلوبة"],
    "preserveElements": ["عناصر للحفاظ عليها"]
  }
}
`;

    console.log("🚀 Analyzing video with Gemini AI...");

    const result = await model.generateContent([
      prompt,
      {
        fileData: {
          mimeType: uploadResult.file.mimeType,
          fileUri: uploadResult.file.uri
        }
      }
    ]);
    
    const analysisResponse = result.response;
    const text = analysisResponse.text();

    // Clean up local file
    fs.unlinkSync(localVideoPath);

    console.log("✅ Gemini video analysis response received:", {
      responseLength: text.length,
      hasContent: !!text
    });

    // Try to parse JSON response
    try {
      // Extract JSON from response (handle potential markdown formatting)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.log("⚠️ No JSON found in response, creating fallback pattern");
        return createFallbackMotionPattern(videoUrl);
      }

      const motionPattern: VideoMotionPattern = JSON.parse(jsonMatch[0]);
      
      console.log("🎯 Pinterest video motion pattern extracted:", {
        primaryMotion: motionPattern.primaryMotion,
        cameraMovements: motionPattern.cameraMovements?.length || 0,
        recommended: motionPattern.applicableToProduct?.recommended
      });

      return motionPattern;

    } catch (parseError) {
      console.log("⚠️ JSON parsing failed, creating structured fallback from text");
      return createFallbackMotionPattern(videoUrl, text);
    }

  } catch (error) {
    console.error("❌ Pinterest video motion analysis failed:", error);
    return createFallbackMotionPattern(videoUrl);
  }
}

/**
 * Create fallback motion pattern when analysis fails
 */
function createFallbackMotionPattern(videoUrl: string, analysisText?: string): VideoMotionPattern {
  return {
    primaryMotion: "Smooth camera movement with product focus",
    cameraMovements: ["gentle zoom", "subtle pan", "product focus"],
    objectMotions: ["product rotation", "ambient movement"],
    timing: {
      duration: 5,
      keyMoments: [
        { time: 0, action: "Opening shot" },
        { time: 2.5, action: "Product focus" },
        { time: 5, action: "Final frame" }
      ]
    },
    cinematography: {
      shotTypes: ["medium", "close-up"],
      transitions: ["smooth"],
      lightingChanges: ["consistent lighting"]
    },
    applicableToProduct: {
      recommended: true,
      adaptations: ["Adjust timing for product", "Maintain professional look"],
      preserveElements: ["Smooth camera work", "Professional pacing"]
    }
  };
}
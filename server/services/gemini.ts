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
      `انت محلل CGI خبير. مهمتك: تحليل صورتين وكتابة تعليمات دقيقة للاستبدال الذكي.

📸 الصورة الأولى (PRODUCT): المنتج الجديد الذي يجب وضعه
📸 الصورة الثانية (SCENE): المشهد الذي يحتوي على منتج قديم يجب استبداله

🎯 طلب المستخدم: "${userDescription}"

🔍 خطوات التحليل الإجبارية:

1️⃣ حلل PRODUCT IMAGE:
   - ما نوع المنتج؟
   - ما حجمه وألوانه؟
   - ما الكتابة والبراند عليه؟

2️⃣ حلل SCENE IMAGE بدقة شديدة:
   - كم عدد المنتجات/القطع الموجودة؟
   - هل المنتجات متقطعة/مشرحة/مقسومة لأجزاء؟
   - كيف مترتبة؟ (متكدسة فوق بعض، جنب بعض، متطايرة، مايلة)
   - ما زاوية/ميلان كل قطعة؟
   - ما الإضاءة والتأثيرات الموجودة؟

3️⃣ قرار الاستبدال الذكي:
   - إذا كان المنتج القديم متقطع لأجزاء: يجب تقطيع المنتج الجديد لنفس عدد الأجزاء
   - إذا كانت الأجزاء متكدسة: يجب تكديس أجزاء المنتج الجديد بنفس الترتيب
   - إذا كانت الأجزاء مايلة/متطايرة: يجب إمالة/تطيير أجزاء المنتج الجديد بنفس الزوايا
   - إذا كان المنتج القديم سليم وواقف: ضع المنتج الجديد سليم وواقف

📐 مطابقة الحجم:
${productSize === 'emphasized' ? 
'- اجعل المنتج أكبر بنسبة 25-30% من الطبيعي' : 
'- استخدم نفس حجم المنتج القديم'}

🎨 الخرج المطلوب (بالإنجليزية فقط):
اكتب تعليمات دقيقة تتضمن:

1. وصف المنتج الجديد من PRODUCT IMAGE
2. عدد القطع/الأجزاء المطلوبة (مثال: "3 fragmented sections")
3. كيفية ترتيب القطع (مثال: "stacked vertically with bottom section tilted left, middle section tilted right, top section upright")
4. زاوية وميلان كل قطعة بالتفصيل
5. الإضاءة والتأثيرات المطلوبة
6. عناصر الخلفية المحفوظة

CRITICAL INSTRUCTION: 
If the SCENE IMAGE shows fragmented/sliced products, you MUST write: "Create [exact number] fragmented sections of the new product, each section showing [specific part], arranged in [exact arrangement]"

Example output:
"Create 3 fragmented sections of the paint bucket stacked vertically: bottom section (base) tilted 15° left, middle section (body with icons) tilted 20° right, top section (lid and brand) upright. Position against dark background with green and pink powder explosions surrounding each section."

اكتب التعليمات الآن.
`
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

  `🚨 ABSOLUTE PRIORITY - SCENE PRESERVATION:
This is NOT a creative task - this is a REPLACEMENT task.
Your ONLY job is to REPLACE the product while keeping EVERYTHING else IDENTICAL.
Think of it like Photoshop's "Content-Aware Fill" - remove old product, paste new product, keep scene 100% same.

FORBIDDEN ACTIONS:
❌ DO NOT redesign the scene
❌ DO NOT change background elements  
❌ DO NOT modify lighting
❌ DO NOT alter colors of non-product elements
❌ DO NOT move objects around
❌ DO NOT change the composition

MANDATORY ACTIONS:
✅ Identify the EXACT product in the scene that needs replacement
✅ Remove ONLY that product completely (0% visibility)
✅ Place new product in EXACT same position
✅ Keep EVERYTHING else pixel-perfect identical

CRITICAL CGI TASK - Follow these steps EXACTLY:

STEP 1 - ANALYZE:
Product from PRODUCT IMAGE: Extract exact appearance (shape, colors, text, design)
Scene from SCENE IMAGE: Identify what needs to be removed AND analyze scene dynamics

STEP 2 - REMOVE COMPLETELY (CRITICAL):
Delete ALL existing products/items from the scene
This includes: main items, accessories, hanging items, mounted items, fixtures
Remove all traces: no shadows, no outlines, no remnants, no ghost images
Clean the space completely - the old product must be 100% invisible

VERIFICATION: Before placing new product, ensure the scene shows NO trace of the old product
If you can still see ANY part of the old product, you have FAILED - remove it completely

STEP 3 - PLACE NEW PRODUCT WITH SCENE DYNAMICS:
Insert the product from PRODUCT IMAGE into the cleaned space
Use the EXACT appearance from PRODUCT IMAGE (same colors, same text, same design)

CRITICAL - Match Original Scene Dynamics:
- If scene shows FLYING/FLOATING products: Make new product fly/float in same style and position
- If scene shows STACKED/LAYERED products: Stack/layer the new product similarly
- If scene shows FRAGMENTED/SLICED products: Fragment/slice the new product in same manner (top, middle, bottom sections)
- If scene shows TILTED/ANGLED products: Match the exact tilt/angle
- If scene shows EXPLODING products: Show new product exploding similarly
- If scene is STATIC/UPRIGHT: Place new product static/upright
- If scene shows MULTIPLE instances: Replicate with new product in same quantity and arrangement

Position in the scene's main focal point
Match scale to the scene (${productSize === 'emphasized' ? 'make 25% larger for emphasis' : 'natural proportions'})

STEP 4 - LIGHTING & EFFECTS:
Match the scene's existing lighting direction and intensity
Preserve background effects (splashes, powder, smoke) and adapt them to surround the new product
If effects have colors, adjust colors to complement the new product's colors
Cast realistic shadows for the new product matching scene lighting
Maintain the scene's atmosphere and mood

STEP 5 - PRESERVE:
Keep background unchanged (walls, floor, sky, environment)
Keep lighting style unchanged
Keep special effects style unchanged (adapt colors if needed)

USER CONTEXT: ${enhancedPrompt}

CRITICAL RULES:
- Output: IMAGE ONLY (no text, no analysis)
- Quality: Professional CGI, photorealistic
- Product: Replicate the QUANTITY and ARRANGEMENT from original scene
- Dynamics: MUST match original scene dynamics
- Removal: COMPLETE removal of old products (zero tolerance)
- Scene: 100% PRESERVATION of all non-product elements

⚠️ FINAL VERIFICATION BEFORE OUTPUT:
1. Is the old product 100% removed? (Check for any traces)
2. Is the new product in the exact same position?
3. Is the background completely unchanged?
4. Are lighting and effects identical to original?
5. Does it look like ONLY the product changed?

If answer to ANY question is NO, DO NOT output - fix it first.

Generate the final composite image now.`
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
🎬 PINTEREST VIDEO MOTION EXTRACTED - APPLY TO NEW PRODUCT:

📊 ORIGINAL VIDEO MOTION DATA:
The product in the Pinterest video performs these EXACT motions:

PRIMARY MOTION: ${extractedMotionPattern.primaryMotion}
- Description: This is the MAIN movement the product does in the video

OBJECT MOTIONS DETECTED: ${extractedMotionPattern.objectMotions.join(", ")}
- These are the EXACT movements the PRODUCT itself performs (not camera)

CAMERA MOVEMENTS: ${extractedMotionPattern.cameraMovements.join(", ")}
- These are how the camera moves around the product

TIMING: ${extractedMotionPattern.timing.duration} seconds total
KEY MOMENTS:
${extractedMotionPattern.timing.keyMoments.map(m => `  - At ${m.time}s: ${m.action}`).join('\n')}

🚨 YOUR CRITICAL TASK:
Make the NEW product perform the EXACT SAME MOTIONS as the original product!

MANDATORY REQUIREMENTS:
1. Use the SAME primary motion: ${extractedMotionPattern.primaryMotion}
2. Apply the SAME object motions: ${extractedMotionPattern.objectMotions.join(", ")}
3. Use the SAME timing pattern
4. Match the SAME camera work style
5. The new product MUST move/transform/animate EXACTLY like the old product did

EXAMPLE:
If original video shows "can inflating like balloon from 0-3s then deflating 3-5s"
Then new product MUST also "inflate like balloon from 0-3s then deflate 3-5s"

DO NOT just add camera movement - the PRODUCT itself must move/change!
  

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
    انت خبير CGI متقدم 🎯

🎥 المهمة: تحليل المنتج في الصورة وإنشاء حركة ديناميكية له

📋 التحليل المطلوب:
1. حدد المنتج الرئيسي في الصورة
2. حدد نوع المنتج (علبة، زجاجة، صندوق، etc.)
3. اقترح حركات ديناميكية مناسبة للمنتج

🎬 أنواع الحركات المتاحة:
- INFLATE/DEFLATE: النفخ والانكماش (مناسب للعلب والزجاجات)
- ROTATE: الدوران حول المحور
- FLOAT: الطيران أو الطفو
- BOUNCE: الارتداد أو القفز
- SCALE: التكبير والتصغير
- GLOW: التوهج أو البريق
- EXPLODE: الانفجار أو التناثر

🎯 اختر الحركة الأنسب للمنتج:
- إذا كان علبة معدنية أو بلاستيك: استخدم INFLATE (النفخ التدريجي)
- إذا كان زجاجة: استخدم ROTATE + GLOW
- إذا كان صندوق: استخدم FLOAT + ROTATE

⏱️ التوقيت (${durationSeconds} ثانية):
- 0-2 ثانية: البداية التدريجية للحركة
- 2-${durationSeconds-1} ثانية: الحركة الكاملة
- الثانية الأخيرة: الاستقرار

🚨 متطلبات الجودة:
- الحركة يجب أن تكون سلسة وطبيعية
- التوقيت يجب أن يكون متناسق
- الإضاءة تتغير مع الحركة

📤 أخرج الرد بصيغة JSON:
{
  "productType": "نوع المنتج (can/bottle/box/etc)",
  "primaryMotion": "الحركة الأساسية (INFLATE/ROTATE/etc)",
  "videoMotionPrompt": "وصف تفصيلي للحركة بالإنجليزية لموقع Kling",
  "combinedVideoPrompt": "البرومبت الكامل للفيديو",
  "qualityNegativePrompt": "الأشياء التي يجب تجنبها",
  "motionInstructions": "تفاصيل التوقيت والحركة"
}

مثال للحركة INFLATE:
"The can starts at normal size, then gradually inflates like a balloon over 3 seconds, reaching 1.5x its original size. The metal surface reflects light dynamically as it expands. At 4 seconds, it slowly deflates back to normal size with smooth, realistic deformation."
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
🎬 PINTEREST VIDEO MOTION ANALYSIS - PRECISE EXTRACTION

Analyze this video frame-by-frame to extract EXACT product transformations.

🎯 PRODUCT TRANSFORMATION TYPES (choose the correct one):

1. INFLATE/DEFLATE:
   - Product GROWS in size (like a balloon inflating)
   - Product SHRINKS in size (like deflating)
   - The product's VOLUME changes
   - Example: Can starts small, then expands to 1.5x size

2. ROTATE:
   - Product spins around its axis
   - Product turns to show different sides
   - Example: Bottle rotates 360 degrees

3. FLOAT/HOVER:
   - Product moves up/down in space
   - Product levitates or flies
   - Example: Product lifts off ground

4. GLOW/PULSE (NO physical motion):
   - ONLY lighting changes
   - Product stays same size and position
   - Just color/brightness changes
   - Example: Product glows brighter but doesn't move

5. STATIC:
   - No movement at all
   - Product is completely still

📋 CRITICAL ANALYSIS STEPS:

**STEP 1: Watch for SIZE CHANGES**
Does the product GET BIGGER or SMALLER during the video?
- If YES → This is INFLATION (if bigger) or DEFLATION (if smaller)
- Look carefully: Does the product's outline/silhouette change size?

**STEP 2: Watch for ROTATION**
Does the product SPIN or TURN?
- If YES → This is ROTATION
- Can you see different sides of the product?

**STEP 3: Watch for POSITION CHANGES**
Does the product MOVE through space?
- If YES → This is FLOATING/HOVERING
- Does it go up, down, left, or right?

**STEP 4: Watch for LIGHTING ONLY**
If NOTHING physical changes, only lights/colors:
- This is GLOW/PULSE (not a real motion)

⚠️ CRITICAL DISTINCTIONS:

Example 1: Can INFLATING (size increases)
- primaryMotion: "Product inflates like a balloon from 1x to 1.5x size"
- objectMotions: ["inflation", "size expansion", "volume increase"]
- NOT: ["rotation", "glow"] ❌

Example 2: Product just GLOWING (no size change)
- primaryMotion: "Static product with pulsing light effects"
- objectMotions: [] (empty - no physical transformation)
- lightingEffects: ["glow pulse", "brightness increase"]

Example 3: Product ROTATING
- primaryMotion: "Product rotates 360 degrees on vertical axis"
- objectMotions: ["rotation", "spin"]
- NOT: ["inflation"] ❌

📤 Output JSON:
{
  "productPhysicallyChanges": true/false,
  "primaryMotion": "EXACT description: inflate/deflate/rotate/float/glow/static",
  "cameraMovements": ["camera motions if any"],
  "objectMotions": ["ONLY physical transformations like inflation, NOT lighting"],
  "timing": {
    "duration": video_duration_seconds,
    "keyMoments": [
      {"time": 0, "action": "starting state and size"},
      {"time": X, "action": "transformation details"},
      {"time": end, "action": "final state and size"}
    ]
  },
  "cinematography": {
    "shotTypes": ["wide/medium/close"],
    "transitions": ["smooth/cut"],
    "lightingChanges": ["lighting description"]
  },
  "applicableToProduct": {
    "recommended": true/false,
    "adaptations": ["needed changes"],
    "preserveElements": ["must keep"]
  }
}

🚨 REMEMBER:
- INFLATION = product gets BIGGER
- ROTATION = product SPINS
- GLOW = ONLY lights change, no physical motion
- Watch the product's OUTLINE to see if size changes!
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
import { GoogleGenerativeAI } from '@google/generative-ai';
// ObjectStorage removed - using Cloudinary now

const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY || ""
);

// ObjectStorage removed - using Cloudinary/direct file access

// Function to get image from Object Storage with correct MIME type detection
async function getImageDataFromStorage(filePath: string): Promise<{base64: string; mimeType: string}> {
  try {
    console.log("Getting image from storage:", filePath);
    
    // Check if it's a URL (from local file system) or relative path
    let filename = null;
    
    if (filePath.startsWith('http')) {
      // Security: Only allow trusted domains for external image fetching
      const allowedDomains = [
        'res.cloudinary.com',
        'images.unsplash.com',
        'cloudinary.com'
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
          signal: controller.signal,
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
        filename = match[1];
      }
    } else if (filePath.startsWith('product-')) {
      // Handle bare filenames like product-1234567890-123456789.jpg
      filename = filePath;
    }
    
    if (filename) {
      const localPath = `/tmp/uploads/${filename}`;
      
      console.log("Reading local file:", localPath);
      
      // Import fs/promises and path
      const fs = await import('fs/promises');
      const path = await import('path');
      
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

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Load images with correct MIME types from Object Storage
    console.log("Loading images from Object Storage...");
    const [productImageData, sceneImageData] = await Promise.all([
      getImageDataFromStorage(productImagePath),
      getImageDataFromStorage(sceneImagePath)
    ]);

    const prompt = `
انت خبير CGI متقدم وهاتعمل تعليمات دقيقة لتوليد الصور بالذكاء الاصطناعي.

قم بتحليل الصورتين دول بدقة:
1. صورة المنتج: عرف اسم المنتج والبراند والشكل والالوان
2. صورة المشهد: شوف ايه الموجود والاضاءة والبيئة

المطلوب منك - استبدال ذكي للمنتج فقط:

🎯 خطوة 1: تحديد المنتج المماثل في المشهد
- احلل طلب المستخدم: "${userDescription}"
- دور على المنتج المماثل أو المشابه في المشهد الحالي
- مثال: لو المنتج الجديد نجفة، دور على النجفة الموجودة في المشهد فقط
- مثال: لو المنتج الجديد كنبة، دور على الكنبة الموجودة في المشهد فقط
- مثال: لو المنتج الجديد لوحة، دور على اللوحة الموجودة على نفس الحيطة فقط

🔄 خطوة 2: الاستبدال المحدود (المنتج المماثل فقط)
1. إذا لم يوجد عنصر مماثل في المشهد، ضع المنتج الجديد في موضع طبيعي مناسب بدون حذف أي عنصر على الإطلاق
2. إذا وُجد أكثر من عنصر مماثل، استبدل عنصراً واحداً فقط (الأكثر وضوحاً/في مركز الكادر/الأقرب للكاميرا) واترك الباقي كما هو

📏 خطوة 3: حجم وإبراز المنتج (مهم جداً)
${productSize === 'emphasized' ? 
`- اجعل المنتج مُبرز وبارز كنقطة تركيز في المشهد
- زود حجم المنتج بنسبة 20-30% عن الحجم الطبيعي
- ضع إضاءة إضافية على المنتج ليظهر بوضوح أكبر
- اجعل المنتج في موضع مركزي يلفت الانتباه
- أضف تدرج ضوئي خفيف حول المنتج ليبرز عن الخلفية` :
`- اجعل المنتج بحجم طبيعي ومتناسق مع باقي عناصر المشهد
- لا تزود أو تقلل الحجم، خليه مناسب للمكان
- الإضاءة طبيعية ومتوازنة مع باقي المشهد
- المنتج يندمج بشكل طبيعي دون إبراز زائد`}
3. اشيل بس المنتج المماثل الموجود الواحد (نفس النوع) - مش أي حاجة تانية
4. استخدم inpainting محدوداً داخل قناع المنتج فقط بدون لمس الخلفية المحيطة
5. ⚠️ مهم جداً: احتفظ بكل باقي عناصر المشهد (طرابيز، كراسي، ديكورات، نباتات، أضاءة إضافية، أثاث)

🎯 خطوة 3: الاضافة المتطابقة مع المشهد
1. حط المنتج الجديد في نفس مكان المنتج القديم تماماً
2. خلي الاضاءة والظلال متطابقة مع إضاءة المشهد الأصلي
3. احتفظ بكل العمارة والتفاصيل (السقف، الحيطان، الارضية، النوافذ) زي ما هي
4. احتفظ بكل الأثاث والديكورات (طرابيز، كراسي، نباتات، إكسسوارات) زي ما هي

🚨 قواعد الحفاظ على المشهد المهمة:
- ⚠️ لا تشيل أو تغير أي شيء إلا المنتج المماثل فقط
- لا تُنشئ نُسخاً متعددة من نفس الكائن، لا تُزيل أو تُعدل أي ديكور/أثاث/إضاءة غير مستهدفة
- احتفظ بكل تفاصيل المشهد الأصلي (طرابيز، كراسي، نباتات، ديكورات، إضاءة)
- الهدف: استبدال منتج واحد فقط وليس إعادة تصميم المشهد
- خلي المشهد يبدو طبيعي كأن المنتج الجديد كان موجود من البداية
- احتفظ بألوان وخامات المشهد الأصلي

اكتب تعليمات مباشرة بالانجليزي للذكاء الاصطناعي للاستبدال المحدود فقط.

`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: productImageData.base64,
          mimeType: productImageData.mimeType
        }
      },
      {
        inlineData: {
          data: sceneImageData.base64,
          mimeType: sceneImageData.mimeType
        }
      }
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

    // تكوين الـ prompt مع الصور للـ multi-image input
    const prompt = `
GENERATE A NEW IMAGE by composing these two input images:

INPUT 1 (Product): Extract this exact product/object
INPUT 2 (Scene): Place the product into this environment

COMPOSITION INSTRUCTIONS:
${enhancedPrompt}

PRODUCT SIZE SPECIFICATIONS:
${productSize === 'emphasized' ? 
`- Make the product PROMINENT and EMPHASIZED as a focal point
- Increase product size by 20-30% compared to natural proportions
- Add enhanced lighting on the product for better visibility
- Place product in a central, attention-grabbing position
- Add subtle light gradient around product to make it stand out from background` :
`- Keep product at NATURAL, PROPORTIONAL size that fits the scene
- Do not oversizend or undersizend the product - make it scene-appropriate
- Use balanced, natural lighting consistent with the scene
- Product should blend naturally without excessive emphasis`}

CRITICAL IMAGE GENERATION REQUIREMENTS:
- CREATE A NEW PHOTOREALISTIC IMAGE (not text description)
- Extract the product from image 1 and seamlessly place it in scene from image 2
- If no matching object exists in the scene, do not remove anything; place the product naturally in a suitable location while preserving all other elements.
- If matching objects exist: Preserve the entire scene 100% unchanged EXCEPT the single existing similar product which must be removed and replaced. Do not duplicate the product.
- Remove exactly one matching instance (most prominent/center/closest to camera), then place the new product in that exact spot; do not delete or alter any other object.
- Use minimal inpainting strictly within the replaced object's mask; do not modify adjacent background, textures, or nearby objects.
- Match lighting, shadows, and perspective perfectly
- Ultra-sharp details, Full HD quality (1920x1080 minimum for landscapes, 1536x1536 for square compositions)
- Use exact product branding, colors, and shape from first image
- Professional CGI quality with no compositing artifacts
- OUTPUT: Return the generated composite image, not text analysis

GENERATE THE COMPOSITE IMAGE NOW.
`;

    // Send request to Gemini with multi-image input using original working format
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: productImageData.base64,
          mimeType: productImageData.mimeType
        }
      },
      {
        inlineData: {
          data: sceneImageData.base64,
          mimeType: sceneImageData.mimeType
        }
      }
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
  } = {}
): Promise<{
  enhancedPrompt: string;
  cameraMovement?: string;
  shotList?: string;
  imageScenePrompt?: string; // NEW: For static scene generation
  videoMotionPrompt?: string; // NEW: For motion/animation only
  qualityNegativePrompt?: string; // NEW: Anti-distortion negative prompt
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

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Load product image (always required)
    console.log("Loading media for video prompt generation...");
    const productImageData = await getImageDataFromStorage(productImagePath);
    
    // For scene, we only process images for now (video analysis comes later)
    const sceneImageData = options.isSceneVideo ? null : await getImageDataFromStorage(sceneMediaPath);

    const durationSeconds = options.duration || 5;
    const isShortVideo = durationSeconds <= 5;

    const prompt = `
🎯 TWO-PHASE CGI VIDEO SYSTEM: Separate Static Scene from Motion

ANALYZE the images:
1. PRODUCT: Identify key features and design
2. SCENE: Environment, lighting, layout

USER REQUEST: "${userDescription}"

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
      qualityNegativePrompt // NEW: Anti-distortion negative prompt
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

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getImageDataFromStorage } from "./storage.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Helper function to get image data from storage (Cloudinary or local)
async function getImageDataFromStorage(filePath: string): Promise<{base64: string; mimeType: string}> {
  try {
    console.log("Fetching image from storage:", filePath);
    
    // Try Cloudinary first if URL contains cloudinary
    if (filePath.includes('cloudinary.com') || filePath.includes('res.cloudinary.com')) {
      console.log("Using Cloudinary URL:", filePath);
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      
      console.log("Cloudinary image fetched successfully:", {
        base64Length: base64.length,
        mimeType: contentType,
        originalUrl: filePath
      });
      
      return { base64, mimeType: contentType };
    }
    
    // Check if it's a URL (from local file system) or relative path
    let filename = null;
    
    if (filePath.startsWith('http')) {
      try {
        // Extract filename from URL path like /api/files/uploads/filename.jpg
        const urlPath = new URL(filePath).pathname;
        const match = urlPath.match(/\/api\/files\/uploads\/(.+)/);
        if (match) {
          filename = match[1];
        }
      } catch (error) {
        console.error("Error parsing URL:", error);
        throw new Error(`Invalid URL: ${filePath}`);
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
  userDescription: string
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
انت خبير CGI متقدم متخصص في الاستبدال الذكي لأي نوع منتج في المشاهد.

🔍 تحليل الصور:
1. صورة المنتج الجديد: حلل النوع، الشكل، الألوان، البراند، الحجم، الوظيفة
2. صورة المشهد الحالي: حلل البيئة، الإضاءة، المنتجات الموجودة، المساحات

🎯 تحليل طلب المستخدم: "${userDescription}"

🧠 نظام الاستبدال الذكي الشامل:

أولاً - تصنيف المنتج تلقائياً:

📦 حاويات/أواني: (علب، زجاجات، أكواب، صناديق، برطمانات) → استبدل الشكل الخارجي + احتفظ بالمحتوى الداخلي
🪑 أثاث/معدات: (كنب، طاولات، مكاتب، كراسي، خزانات، أسرة) → استبدل المنتج بالكامل + احتفظ بالبيئة  
💡 إضاءة/كهرباء: (نجف، لمبات، مصابيح، شموع، أجهزة إلكترونية) → استبدل المصدر + اضبط توزيع الإضاءة
🖼️ ديكور/فنون: (لوحات، مرايا، ساعات، تماثيل، مزهريات فارغة) → استبدل العنصر + احتفظ بالموضع المناسب
🌿 كائنات حية: (نباتات، أشجار، زهور، حيوانات أليفة) → ضع في البيئة الطبيعية المناسبة + اضبط الإضاءة الطبيعية
🍕 طعام/مشروبات: (أكل، عصائر، مأكولات) → ضع على السطح المناسب (طاولة، مطبخ) + اضبط التقديم
👕 ملابس/إكسسوارات: (قمصان، حقائب، ساعات يد، مجوهرات) → ضع بطريقة طبيعية (معلق، على شخص، على سطح)
🎮 ألعاب/رياضة: (ألعاب أطفال، كرات، أدوات رياضية) → ضع في المكان المناسب للاستخدام
🔧 أدوات/معدات: (أدوات يدوية، معدات، آلات) → ضع في السياق المهني/المناسب
🤖 غير محدد/جديد: → حلل وظيفة المنتج + اختر أقرب سياق منطقي

ثانياً - استراتيجية الوضع الذكي:
🎯 لكل منتج: أين المكان الطبيعي؟ ما الحجم المناسب؟ هل يحتاج إضاءة خاصة؟ هل يتفاعل مع عناصر أخرى؟

ثالثاً - قواعد السلامة:
• لا تضع طعام في أماكن غير صحية • لا تضع حيوانات في بيئات ضارة • لا تضع أدوات خطيرة بالقرب من الأطفال • احترم المنطق الفيزيائي

رابعاً - التكامل الطبيعي:
• طابق الإضاءة والظلال • اضبط المقياس والمنظور • أضف تأثيرات بيئية مناسبة • تأكد من الواقعية الفوتوغرافية

اكتب تعليمات مفصلة ودقيقة بالإنجليزية تتضمن: تصنيف المنتج ووظيفته، المكان الأمثل للوضع، العناصر التي تحتاج إزالة/تعديل، متطلبات الإضاءة والجو العام، ضمانات السلامة والمنطق.
`;

    const response = await model.generateContent([
      {
        text: prompt
      },
      {
        inlineData: {
          mimeType: productImageData.mimeType,
          data: productImageData.base64
        }
      },
      {
        inlineData: {
          mimeType: sceneImageData.mimeType,
          data: sceneImageData.base64
        }
      }
    ]);

    const enhancedPrompt = response.response.text();
    console.log("🧠 Universal smart replacement prompt:", {
      promptLength: enhancedPrompt.length,
      preview: enhancedPrompt.substring(0, 150) + "...",
      userRequest: userDescription
    });
    
    return `Generate a CGI image. ${enhancedPrompt}. Ultra-high quality, photorealistic rendering with seamless integration.`;
    
  } catch (error) {
    console.error("Gemini API error:", error);
    return `Generate a CGI image. Smart universal product replacement: ${userDescription}. Preserve existing scene elements and match lighting conditions perfectly. High quality, photorealistic rendering.`;
  }
}

// Image Generation using Gemini 2.5 Flash Image with structured output
export async function generateImageWithGemini(
  productImagePath: string,
  sceneImagePath: string,
  enhancedPrompt: string
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

CRITICAL IMAGE GENERATION REQUIREMENTS:
- CREATE A NEW PHOTOREALISTIC IMAGE (not text description)
- Extract the product from image 1 and seamlessly place it in scene from image 2
- Preserve scene background 100% exactly (lighting, people, buildings, textures)
- Match lighting, shadows, and perspective perfectly
- Ultra-sharp details, high resolution (1024x1024 minimum)
- Use exact product branding, colors, and shape from first image
- Professional CGI quality with no compositing artifacts
- OUTPUT: Return the generated composite image, not text analysis

GENERATE THE COMPOSITE IMAGE NOW.`;

    const response = await model.generateContent([
      {
        text: prompt
      },
      {
        inlineData: {
          mimeType: productImageData.mimeType,
          data: productImageData.base64
        }
      },
      {
        inlineData: {
          mimeType: sceneImageData.mimeType,
          data: sceneImageData.base64
        }
      }
    ]);

    const result = await response.response;
    const candidates = result.candidates || [];
    
    if (candidates.length === 0) {
      throw new Error('No candidates returned from Gemini');
    }

    const parts = candidates[0].content?.parts || [];
    
    // Look for image data in response parts
    for (const part of parts) {
      if (part.inlineData?.data) {
        const base64 = part.inlineData.data;
        const mimeType = part.inlineData.mimeType || 'image/jpeg';
        
        console.log("Gemini image generated successfully (inlineData):", {
          base64Length: base64.length,
          mimeType,
          responseStructure: 'inlineData'
        });
        
        return { base64, mimeType };
      }
      
      if (part.fileData?.fileUri) {
        const fileUri = part.fileData.fileUri;
        const mimeType = part.fileData.mimeType || 'image/jpeg';
        
        console.log("Fetching Gemini generated image from URI:", fileUri);
        
        try {
          const response = await fetch(fileUri);
          if (!response.ok) {
            throw new Error(`Failed to fetch generated image: ${response.status}`);
          }
          
          const arrayBuffer = await response.arrayBuffer();
          const imageBase64 = Buffer.from(arrayBuffer).toString('base64');
          
          // Get actual MIME type from headers if available, fallback to part.fileData.mimeType
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
- Camera movements: ${isShortVideo ? 'Smooth zoom or pan' : 'Complex multi-angle sequence'}

🎬 VIDEO SPECIFICATIONS:
- Duration: ${durationSeconds} seconds
- Style: ${isShortVideo ? 'Product focus with clean transitions' : 'Cinematic storytelling with multiple shots'}
- Quality: Commercial-grade CGI with ultra-realistic rendering
- Motion: Natural physics, realistic lighting changes
- Camera: Professional cinematography ${isShortVideo ? '(single smooth movement)' : '(multiple dynamic angles)'}

📋 OUTPUT STRUCTURE:
1. IMAGE_SCENE_PROMPT: Static scene description (for initial image generation)
2. VIDEO_MOTION_PROMPT: Motion and animation only (for video generation)
3. NEGATIVE_PROMPT: What to avoid (distortions, unnatural elements)

Provide detailed prompts for each phase in English.
`;

    const requestParts = [
      { text: prompt },
      {
        inlineData: {
          mimeType: productImageData.mimeType,
          data: productImageData.base64
        }
      }
    ];

    // Add scene image if available (not a video)
    if (sceneImageData) {
      requestParts.push({
        inlineData: {
          mimeType: sceneImageData.mimeType,
          data: sceneImageData.base64
        }
      });
    }

    const response = await model.generateContent(requestParts);
    const fullResponse = response.response.text();

    // Parse structured response for separated prompts
    const imageSceneMatch = fullResponse.match(/IMAGE_SCENE_PROMPT:([^]*?)(?=VIDEO_MOTION_PROMPT:|NEGATIVE_PROMPT:|$)/i);
    const videoMotionMatch = fullResponse.match(/VIDEO_MOTION_PROMPT:([^]*?)(?=NEGATIVE_PROMPT:|$)/i);
    const negativePromptMatch = fullResponse.match(/NEGATIVE_PROMPT:([^]*?)$/i);

    const imageScenePrompt = imageSceneMatch ? imageSceneMatch[1].trim() : '';
    const videoMotionPrompt = videoMotionMatch ? videoMotionMatch[1].trim() : '';
    const qualityNegativePrompt = negativePromptMatch ? 
      negativePromptMatch[1].trim() : 
      "deformed, distorted, unnatural proportions, melting, morphing, blurry, low quality, artifacts";

    // Fallback: Use full response if separation failed
    const enhancedPrompt = imageScenePrompt && videoMotionPrompt ? 
      `${imageScenePrompt} ${videoMotionPrompt}` : fullResponse;

    // Combined video prompt for services that don't support separation
    const combinedVideoPrompt = `Professional ${durationSeconds}-second CGI video: ${enhancedPrompt}. Commercial quality with realistic physics and lighting.`;

    // Extract camera movement suggestions
    const cameraMovementMatch = fullResponse.match(/(zoom|pan|rotate|orbit|dolly|crane|tracking|aerial)[^.]*\./i);
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
import { GoogleGenerativeAI } from '@google/generative-ai';
import { v2 as cloudinary } from 'cloudinary';

/**
 * Image Quality Enhancement Service
 * نظام تحسين جودة الصور باستخدام Gemini AI و Cloudinary
 */

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export interface ImageQualityAssessment {
  isLowQuality: boolean;
  qualityScore: number; // 1-10 scale
  issues: string[];
  recommendations: string[];
  needsEnhancement: boolean;
}

export interface EnhancementResult {
  originalUrl: string;
  enhancedUrl: string;
  qualityImprovement: number;
  enhancementApplied: string[];
}

/**
 * تقييم جودة الصورة باستخدام Gemini AI
 */
export async function assessImageQuality(imageUrl: string): Promise<ImageQualityAssessment> {
  try {
    console.log("🔍 Assessing image quality for:", imageUrl.substring(0, 50) + '...');
    
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json"
      }
    });

    // جلب الصورة وتحويلها لـ base64
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    
    const imageBuffer = await response.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');
    const mimeType = response.headers.get('content-type') || 'image/jpeg';

    const prompt = `
    تحليل جودة هذه الصورة وتقييمها من ناحية:
    1. الدقة والوضوح (Resolution & Sharpness)
    2. الإضاءة (Lighting)
    3. التباين والألوان (Contrast & Colors)
    4. الضوضاء والتشويش (Noise & Artifacts)
    5. التركيز (Focus)

    أعطني تقييماً شاملاً بالشكل التالي:
    {
      "isLowQuality": boolean,
      "qualityScore": number (1-10),
      "issues": ["قائمة بالمشاكل الموجودة"],
      "recommendations": ["اقتراحات للتحسين"],
      "needsEnhancement": boolean
    }

    معايير التقييم:
    - 1-3: جودة ضعيفة جداً (تحتاج تحسين عاجل)
    - 4-6: جودة متوسطة (قد تحتاج تحسين)
    - 7-8: جودة جيدة (تحسين اختياري)
    - 9-10: جودة ممتازة (لا تحتاج تحسين)
    `;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Image,
          mimeType: mimeType
        }
      }
    ]);

    const assessment = JSON.parse(result.response.text()) as ImageQualityAssessment;
    
    console.log("✅ Image quality assessment completed:", {
      qualityScore: assessment.qualityScore,
      needsEnhancement: assessment.needsEnhancement,
      issuesCount: assessment.issues.length
    });

    return assessment;
    
  } catch (error) {
    console.error("❌ Image quality assessment failed:", error);
    
    // FIXED: Fallback should still suggest enhancement for safety
    return {
      isLowQuality: true,
      qualityScore: 5, // Assume medium quality to trigger enhancement
      issues: ["Could not analyze image quality - applying basic enhancement"],
      recommendations: ["Basic quality improvement recommended"],
      needsEnhancement: true
    };
  }
}

/**
 * تحسين الصورة باستخدام Cloudinary Transformations
 */
export async function enhanceImageWithCloudinary(imageUrl: string, assessment: ImageQualityAssessment): Promise<EnhancementResult> {
  try {
    console.log("🎨 Enhancing image with Cloudinary:", imageUrl.substring(0, 50) + '...');
    
    // Initialize Cloudinary if not done
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      throw new Error('Missing Cloudinary credentials');
    }

    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    // Extract public ID from Cloudinary URL or re-upload - FIXED robust handling
    let publicId: string;
    
    if (imageUrl.includes('cloudinary.com')) {
      // It's already a Cloudinary URL - re-upload to get clean public_id
      const uploadResult = await cloudinary.uploader.upload(imageUrl, {
        folder: 'cgi-generator/enhanced',
        resource_type: 'image'
      });
      publicId = uploadResult.public_id;
    } else {
      // Upload external image to Cloudinary first
      const uploadResult = await cloudinary.uploader.upload(imageUrl, {
        folder: 'cgi-generator/enhanced',
        resource_type: 'image'
      });
      publicId = uploadResult.public_id;
    }

    // Apply enhancement transformations based on assessment - FIXED for proper Cloudinary SDK
    const transformations: any[] = [
      // High quality output format (preserve aspect ratio)
      { width: 1920, crop: 'limit' },
      { fetch_format: 'webp', quality: '90' }
    ];
    const enhancementApplied: string[] = ['Full HD WebP Format'];

    // AI-based enhancement
    if (assessment.qualityScore < 7) {
      transformations.push({ effect: 'improve' });
      enhancementApplied.push('AI Enhancement');
    }

    // Upscaling for low resolution
    if (assessment.issues.some(issue => issue.includes('دقة') || issue.includes('resolution'))) {
      transformations.push({ effect: 'upscale' });
      enhancementApplied.push('Upscaling');
    }

    // Noise reduction
    if (assessment.issues.some(issue => issue.includes('ضوضاء') || issue.includes('noise'))) {
      transformations.push({ effect: 'noise_reduction' });
      enhancementApplied.push('Noise Reduction');
    }

    // Contrast and color enhancement
    if (assessment.issues.some(issue => issue.includes('تباين') || issue.includes('contrast'))) {
      transformations.push({ effect: 'auto_contrast' });
      enhancementApplied.push('Auto Contrast');
    }

    // Brightness adjustment
    if (assessment.issues.some(issue => issue.includes('إضاءة') || issue.includes('lighting'))) {
      transformations.push({ effect: 'auto_brightness' });
      enhancementApplied.push('Auto Brightness');
    }

    // Sharpening
    if (assessment.issues.some(issue => issue.includes('وضوح') || issue.includes('sharp'))) {
      transformations.push({ effect: 'sharpen' });
      enhancementApplied.push('Sharpening');
    }

    // Apply color enhancement for better AI processing
    transformations.push({ effect: 'auto_color' });
    enhancementApplied.push('Auto Color');

    // Build enhanced URL with proper transformation objects
    const enhancedUrl = cloudinary.url(publicId, {
      transformation: transformations
    });

    const result: EnhancementResult = {
      originalUrl: imageUrl,
      enhancedUrl,
      qualityImprovement: Math.min(2, 10 - assessment.qualityScore), // Max 2 points improvement
      enhancementApplied
    };

    console.log("✅ Image enhancement completed:", {
      transformationsApplied: transformations.length,
      enhancementTypes: enhancementApplied,
      estimatedImprovement: result.qualityImprovement
    });

    return result;
    
  } catch (error) {
    console.error("❌ Image enhancement failed:", error);
    
    // Return original URL if enhancement fails
    return {
      originalUrl: imageUrl,
      enhancedUrl: imageUrl,
      qualityImprovement: 0,
      enhancementApplied: ["Enhancement failed - using original"]
    };
  }
}

/**
 * تحقق من احتياج الصورة للتحسين بناءً على المعطيات الأساسية
 */
async function quickQualityCheck(imageUrl: string): Promise<{ needsAIAnalysis: boolean; shouldEnhance: boolean; reason: string }> {
  try {
    // جلب معلومات الصورة
    const response = await fetch(imageUrl, { method: 'HEAD' });
    const contentLength = response.headers.get('content-length');
    
    // فحص سريع للحجم
    if (contentLength) {
      const sizeInKB = parseInt(contentLength) / 1024;
      if (sizeInKB < 100) { // أقل من 100KB = low quality
        return { needsAIAnalysis: false, shouldEnhance: true, reason: 'Small file size detected' };
      }
    }

    // فحص الـ URL للمؤشرات
    if (imageUrl.includes('thumbnail') || imageUrl.includes('small') || imageUrl.includes('150x150')) {
      return { needsAIAnalysis: false, shouldEnhance: true, reason: 'Thumbnail URL detected' };
    }

    // إذا كانت الصورة من Cloudinary ومحسنة مسبقاً
    if (imageUrl.includes('cloudinary.com') && imageUrl.includes('cgi-generator/enhanced')) {
      return { needsAIAnalysis: false, shouldEnhance: false, reason: 'Already enhanced' };
    }

    return { needsAIAnalysis: true, shouldEnhance: false, reason: 'Needs AI analysis' };
    
  } catch (error) {
    console.error("Quick quality check failed:", error);
    return { needsAIAnalysis: true, shouldEnhance: false, reason: 'Check failed - defaulting to AI analysis' };
  }
}

/**
 * عملية التحسين الشاملة: التقييم + التحسين - FIXED with smart heuristics
 */
export async function processImageForQuality(imageUrl: string): Promise<{
  assessment: ImageQualityAssessment;
  enhancement?: EnhancementResult;
  finalUrl: string;
}> {
  try {
    console.log("🚀 Starting comprehensive image quality processing...");
    
    // خطوة 0: فحص سريع لتوفير التكلفة
    const quickCheck = await quickQualityCheck(imageUrl);
    console.log("🔍 Quick quality check result:", quickCheck);

    let assessment: ImageQualityAssessment;
    
    if (quickCheck.needsAIAnalysis) {
      // خطوة 1: تقييم الجودة بـ AI
      assessment = await assessImageQuality(imageUrl);
    } else {
      // استخدام تقييم سريع بدون AI
      assessment = {
        isLowQuality: quickCheck.shouldEnhance,
        qualityScore: quickCheck.shouldEnhance ? 4 : 8,
        issues: quickCheck.shouldEnhance ? [quickCheck.reason] : [],
        recommendations: quickCheck.shouldEnhance ? ['Apply basic enhancement'] : [],
        needsEnhancement: quickCheck.shouldEnhance
      };
    }
    
    // خطوة 2: تحسين الصورة - FIXED to always try enhancement if needed
    let enhancement: EnhancementResult | undefined;
    let finalUrl = imageUrl;
    
    if (assessment.needsEnhancement || assessment.qualityScore < 8 || quickCheck.shouldEnhance) {
      console.log("🎨 Enhancement needed, applying improvements...");
      enhancement = await enhanceImageWithCloudinary(imageUrl, assessment);
      finalUrl = enhancement.enhancedUrl;
    }

    console.log("✅ Image quality processing completed:", {
      originalQuality: assessment.qualityScore,
      enhancementApplied: !!enhancement,
      finalUrl: finalUrl.substring(0, 50) + '...',
      quickCheckReason: quickCheck.reason
    });

    return {
      assessment,
      enhancement,
      finalUrl
    };
    
  } catch (error) {
    console.error("❌ Image quality processing failed:", error);
    
    // FIXED: Enhanced fallback still tries to improve the image
    try {
      console.log("🔄 Trying basic enhancement despite analysis failure...");
      
      const fallbackAssessment: ImageQualityAssessment = {
        isLowQuality: true,
        qualityScore: 5,
        issues: ["Analysis failed - applying basic enhancement"],
        recommendations: ["Basic quality improvement"],
        needsEnhancement: true
      };
      
      const enhancement = await enhanceImageWithCloudinary(imageUrl, fallbackAssessment);
      
      return {
        assessment: fallbackAssessment,
        enhancement,
        finalUrl: enhancement.enhancedUrl
      };
      
    } catch (enhancementError) {
      console.error("❌ Fallback enhancement also failed:", enhancementError);
      
      return {
        assessment: {
          isLowQuality: false,
          qualityScore: 7,
          issues: ["Complete processing failed"],
          recommendations: ["Manual review needed"],
          needsEnhancement: false
        },
        finalUrl: imageUrl
      };
    }
  }
}
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getImageDataFromStorage } from "./storage.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Helper function to get image data from storage (Cloudinary or local)
async function getImageDataFromStorage(imagePath: string): Promise<{base64: string; mimeType: string}> {
  try {
    console.log("Fetching image from storage:", imagePath);
    
    // Try Cloudinary first if URL contains cloudinary
    if (imagePath.includes('cloudinary.com') || imagePath.includes('res.cloudinary.com')) {
      console.log("Using Cloudinary URL:", imagePath);
      const response = await fetch(imagePath);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      
      console.log("Cloudinary image fetched successfully:", {
        base64Length: base64.length,
        mimeType: contentType,
        originalUrl: imagePath
      });
      
      return { base64, mimeType: contentType };
    }
    
    // Fallback to local storage method
    console.log("Attempting local storage fetch for:", imagePath);
    return await getImageDataFromStorage(imagePath);
    
  } catch (error) {
    console.error("Error getting image from storage:", error);
    throw new Error(`File not found in local storage or Cloudinary.`);
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

    const prompt = \`
انت خبير CGI متقدم متخصص في الاستبدال الذكي لأي نوع منتج في المشاهد.

🔍 تحليل الصور:
1. صورة المنتج الجديد: حلل النوع، الشكل، الألوان، البراند، الحجم، الوظيفة
2. صورة المشهد الحالي: حلل البيئة، الإضاءة، المنتجات الموجودة، المساحات

🎯 تحليل طلب المستخدم: "\${userDescription}"

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
- لا تضع طعام في أماكن غير صحية • لا تضع حيوانات في بيئات ضارة • لا تضع أدوات خطيرة بالقرب من الأطفال • احترم المنطق الفيزيائي

رابعاً - التكامل الطبيعي:
- طابق الإضاءة والظلال • اضبط المقياس والمنظور • أضف تأثيرات بيئية مناسبة • تأكد من الواقعية الفوتوغرافية

اكتب تعليمات مفصلة ودقيقة بالإنجليزية تتضمن: تصنيف المنتج ووظيفته، المكان الأمثل للوضع، العناصر التي تحتاج إزالة/تعديل، متطلبات الإضاءة والجو العام، ضمانات السلامة والمنطق.
\`;

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
    
    return \`Generate a CGI image. \${enhancedPrompt}. Ultra-high quality, photorealistic rendering with seamless integration.\`;
    
  } catch (error) {
    console.error("Gemini API error:", error);
    return \`Generate a CGI image. Smart universal product replacement: \${userDescription}. Preserve existing scene elements and match lighting conditions perfectly. High quality, photorealistic rendering.\`;
  }
}

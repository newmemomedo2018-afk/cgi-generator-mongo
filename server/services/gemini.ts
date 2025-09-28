import { GoogleGenerativeAI } from "@google/generative-ai";
import { getImageDataFromStorage } from "./storage.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

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

    const [productImageData, sceneImageData] = await Promise.all([
      getImageDataFromStorage(productImagePath),
      getImageDataFromStorage(sceneImagePath)
    ]);

    const prompt = `
انت خبير CGI متقدم متخصص في الاستبدال الذكي لأي نوع منتج في المشاهد.

تحليل الصور:
1. صورة المنتج الجديد: حلل النوع والشكل والألوان والبراند والحجم والوظيفة
2. صورة المشهد الحالي: حلل البيئة والإضاءة والمنتجات الموجودة والمساحات

تحليل طلب المستخدم: "${userDescription}"

نظام الاستبدال الذكي الشامل:

تصنيف المنتج تلقائياً:
- حاويات (علب، زجاجات، أكواب): استبدل الشكل الخارجي + احتفظ بالمحتوى الداخلي
- أثاث (كنب، طاولات، مكاتب): استبدل المنتج بالكامل + احتفظ بالبيئة  
- إضاءة (نجف، لمبات): استبدل المصدر + اضبط توزيع الإضاءة
- ديكور (لوحات، مرايا): استبدل العنصر + احتفظ بالموضع المناسب
- كائنات حية (نباتات، حيوانات): ضع في البيئة الطبيعية المناسبة
- طعام ومشروبات: ضع على السطح المناسب
- ملابس وإكسسوارات: ضع بطريقة طبيعية
- ألعاب ورياضة: ضع في المكان المناسب للاستخدام
- أدوات ومعدات: ضع في السياق المهني المناسب

قواعد السلامة والتكامل الطبيعي:
طابق الإضاءة والظلال، اضبط المقياس والمنظور، أضف تأثيرات بيئية مناسبة، تأكد من الواقعية الفوتوغرافية.

اكتب تعليمات مفصلة ودقيقة بالإنجليزية تتضمن: تصنيف المنتج ووظيفته، المكان الأمثل للوضع، العناصر التي تحتاج إزالة أو تعديل، متطلبات الإضاءة والجو العام، ضمانات السلامة والمنطق.
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
    console.log("Universal smart replacement prompt generated:", {
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

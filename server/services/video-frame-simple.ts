/**
 * استخراج 6 frames من فيديو Pinterest باستخدام Cloudinary
 */
export async function extractFramesSimple(videoUrl: string, duration: number = 5): Promise<string[]> {
  const frames: string[] = [];
  const frameCount = 6;
  const interval = duration / (frameCount - 1);
  
  try {
    // رفع الفيديو لـ Cloudinary مؤقتاً
    const uploadResponse = await fetch(videoUrl);
    const videoBuffer = await uploadResponse.arrayBuffer();
    
    // رفع الفيديو
    const cloudinary = require('cloudinary').v2;
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { resource_type: 'video', folder: 'temp-videos' },
        (error: any, result: any) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(Buffer.from(videoBuffer));
    });
    
    const publicId = (uploadResult as any).public_id;
    
    // استخراج الـ frames
    for (let i = 0; i < frameCount; i++) {
      const timestamp = i * interval;
      const frameUrl = cloudinary.url(publicId, {
        resource_type: 'video',
        start_offset: timestamp,
        format: 'jpg',
        transformation: [
          { width: 1280, crop: 'limit' },
          { quality: 'auto' }
        ]
      });
      
      frames.push(frameUrl);
    }
    
    // مسح الفيديو المؤقت بعد ساعة
    setTimeout(() => {
      cloudinary.uploader.destroy(publicId, { resource_type: 'video' });
    }, 3600000);
    
    return frames;
    
  } catch (error) {
    console.error('Frame extraction failed:', error);
    return [];
  }
}
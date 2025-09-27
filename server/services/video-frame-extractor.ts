/**
 * Video Frame Extraction Service
 * Extracts 4 keyframes from Pinterest videos for enhanced video generation
 * VERSION: 1.0.0
 */

import fs from 'fs';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { v2 as cloudinary } from 'cloudinary';
import { VideoKeyFrame, MotionTimeline, MotionTimelineSegment } from '@shared/schema';

// Configure Cloudinary
if (!cloudinary.config().cloud_name) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

export interface VideoFrameExtractionResult {
  frames: VideoKeyFrame[];
  gridImageUrl: string;
  duration: number;
  fps: number;
  motionTimeline?: MotionTimeline;
}

/**
 * Extract 4 keyframes from a video at specific timestamps
 */
export async function extractVideoFrames(videoUrl: string): Promise<VideoFrameExtractionResult> {
  const correlationId = randomUUID().substring(0, 8);
  console.log(`🎬 [${correlationId}] Starting video frame extraction:`, {
    videoUrl: videoUrl.substring(0, 100) + "...",
    targetFrames: 4
  });

  try {
    // Step 1: Download video temporarily with proper headers for Pinterest
    console.log(`⬇️ [${correlationId}] Downloading video...`);
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
      console.error(`❌ [${correlationId}] Video download failed:`, {
        status: videoResponse.status,
        statusText: videoResponse.statusText,
        url: videoUrl.substring(0, 100) + "..."
      });
      throw new Error(`Failed to download video: ${videoResponse.status} ${videoResponse.statusText}`);
    }
    
    const videoArrayBuffer = await videoResponse.arrayBuffer();
    const videoBuffer = Buffer.from(videoArrayBuffer);
    const tempVideoPath = `./temp-video-${correlationId}.mp4`;
    fs.writeFileSync(tempVideoPath, videoBuffer);
    
    console.log(`✅ [${correlationId}] Video downloaded (${videoBuffer.length} bytes)`);

    // Step 2: Get video metadata (duration, fps)
    const metadata = await getVideoMetadata(tempVideoPath, correlationId);
    console.log(`📊 [${correlationId}] Video metadata:`, metadata);

    // Step 3: Calculate frame timestamps (0%, 33%, 66%, 100%)
    const frameTimestamps = [
      0,                                    // Start frame (0%)
      metadata.duration * 0.33,             // 1/3 through (33%)
      metadata.duration * 0.66,             // 2/3 through (66%)
      Math.max(0, metadata.duration - 0.1)  // End frame (100% - 0.1s)
    ];

    console.log(`⏱️ [${correlationId}] Frame timestamps:`, frameTimestamps);

    // Step 4: Extract frames using ffmpeg
    const frames: VideoKeyFrame[] = [];
    const tempFramePaths: string[] = [];

    for (let i = 0; i < frameTimestamps.length; i++) {
      const timestamp = frameTimestamps[i];
      const frameId = `frame-${correlationId}-${i}`;
      const framePath = `./temp-${frameId}.jpg`;
      
      console.log(`📸 [${correlationId}] Extracting frame ${i + 1}/4 at ${timestamp.toFixed(2)}s`);
      
      await extractSingleFrame(tempVideoPath, timestamp, framePath, correlationId);
      
      // Upload frame to Cloudinary
      const frameUrl = await uploadFrameToCloudinary(framePath, frameId, correlationId);
      
      frames.push({
        timestamp,
        frameUrl,
        description: `Frame at ${timestamp.toFixed(1)}s (${Math.round((i / 3) * 100)}%)`,
        visualCues: [] // Will be populated by AI analysis later
      });
      
      tempFramePaths.push(framePath);
    }

    // Step 5: Create 2x2 grid image
    console.log(`🎨 [${correlationId}] Creating 2x2 grid image...`);
    const gridImagePath = `./temp-grid-${correlationId}.jpg`;
    await createFrameGrid(tempFramePaths, gridImagePath, correlationId);
    
    // Upload grid to Cloudinary
    const gridImageUrl = await uploadFrameToCloudinary(gridImagePath, `grid-${correlationId}`, correlationId);

    // Step 6: Cleanup temporary files
    console.log(`🧹 [${correlationId}] Cleaning up temporary files...`);
    [tempVideoPath, gridImagePath, ...tempFramePaths].forEach(path => {
      if (fs.existsSync(path)) {
        fs.unlinkSync(path);
      }
    });

    console.log(`✅ [${correlationId}] Frame extraction completed successfully!`, {
      framesExtracted: frames.length,
      gridCreated: !!gridImageUrl,
      duration: metadata.duration,
      fps: metadata.fps
    });

    return {
      frames,
      gridImageUrl,
      duration: metadata.duration,
      fps: metadata.fps
    };

  } catch (error) {
    console.error(`❌ [${correlationId}] Frame extraction failed:`, error);
    throw error;
  }
}

/**
 * Get video metadata using ffprobe
 */
async function getVideoMetadata(videoPath: string, correlationId: string): Promise<{ duration: number; fps: number }> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      videoPath
    ]);

    let output = '';
    ffprobe.stdout.on('data', (data) => {
      output += data.toString();
    });

    ffprobe.stderr.on('data', (data) => {
      console.log(`⚠️ [${correlationId}] ffprobe stderr:`, data.toString());
    });

    ffprobe.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe exited with code ${code}`));
        return;
      }

      try {
        const metadata = JSON.parse(output);
        const videoStream = metadata.streams.find((s: any) => s.codec_type === 'video');
        
        if (!videoStream) {
          reject(new Error('No video stream found'));
          return;
        }

        const duration = parseFloat(metadata.format.duration) || 5.0;
        const fps = eval(videoStream.r_frame_rate) || 30; // e.g., "30/1" -> 30

        resolve({ duration, fps });
      } catch (error) {
        reject(new Error(`Failed to parse ffprobe output: ${error}`));
      }
    });
  });
}

/**
 * Extract a single frame at specific timestamp using ffmpeg
 */
async function extractSingleFrame(videoPath: string, timestamp: number, outputPath: string, correlationId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i', videoPath,
      '-ss', timestamp.toString(),
      '-vframes', '1',
      '-q:v', '2', // High quality
      '-y', // Overwrite output files
      outputPath
    ]);

    ffmpeg.stderr.on('data', (data) => {
      // ffmpeg outputs progress to stderr, so this is normal
      const message = data.toString();
      if (message.includes('error') || message.includes('Error')) {
        console.log(`⚠️ [${correlationId}] ffmpeg error:`, message);
      }
    });

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg exited with code ${code}`));
        return;
      }

      if (!fs.existsSync(outputPath)) {
        reject(new Error(`Frame was not created: ${outputPath}`));
        return;
      }

      resolve();
    });
  });
}

/**
 * Create a 2x2 grid from 4 frame images using ffmpeg
 */
async function createFrameGrid(framePaths: string[], outputPath: string, correlationId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (framePaths.length !== 4) {
      reject(new Error(`Expected 4 frames, got ${framePaths.length}`));
      return;
    }

    // Create 2x2 grid: [0][1]
    //                  [2][3]
    const ffmpeg = spawn('ffmpeg', [
      '-i', framePaths[0], // Top-left
      '-i', framePaths[1], // Top-right
      '-i', framePaths[2], // Bottom-left
      '-i', framePaths[3], // Bottom-right
      '-filter_complex',
      `[0:v][1:v]hstack=inputs=2[top];[2:v][3:v]hstack=inputs=2[bottom];[top][bottom]vstack=inputs=2[grid]`,
      '-map', '[grid]',
      '-q:v', '2', // High quality
      '-y', // Overwrite output files
      outputPath
    ]);

    ffmpeg.stderr.on('data', (data) => {
      const message = data.toString();
      if (message.includes('error') || message.includes('Error')) {
        console.log(`⚠️ [${correlationId}] ffmpeg grid error:`, message);
      }
    });

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg grid creation exited with code ${code}`));
        return;
      }

      if (!fs.existsSync(outputPath)) {
        reject(new Error(`Grid image was not created: ${outputPath}`));
        return;
      }

      resolve();
    });
  });
}

/**
 * Upload frame to Cloudinary
 */
async function uploadFrameToCloudinary(imagePath: string, frameId: string, correlationId: string): Promise<string> {
  try {
    console.log(`☁️ [${correlationId}] Uploading ${frameId} to Cloudinary...`);
    
    const uploadResult = await cloudinary.uploader.upload(imagePath, {
      folder: 'cgi-generator/video-frames',
      public_id: frameId,
      resource_type: 'image',
      transformation: [
        { width: 1024, height: 576, crop: 'fill' }, // 16:9 aspect ratio
        { quality: 'auto' },
        { fetch_format: 'auto' }
      ]
    });

    console.log(`✅ [${correlationId}] Frame uploaded:`, uploadResult.secure_url);
    return uploadResult.secure_url;
    
  } catch (error) {
    console.error(`❌ [${correlationId}] Cloudinary upload failed for ${frameId}:`, error);
    throw error;
  }
}

/**
 * Convert extracted motion pattern to Motion Timeline format
 */
export function createMotionTimelineFromPattern(
  motionPattern: any,
  duration: number,
  frames: VideoKeyFrame[]
): MotionTimeline {
  const segments: MotionTimelineSegment[] = [];
  
  // Divide video into 3 segments based on extracted frames
  for (let i = 0; i < 3; i++) {
    const startTime = frames[i].timestamp;
    const endTime = frames[i + 1].timestamp;
    
    segments.push({
      startTime,
      endTime,
      camera: {
        movement: motionPattern?.cameraMovements?.[i] || 'static',
        direction: 'clockwise', // Default, will be analyzed from frames
        speed: 'medium',
        amount: 15 // degrees or percentage
      },
      subject: {
        motion: motionPattern?.objectMotions?.[i] || 'rotation',
        axis: 'y',
        amount: 30,
        easing: 'ease-in-out'
      },
      lighting: {
        type: 'static',
        intensity: 0.8
      },
      keyDescription: `Segment ${i + 1}: ${startTime.toFixed(1)}s - ${endTime.toFixed(1)}s`
    });
  }

  return {
    totalDuration: duration,
    fps: 30, // Default, will be updated with actual video fps
    segments,
    keyFrames: frames.map(frame => ({
      timestamp: frame.timestamp,
      description: frame.description,
      visualCues: frame.visualCues
    })),
    globalStyle: {
      colorTone: motionPattern?.cinematography?.lightingChanges?.[0] || 'neutral',
      lightingMood: 'professional',
      cameraStyle: motionPattern?.primaryMotion || 'cinematic'
    }
  };
}
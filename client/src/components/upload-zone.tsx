import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CloudUpload, Image as ImageIcon, Loader2 } from "lucide-react";

interface UploadZoneProps {
  onFileUpload: (file: File) => void;
  isUploading: boolean;
  previewUrl?: string;
  label: string;
  sublabel: string;
  testId: string;
  resetKey?: string; // Add resetKey prop to force preview reset
  acceptedTypes?: 'image' | 'video' | 'both'; // New: define accepted file types
}

export default function UploadZone({
  onFileUpload,
  isUploading,
  previewUrl,
  label,
  sublabel,
  testId,
  resetKey,
  acceptedTypes = 'image'
}: UploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [selectedFileType, setSelectedFileType] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up blob URL when component unmounts or preview changes
  useEffect(() => {
    return () => {
      if (localPreview) {
        URL.revokeObjectURL(localPreview);
      }
    };
  }, [localPreview]);

  // Reset local preview when resetKey changes
  useEffect(() => {
    if (resetKey) {
      if (localPreview) {
        URL.revokeObjectURL(localPreview);
      }
      setLocalPreview(null);
      setSelectedFileType(null);
      // Also clear file input to allow re-selecting same file
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [resetKey, localPreview]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only set dragOver to false if we're leaving the main container
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const { clientX, clientY } = e;
    
    if (
      clientX <= rect.left ||
      clientX >= rect.right ||
      clientY <= rect.top ||
      clientY >= rect.bottom
    ) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    try {
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        handleFileSelect(files[0]);
      }
    } catch (error) {
      console.error('Error handling file drop:', error);
    }
  };

  const handleFileSelect = async (file: File) => {
    try {
      // Validate file type based on acceptedTypes
      const isValidType = (() => {
        switch (acceptedTypes) {
          case 'image':
            return file.type.startsWith('image/');
          case 'video':
            return file.type.startsWith('video/');
          case 'both':
            return file.type.startsWith('image/') || file.type.startsWith('video/');
          default:
            return file.type.startsWith('image/');
        }
      })();

      if (!isValidType) {
        console.warn('Invalid file type:', file.type);
        return;
      }

      // Validate file size (50MB limit for videos, 10MB for images)
      const sizeLimit = file.type.startsWith('video/') ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
      if (file.size > sizeLimit) {
        console.warn('File too large:', file.size);
        return;
      }

      // Clean up previous preview
      if (localPreview) {
        URL.revokeObjectURL(localPreview);
        setLocalPreview(null);
      }

      // Create local preview with error handling
      try {
        const newPreview = URL.createObjectURL(file);
        setLocalPreview(newPreview);
        setSelectedFileType(file.type);
      } catch (error) {
        console.error('Error creating preview:', error);
      }

      // Process file upload asynchronously
      await new Promise(resolve => setTimeout(resolve, 0)); // Allow UI to update
      onFileUpload(file);
    } catch (error) {
      console.error('Error in handleFileSelect:', error);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFileSelect(files[0]);
      }
    } catch (error) {
      console.error('Error handling file change:', error);
    }
  };

  return (
    <div data-testid={testId}>
      <Card 
        className={`upload-zone cursor-pointer transition-all ${isDragOver ? "drag-over" : ""}`}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <CardContent className="p-8 text-center">
          {isUploading ? (
            <>
              <Loader2 className="h-12 w-12 mx-auto mb-4 text-primary animate-spin" />
              <p className="text-lg font-medium mb-2">جاري رفع الصورة...</p>
              <p className="text-sm text-muted-foreground">يرجى الانتظار</p>
            </>
          ) : localPreview ? (
            <>
              {/* Dynamic preview based on file type */}
              {selectedFileType?.startsWith('video/') ? (
                <video 
                  src={localPreview} 
                  className="w-full h-48 object-cover rounded-lg mb-4"
                  data-testid={`${testId}-video-preview`}
                  controls
                  muted
                />
              ) : (
                <img 
                  src={localPreview} 
                  alt="معاينة الصورة" 
                  className="w-full h-48 object-cover rounded-lg mb-4"
                  data-testid={`${testId}-preview`}
                />
              )}
              <p className="text-sm text-muted-foreground">انقر لتغيير {acceptedTypes === 'video' ? 'الفيديو' : acceptedTypes === 'both' ? 'الملف' : 'الصورة'}</p>
            </>
          ) : (
            <>
              <CloudUpload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">{label}</p>
              <p className="text-sm text-muted-foreground">{sublabel}</p>
            </>
          )}
        </CardContent>
      </Card>
      
      <input
        ref={fileInputRef}
        type="file"
        accept={
          acceptedTypes === 'image' ? 'image/*' :
          acceptedTypes === 'video' ? 'video/*' :
          acceptedTypes === 'both' ? 'image/*,video/*' :
          'image/*'
        }
        onChange={handleFileChange}
        className="hidden"
        data-testid={`${testId}-input`}
      />
    </div>
  );
}

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Download, Eye, Play, Clock, CheckCircle, XCircle, Loader2, ImageIcon } from "lucide-react";
import type { Project } from "@shared/schema";

interface ProjectCardProps {
  project: Project;
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const getStatusBadge = () => {
    switch (project.status) {
      case "pending":
      case "processing":
      case "enhancing_prompt":
      case "generating_image":
      case "generating_video":
        return (
          <Badge className="status-processing bg-gradient-to-r from-orange-500 to-red-500">
            <Loader2 className="h-3 w-3 me-1 animate-spin" />
            قيد المعالجة
          </Badge>
        );
      case "under_review":
        return (
          <Badge className="status-under-review bg-gradient-to-r from-purple-500 to-indigo-500">
            <Eye className="h-3 w-3 me-1" />
            قيد المراجعة
          </Badge>
        );
      case "completed":
        return (
          <Badge className="status-completed bg-gradient-to-r from-blue-500 to-cyan-500">
            <CheckCircle className="h-3 w-3 me-1" />
            مكتمل
          </Badge>
        );
      case "failed":
        return (
          <Badge className="status-failed bg-gradient-to-r from-red-500 to-pink-500">
            <XCircle className="h-3 w-3 me-1" />
            فاشل
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 me-1" />
            في الانتظار
          </Badge>
        );
    }
  };

  const getStatusText = () => {
    switch (project.status) {
      case "enhancing_prompt":
        return "تحسين الوصف";
      case "generating_image":
        return "إنتاج الصورة";
      case "generating_video":
        return "إنتاج الفيديو";
      case "under_review":
        return "قيد المراجعة";
      case "processing":
        return "قيد المعالجة";
      case "completed":
        return "مكتمل";
      case "failed":
        return "فاشل";
      default:
        return "في الانتظار";
    }
  };

  const handleDownload = async () => {
    if (project.status === "completed") {
      try {
        // Check if we have auth token
        const authToken = localStorage.getItem('auth_token');
        if (!authToken) {
          console.error('No auth token found');
          // Could redirect to login here if needed
          return;
        }

        const response = await fetch(`/api/projects/${project.id}/download`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        
        if (!response.ok) {
          if (response.status === 401) {
            console.error('Authentication failed during download');
            // Could trigger re-login here
            return;
          }
          throw new Error(`فشل في تحميل الملف: ${response.status}`);
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        // Get filename from Content-Disposition header or create default
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = `${project.title}_${project.id}`;
        
        if (contentDisposition) {
          // Try to extract filename from both standard and RFC5987 format
          const standardMatch = contentDisposition.match(/filename="([^"]+)"/);
          const rfc5987Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/);
          
          if (rfc5987Match) {
            filename = decodeURIComponent(rfc5987Match[1]);
          } else if (standardMatch) {
            filename = standardMatch[1];
          }
        } else {
          // Default extension based on content type
          filename += project.contentType === "video" ? ".mp4" : ".png";
        }
        
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        console.log(`✅ Download completed: ${filename}`);
      } catch (error) {
        console.error('Download error:', error);
        // Show user-friendly error message instead of fallback
        // Don't use window.open as it won't include auth headers
      }
    }
  };

  const handlePreview = () => {
    if (project.contentType === "video" && project.outputVideoUrl) {
      // فتح الفيديو في صفحة جديدة مباشرة (مع الحماية الأمنية)
      window.open(project.outputVideoUrl, '_blank', 'noopener,noreferrer');
    } else if (project.outputImageUrl) {
      window.open(project.outputImageUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const formatTimeAgo = (date: Date | string) => {
    const now = new Date();
    const projectDate = new Date(date + "Z");
    
    // Ensure we're working with UTC times for consistent calculation
    const diffInMinutes = Math.floor((now.getTime() - projectDate.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return "الآن";
    if (diffInMinutes < 60) return `منذ ${diffInMinutes} دقيقة`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `منذ ${diffInHours} ساعة`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays > 0) return `منذ ${diffInDays} يوم`;
    return `منذ ${diffInHours} ساعة`; // Fallback for edge cases
  };

  return (
    <Card className="project-card glass-card hover:scale-[1.02] transition-all duration-200 h-full flex flex-col" data-testid={`project-card-${project.id}`}>
      <CardContent className="p-3 sm:p-4 lg:p-5 flex flex-col h-full">
        <div className="flex items-start justify-between mb-3 gap-2">
          <h4 className="font-bold text-sm sm:text-base lg:text-lg leading-tight flex-1 line-clamp-2" title={project.title}>
            {project.title}
          </h4>
          <div className="flex-shrink-0">
            {getStatusBadge()}
          </div>
        </div>
        
        {/* Project Image Preview */}
        <div className="mb-4 flex-shrink-0">
          <div className="relative overflow-hidden rounded-xl group">
            {project.outputImageUrl ? (
              <img 
                src={project.outputImageUrl} 
                alt={`معاينة ${project.title}`}
                className="w-full h-36 sm:h-40 lg:h-44 object-cover transition-transform duration-300 group-hover:scale-105"
                data-testid={`project-preview-${project.id}`}
              />
            ) : project.sceneVideoUrl ? (
              <video 
                src={project.sceneVideoUrl} 
                className="w-full h-36 sm:h-40 lg:h-44 object-cover opacity-60 transition-opacity duration-300 group-hover:opacity-80"
                data-testid={`project-scene-video-${project.id}`}
                muted
                controls={false}
                preload="metadata"
              />
            ) : project.sceneImageUrl ? (
              <img 
                src={project.sceneImageUrl} 
                alt={`مشهد ${project.title}`}
                className="w-full h-36 sm:h-40 lg:h-44 object-cover opacity-60 transition-opacity duration-300 group-hover:opacity-80"
                data-testid={`project-scene-image-${project.id}`}
              />
            ) : (
              <div className="w-full h-36 sm:h-40 lg:h-44 bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center rounded-xl">
                <div className="text-center text-muted-foreground">
                  <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">لا توجد معاينة</p>
                </div>
              </div>
            )}
            
            {/* Overlay for processing status */}
            {project.status !== "completed" && project.status !== "failed" && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-xl">
                <div className="text-center text-white">
                  <div className="animate-spin h-6 w-6 border-2 border-white border-t-transparent rounded-full mx-auto mb-2"></div>
                  <p className="text-xs font-medium">قيد المعالجة</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Progress Bar for Processing Projects */}
        {project.status !== "completed" && project.status !== "failed" && (
          <div className="mb-3 sm:mb-4">
            <div className="flex justify-between text-xs sm:text-sm mb-2">
              <span>المرحلة: {getStatusText()}</span>
              <span data-testid={`project-progress-${project.id}`}>{project.progress || 0}%</span>
            </div>
            <Progress value={project.progress || 0} className="h-2" />
          </div>
        )}

        {/* Error Message */}
        {project.status === "failed" && project.errorMessage && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm text-destructive">{project.errorMessage}</p>
          </div>
        )}

        {/* Action Buttons */}
        {project.status === "completed" && (
          <div className="flex gap-2 mt-4">
            <Button 
              onClick={handleDownload}
              className="gradient-button flex-1 h-9 sm:h-10 text-xs sm:text-sm font-medium transition-all duration-200 hover:shadow-lg"
              data-testid={`download-${project.id}`}
            >
              <Download className="h-4 w-4 me-1" />
              تحميل
            </Button>
            <Button 
              onClick={handlePreview}
              variant="outline"
              className="flex-1 h-9 sm:h-10 text-xs sm:text-sm font-medium glass-card hover:bg-white/10 border-white/30 transition-all duration-200 hover:border-white/50"
              data-testid={`preview-${project.id}`}
            >
              {project.contentType === "video" ? (
                <Play className="h-4 w-4 me-1" />
              ) : (
                <Eye className="h-4 w-4 me-1" />
              )}
              {project.contentType === "video" ? "تشغيل" : "معاينة"}
            </Button>
          </div>
        )}

        {/* Enhanced Prompt Display for Completed Projects */}
        {project.status === "completed" && project.enhancedPrompt && (
          <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <div className="flex items-center mb-2">
              <span className="text-sm font-medium text-blue-400">البرومبت المحسن من Gemini:</span>
            </div>
            <p className="text-sm text-white/80 leading-relaxed" dir="ltr">
              {project.enhancedPrompt}
            </p>
          </div>
        )}

        {/* Project Info */}
        <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground mobile-text-size">
          <span data-testid={`project-type-${project.id}`}>
            {project.contentType === "video" ? "فيديو CGI" : "صورة CGI"}
          </span>
          <span data-testid={`project-time-${project.id}`}>
            {project.createdAt ? formatTimeAgo(project.createdAt) : "منذ لحظات"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

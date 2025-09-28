import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Download, Eye, Play, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
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
            <Loader2 className="h-3 w-3 ml-1 animate-spin" />
            قيد المعالجة
          </Badge>
        );
      case "under_review":
        return (
          <Badge className="status-under-review bg-gradient-to-r from-purple-500 to-indigo-500">
            <Eye className="h-3 w-3 ml-1" />
            قيد المراجعة
          </Badge>
        );
      case "completed":
        return (
          <Badge className="status-completed bg-gradient-to-r from-blue-500 to-cyan-500">
            <CheckCircle className="h-3 w-3 ml-1" />
            مكتمل
          </Badge>
        );
      case "failed":
        return (
          <Badge className="status-failed bg-gradient-to-r from-red-500 to-pink-500">
            <XCircle className="h-3 w-3 ml-1" />
            فاشل
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 ml-1" />
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
        const response = await fetch(`/api/projects/${project.id}/download`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        });
        
        if (!response.ok) {
          throw new Error('فشل في تحميل الملف');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        // Get filename from Content-Disposition header or create default
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = `${project.title}_${project.id}`;
        
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="(.+)"/);
          if (filenameMatch) {
            filename = filenameMatch[1];
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
      } catch (error) {
        console.error('Download error:', error);
        // Fallback to direct download if fetch fails
        window.open(`/api/projects/${project.id}/download`, '_blank');
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
    const projectDate = new Date(date);
    
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
    <Card className="project-card glass-card" data-testid={`project-card-${project.id}`}>
      <CardContent className="p-4 sm:p-6 mobile-card-padding">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h4 className="font-bold truncate flex-1 text-sm sm:text-base" title={project.title}>{project.title}</h4>
          {getStatusBadge()}
        </div>
        
        {/* Project Image Preview */}
        <div className="mb-4">
          {project.outputImageUrl ? (
            <img 
              src={project.outputImageUrl} 
              alt={`معاينة ${project.title}`}
              className="w-full h-32 object-cover rounded-lg"
              data-testid={`project-preview-${project.id}`}
            />
          ) : project.sceneVideoUrl ? (
            <video 
              src={project.sceneVideoUrl} 
              className="w-full h-32 object-cover rounded-lg opacity-50"
              data-testid={`project-scene-video-${project.id}`}
              muted
              controls={false}
              preload="metadata"
            />
          ) : project.sceneImageUrl ? (
            <img 
              src={project.sceneImageUrl} 
              alt={`مشهد ${project.title}`}
              className="w-full h-32 object-cover rounded-lg opacity-50"
              data-testid={`project-scene-image-${project.id}`}
            />
          ) : null}
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
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-0 mb-3 sm:mb-4 mobile-form-spacing">
            <Button 
              onClick={handleDownload}
              className="gradient-button mobile-touch-target mobile-button-padding"
              size="sm"
              data-testid={`download-${project.id}`}
            >
              <Download className="h-4 w-4 ml-1" />
              <span className="text-xs sm:text-sm">تحميل</span>
            </Button>
            <Button 
              onClick={handlePreview}
              variant="outline"
              className="glass-card hover:bg-white/20 text-white border-white/20 mobile-touch-target mobile-button-padding"
              size="sm"
              data-testid={`preview-${project.id}`}
            >
              {project.contentType === "video" ? (
                <Play className="h-4 w-4 ml-1" />
              ) : (
                <Eye className="h-4 w-4 ml-1" />
              )}
              <span className="text-xs sm:text-sm">{project.contentType === "video" ? "تشغيل" : "معاينة"}</span>
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

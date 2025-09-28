const diffInMinutes = Math.floor((Date.now() - new Date(project.createdAt).getTime()) / (1000 * 60));
if (diffInMinutes < 1) return "منذ لحظات";
if (diffInMinutes < 60) return `منذ ${diffInMinutes} دقيقة`;
const diffInHours = Math.floor(diffInMinutes / 60);
if (diffInHours < 24) return `منذ ${diffInHours} ساعة`;
const diffInDays = Math.floor(diffInHours / 24);
return `منذ ${diffInDays} يوم`;

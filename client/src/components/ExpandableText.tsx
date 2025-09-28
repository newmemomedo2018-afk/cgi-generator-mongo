import { useState } from "react";

interface ExpandableTextProps {
  text: string;
  maxLines?: number;
}

export default function ExpandableText({ text, maxLines = 3 }: ExpandableTextProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const lines = text.split('\n');
  const shouldTruncate = lines.length > maxLines;
  const displayText = isExpanded || !shouldTruncate 
    ? text 
    : lines.slice(0, maxLines).join('\n');

  if (!shouldTruncate) {
    return <span>{text}</span>;
  }

  return (
    <div>
      <span>{displayText}</span>
      {!isExpanded && <span>...</span>}
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="text-blue-400 hover:text-blue-300 text-xs mr-2"
      >
        {isExpanded ? "إخفاء" : "اقرأ المزيد"}
      </button>
    </div>
  );
}

import React from 'react';

interface AIAnalysisTextProps {
  content: string;
  className?: string;
}

export const AIAnalysisText: React.FC<AIAnalysisTextProps> = ({ content, className = '' }) => {
  const formatContent = (text: string) => {
    // Split by lines and process each line
    const lines = text.split('\n');
    
    return lines.map((line, index) => {
      const trimmedLine = line.trim();
      
      // Skip empty lines
      if (!trimmedLine) {
        return <br key={index} />;
      }
      
      // Headers with ### (colored and bigger)
      if (trimmedLine.match(/^#{1,6}\s/)) {
        const cleanHeader = trimmedLine.replace(/^#{1,6}\s/, '').trim();
        const headerLevel = (trimmedLine.match(/^#+/) || [''])[0].length;
        
        if (headerLevel <= 2) {
          return (
            <h3 key={index} className="text-xl font-bold text-blue-600 mt-6 mb-3">
              {cleanHeader}
            </h3>
          );
        } else {
          return (
            <h4 key={index} className="text-lg font-semibold text-purple-600 mt-4 mb-2">
              {cleanHeader}
            </h4>
          );
        }
      }
      
      // Process bold text **text** -> <strong>text</strong>
      if (trimmedLine.includes('**')) {
        const parts = trimmedLine.split(/(\*\*[^*]+\*\*)/);
        return (
          <p key={index} className="text-gray-900 mb-3 leading-relaxed">
            {parts.map((part, partIndex) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                const boldText = part.slice(2, -2);
                return <strong key={partIndex} className="font-semibold text-gray-900">{boldText}</strong>;
              }
              return part;
            })}
          </p>
        );
      }
      
      // List items
      if (trimmedLine.match(/^[-•*]\s/) || trimmedLine.match(/^\d+\.\s/)) {
        const listContent = trimmedLine.replace(/^[-•*]\s/, '').replace(/^\d+\.\s/, '');
        return (
          <li key={index} className="text-gray-900 mb-1 ml-4">
            {listContent}
          </li>
        );
      }
      
      // Regular paragraphs
      return (
        <p key={index} className="text-gray-900 mb-3 leading-relaxed">
          {trimmedLine}
        </p>
      );
    });
  };

  return (
    <div className={`ai-analysis-content prose prose-sm max-w-none ${className}`}>
      {formatContent(content)}
    </div>
  );
};
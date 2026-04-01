import React from 'react';
import ReactMarkdown from 'react-markdown';

interface LoreContentProps {
  content: string;
  onLinkClick: (title: string) => void;
}

export const LoreContent: React.FC<LoreContentProps> = ({ content, onLinkClick }) => {
  // Simple regex to find [[Lore Title]]
  const parts = content.split(/(\[\[.*?\]\])/g);

  return (
    <div className="prose prose-invert max-w-none prose-sm leading-relaxed text-neutral-white">
      {parts.map((part, index) => {
        if (part.startsWith('[[') && part.endsWith(']]')) {
          const title = part.slice(2, -2);
          return (
            <button
              key={index}
              onClick={() => onLinkClick(title)}
              className="text-gold-default hover:underline font-bold italic"
            >
              {title}
            </button>
          );
        }
        return <ReactMarkdown key={index}>{part}</ReactMarkdown>;
      })}
    </div>
  );
};

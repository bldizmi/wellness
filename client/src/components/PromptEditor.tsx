import React, { useState, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Copy, Eye, EyeOff } from 'lucide-react';

interface PromptEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  showVariables?: boolean;
  variables?: string[];
}

export const PromptEditor: React.FC<PromptEditorProps> = ({
  value,
  onChange,
  placeholder = "Enter your prompt template...",
  className = "",
  showVariables = true,
  variables = ["taskTitle", "currentDate", "previousAttemptsSection", "imageCount"]
}) => {
  const [showPreview, setShowPreview] = useState(false);

  // Highlight variables in the text
  const highlightVariables = (text: string) => {
    if (!showPreview) return text;
    
    let highlighted = text;
    variables.forEach(variable => {
      const regex = new RegExp(`{{${variable}}}`, 'g');
      highlighted = highlighted.replace(
        regex,
        `<span class="bg-blue-600/30 text-blue-300 px-1 rounded">{{${variable}}}</span>`
      );
    });
    return highlighted;
  };

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('prompt-editor') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = value.substring(0, start);
      const after = value.substring(end, value.length);
      const newText = before + `{{${variable}}}` + after;
      
      onChange(newText);
      
      // Reset cursor position
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length + 4, start + variable.length + 4);
      }, 0);
    }
  };

  return (
    <div className="space-y-3">
      {showVariables && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-400">Variables:</span>
          {variables.map((variable) => (
            <Button
              key={variable}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => insertVariable(variable)}
              className="h-7 px-2 text-xs border-gray-500 hover:bg-gray-600"
            >
              <Copy className="h-3 w-3 mr-1" />
              {`{{${variable}}}`}
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setShowPreview(!showPreview)}
            className="h-7 px-2 text-xs ml-2"
          >
            {showPreview ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </Button>
        </div>
      )}
      
      <div className="relative">
        <Textarea
          id="prompt-editor"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`font-mono text-sm resize-none ${className}`}
          style={{ minHeight: '300px' }}
        />
        
        {showPreview && (
          <div 
            className="absolute inset-0 pointer-events-none p-3 font-mono text-sm text-transparent overflow-auto"
            style={{ 
              background: 'transparent',
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word'
            }}
          >
            <div 
              dangerouslySetInnerHTML={{ 
                __html: highlightVariables(value) 
              }}
            />
          </div>
        )}
      </div>
      
      <div className="text-xs text-gray-400">
        {value.length} characters • {value.split('\n').length} lines
      </div>
    </div>
  );
};
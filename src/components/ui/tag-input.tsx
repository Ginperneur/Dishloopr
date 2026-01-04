import { useState, KeyboardEvent } from 'react';
import { X, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface TagInputProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  placeholder?: string;
  variant?: 'outline' | 'secondary' | 'default';
}

export function TagInput({ 
  tags, 
  onTagsChange, 
  placeholder = 'Typ en druk Enter...',
  variant = 'outline'
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('');

  const processInput = () => {
    if (!inputValue.trim()) return;
    
    // Split by comma or just add single item
    const newTags = inputValue
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0 && !tags.includes(t));
    
    if (newTags.length > 0) {
      onTagsChange([...tags, ...newTags]);
    }
    setInputValue('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      processInput();
    }
  };

  const removeTag = (tagToRemove: string) => {
    onTagsChange(tags.filter(t => t !== tagToRemove));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {tags.map((tag) => (
          <Badge key={tag} variant={variant} className="capitalize pr-1">
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="ml-1 hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-8"
        />
        <Button size="sm" variant="outline" type="button" onClick={processInput}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Druk Enter of gebruik komma's om meerdere items toe te voegen
      </p>
    </div>
  );
}

import { useState, useRef } from 'react';
import { Upload, X, ImagePlus, Loader2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RestaurantImageUploadProps {
  restaurantId: string;
  restaurantName: string;
  existingImages: string[];
  onImagesUpdate: (images: string[]) => void;
}

export function RestaurantImageUpload({
  restaurantId,
  restaurantName,
  existingImages = [],
  onImagesUpdate
}: RestaurantImageUploadProps) {
  const [images, setImages] = useState<string[]>(existingImages);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const newImages: string[] = [];

    for (const file of Array.from(files)) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is geen afbeelding`);
        continue;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} is te groot (max 5MB)`);
        continue;
      }

      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${restaurantId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('restaurant-images')
          .upload(fileName, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast.error(`Upload mislukt: ${file.name}`);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('restaurant-images')
          .getPublicUrl(fileName);

        newImages.push(publicUrl);
      } catch (error) {
        console.error('Error uploading file:', error);
        toast.error(`Fout bij uploaden: ${file.name}`);
      }
    }

    if (newImages.length > 0) {
      const updatedImages = [...images, ...newImages];
      setImages(updatedImages);
      await saveImages(updatedImages);
      toast.success(`${newImages.length} afbeelding(en) geüpload`);
    }

    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = async (index: number) => {
    const imageUrl = images[index];
    const updatedImages = images.filter((_, i) => i !== index);
    
    // Try to delete from storage
    try {
      const path = imageUrl.split('/restaurant-images/')[1];
      if (path) {
        await supabase.storage.from('restaurant-images').remove([path]);
      }
    } catch (error) {
      console.error('Error deleting image from storage:', error);
    }

    setImages(updatedImages);
    await saveImages(updatedImages);
    toast.success('Afbeelding verwijderd');
  };

  const moveImage = async (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= images.length) return;
    
    const updatedImages = [...images];
    const [movedImage] = updatedImages.splice(fromIndex, 1);
    updatedImages.splice(toIndex, 0, movedImage);
    
    setImages(updatedImages);
    await saveImages(updatedImages);
  };

  const saveImages = async (imagesToSave: string[]) => {
    setSaving(true);
    const { error } = await supabase
      .from('restaurants')
      .update({ images: imagesToSave })
      .eq('id', restaurantId);

    if (error) {
      console.error('Error saving images:', error);
      toast.error('Afbeeldingen opslaan mislukt');
    } else {
      onImagesUpdate(imagesToSave);
    }
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ImagePlus className="h-5 w-5" />
          Afbeeldingen ({images.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Image Grid */}
        {images.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {images.map((imageUrl, index) => (
              <div
                key={imageUrl}
                className="relative group aspect-video rounded-lg overflow-hidden border border-border"
              >
                <img
                  src={imageUrl}
                  alt={`${restaurantName} - ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                
                {/* Overlay with controls */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  {index > 0 && (
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => moveImage(index, index - 1)}
                      title="Naar links"
                    >
                      ←
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => removeImage(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  {index < images.length - 1 && (
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => moveImage(index, index + 1)}
                      title="Naar rechts"
                    >
                      →
                    </Button>
                  )}
                </div>

                {/* Position indicator */}
                <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                  {index === 0 ? 'Cover' : `#${index + 1}`}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Upload Button */}
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex-1"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploaden...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Afbeeldingen toevoegen
              </>
            )}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          De eerste afbeelding wordt als cover gebruikt. Max 5MB per afbeelding. Ondersteunde formaten: JPG, PNG, WebP.
        </p>

        {saving && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Opslaan...
          </div>
        )}
      </CardContent>
    </Card>
  );
}

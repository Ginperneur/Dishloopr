import { useState, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';

interface ImageGalleryProps {
  images: string[];
  restaurantName: string;
}

interface TouchState {
  startX: number;
  startY: number;
  isDragging: boolean;
}

export function ImageGallery({ images, restaurantName }: ImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set([0]));
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const touchRef = useRef<TouchState>({ startX: 0, startY: 0, isDragging: false });
  const lastTapRef = useRef<number>(0);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  const handlePrev = useCallback(() => {
    if (zoomLevel > 1) return; // Don't navigate when zoomed
    setCurrentIndex((prev) => {
      const newIndex = prev === 0 ? images.length - 1 : prev - 1;
      setLoadedImages((loaded) => new Set([...loaded, newIndex]));
      return newIndex;
    });
  }, [images.length, zoomLevel]);

  const handleNext = useCallback(() => {
    if (zoomLevel > 1) return; // Don't navigate when zoomed
    setCurrentIndex((prev) => {
      const newIndex = prev === images.length - 1 ? 0 : prev + 1;
      setLoadedImages((loaded) => new Set([...loaded, newIndex]));
      return newIndex;
    });
  }, [images.length, zoomLevel]);

  const handleThumbnailClick = (index: number) => {
    setCurrentIndex(index);
    setLoadedImages((loaded) => new Set([...loaded, index]));
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') handlePrev();
    if (e.key === 'ArrowRight') handleNext();
    if (e.key === 'Escape') {
      if (zoomLevel > 1) {
        resetZoom();
      } else {
        setIsFullscreen(false);
      }
    }
    if (e.key === '+' || e.key === '=') zoomIn();
    if (e.key === '-') zoomOut();
  }, [handlePrev, handleNext, zoomLevel]);

  // Touch handlers for swipe
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      isDragging: true
    };

    // Double tap to zoom
    const now = Date.now();
    if (now - lastTapRef.current < 300 && isFullscreen) {
      if (zoomLevel > 1) {
        resetZoom();
      } else {
        setZoomLevel(2.5);
      }
    }
    lastTapRef.current = now;
  }, [isFullscreen, zoomLevel]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchRef.current.isDragging) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchRef.current.startX;
    const deltaY = touch.clientY - touchRef.current.startY;

    // If zoomed, pan the image
    if (zoomLevel > 1 && isFullscreen) {
      e.preventDefault();
      setPanPosition(prev => ({
        x: prev.x + deltaX * 0.5,
        y: prev.y + deltaY * 0.5
      }));
      touchRef.current.startX = touch.clientX;
      touchRef.current.startY = touch.clientY;
    }
  }, [zoomLevel, isFullscreen]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchRef.current.isDragging) return;
    
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchRef.current.startX;
    const deltaY = touch.clientY - touchRef.current.startY;
    
    // Only swipe if not zoomed and horizontal swipe is dominant
    if (zoomLevel === 1 && Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX > 0) {
        handlePrev();
      } else {
        handleNext();
      }
    }

    touchRef.current.isDragging = false;
  }, [handlePrev, handleNext, zoomLevel]);

  // Zoom functions
  const zoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(prev + 0.5, 4));
  }, []);

  const zoomOut = useCallback(() => {
    setZoomLevel(prev => {
      const newZoom = Math.max(prev - 0.5, 1);
      if (newZoom === 1) setPanPosition({ x: 0, y: 0 });
      return newZoom;
    });
  }, []);

  const resetZoom = useCallback(() => {
    setZoomLevel(1);
    setPanPosition({ x: 0, y: 0 });
  }, []);

  const closeFullscreen = useCallback(() => {
    resetZoom();
    setIsFullscreen(false);
  }, [resetZoom]);

  if (!images || images.length === 0) {
    return (
      <div className="h-56 md:h-96 bg-muted flex items-center justify-center text-muted-foreground">
        Geen afbeeldingen beschikbaar
      </div>
    );
  }

  return (
    <>
      {/* Main Gallery */}
      <div 
        className="relative h-56 md:h-96 overflow-hidden bg-muted group touch-pan-y"
        onKeyDown={handleKeyDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        tabIndex={0}
      >
        <AnimatePresence mode="wait">
          <motion.img
            key={currentIndex}
            src={images[currentIndex]}
            alt={`${restaurantName} - ${currentIndex + 1}`}
            className="w-full h-full object-cover cursor-pointer select-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={() => setIsFullscreen(true)}
            loading="lazy"
            draggable={false}
          />
        </AnimatePresence>

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent pointer-events-none" />

        {/* Navigation Arrows */}
        {images.length > 1 && (
          <>
            <Button
              variant="secondary"
              size="icon"
              className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur"
              onClick={handlePrev}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur"
              onClick={handleNext}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </>
        )}

        {/* Image Counter */}
        {images.length > 1 && (
          <div className="absolute bottom-3 right-3 px-2 py-1 rounded-md bg-background/80 backdrop-blur text-xs font-medium">
            {currentIndex + 1} / {images.length}
          </div>
        )}

        {/* Thumbnail Dots */}
        {images.length > 1 && images.length <= 6 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={() => handleThumbnailClick(index)}
                className={`h-2 w-2 rounded-full transition-all ${
                  index === currentIndex 
                    ? 'bg-primary w-4' 
                    : 'bg-primary/40 hover:bg-primary/60'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Thumbnail Strip (for more than 6 images) */}
      {images.length > 6 && (
        <div className="flex gap-2 px-4 py-2 overflow-x-auto scrollbar-hide">
          {images.map((image, index) => (
            <button
              key={index}
              onClick={() => handleThumbnailClick(index)}
              className={`shrink-0 h-12 w-16 rounded-md overflow-hidden border-2 transition-all ${
                index === currentIndex 
                  ? 'border-primary' 
                  : 'border-transparent opacity-70 hover:opacity-100'
              }`}
            >
              {loadedImages.has(index) ? (
                <img
                  src={image}
                  alt={`${restaurantName} thumbnail ${index + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full bg-muted animate-pulse" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Fullscreen Modal */}
      <AnimatePresence>
        {isFullscreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center overflow-hidden"
            onClick={() => zoomLevel === 1 && closeFullscreen()}
            onKeyDown={handleKeyDown}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            tabIndex={0}
            ref={imageContainerRef}
          >
            {/* Close Button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-10"
              onClick={closeFullscreen}
            >
              <X className="h-6 w-6" />
            </Button>

            {/* Zoom Controls */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex gap-2 bg-muted/80 backdrop-blur rounded-full p-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={(e) => { e.stopPropagation(); zoomOut(); }}
                disabled={zoomLevel <= 1}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="flex items-center px-2 text-sm font-medium min-w-[3rem] justify-center">
                {Math.round(zoomLevel * 100)}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={(e) => { e.stopPropagation(); zoomIn(); }}
                disabled={zoomLevel >= 4}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>

            {/* Navigation Arrows */}
            {images.length > 1 && zoomLevel === 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 z-10"
                  onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                >
                  <ChevronLeft className="h-8 w-8" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 z-10"
                  onClick={(e) => { e.stopPropagation(); handleNext(); }}
                >
                  <ChevronRight className="h-8 w-8" />
                </Button>
              </>
            )}

            {/* Zoomable Image */}
            <motion.div
              className="flex items-center justify-center"
              style={{
                cursor: zoomLevel > 1 ? 'grab' : 'default',
              }}
            >
              <motion.img
                key={`fullscreen-${currentIndex}`}
                src={images[currentIndex]}
                alt={`${restaurantName} - ${currentIndex + 1}`}
                className="max-w-[90vw] max-h-[85vh] object-contain select-none"
                style={{
                  transform: `scale(${zoomLevel}) translate(${panPosition.x / zoomLevel}px, ${panPosition.y / zoomLevel}px)`,
                  transition: zoomLevel === 1 ? 'transform 0.3s ease-out' : 'none',
                }}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={() => zoomLevel > 1 ? resetZoom() : setZoomLevel(2.5)}
                draggable={false}
              />
            </motion.div>

            {/* Fullscreen Counter & Hint */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
              <div className="px-3 py-1.5 rounded-full bg-muted text-sm font-medium">
                {currentIndex + 1} / {images.length}
              </div>
              <span className="text-xs text-muted-foreground">
                {zoomLevel === 1 ? 'Dubbeltik om te zoomen • Swipe om te navigeren' : 'Dubbeltik om te resetten'}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

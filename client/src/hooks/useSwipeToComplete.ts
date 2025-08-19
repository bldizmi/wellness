import { useState, useRef, useCallback } from 'react';

interface SwipeToCompleteOptions {
  onComplete: () => void;
  threshold?: number;
  disabled?: boolean;
}

interface SwipeState {
  isSwipingToComplete: boolean;
  swipeDistance: number;
  transform: string;
  opacity: number;
  showGreenBackground: boolean;
}

export const useSwipeToComplete = ({ 
  onComplete, 
  threshold = 100, 
  disabled = false 
}: SwipeToCompleteOptions) => {
  const [swipeState, setSwipeState] = useState<SwipeState>({
    isSwipingToComplete: false,
    swipeDistance: 0,
    transform: 'translateX(0px)',
    opacity: 1,
    showGreenBackground: false
  });

  const swipeStartX = useRef<number>(0);
  const swipeStartY = useRef<number>(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    
    const touch = e.touches[0];
    swipeStartX.current = touch.clientX;
    swipeStartY.current = touch.clientY;
  }, [disabled]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - swipeStartX.current;
    const deltaY = touch.clientY - swipeStartY.current;
    
    // Only handle horizontal swipes (ignore vertical scrolling)
    if (Math.abs(deltaY) > Math.abs(deltaX)) return;
    
    // Only handle right swipes (positive deltaX)
    if (deltaX <= 0) return;
    
    // Prevent default to stop scrolling during swipe
    e.preventDefault();
    
    const progress = Math.min(deltaX / threshold, 1);
    const opacity = Math.max(1 - progress * 0.3, 0.7);
    
    setSwipeState({
      isSwipingToComplete: true,
      swipeDistance: deltaX,
      transform: `translateX(${deltaX}px)`,
      opacity,
      showGreenBackground: deltaX > threshold * 0.5
    });
  }, [disabled, threshold]);

  const handleTouchEnd = useCallback(() => {
    if (disabled) return;
    
    const { swipeDistance } = swipeState;
    
    if (swipeDistance >= threshold) {
      // Complete the item
      setSwipeState({
        isSwipingToComplete: false,
        swipeDistance: 0,
        transform: 'translateX(0px)',
        opacity: 1,
        showGreenBackground: false
      });
      onComplete();
    } else {
      // Reset to original position
      setSwipeState({
        isSwipingToComplete: false,
        swipeDistance: 0,
        transform: 'translateX(0px)',
        opacity: 1,
        showGreenBackground: false
      });
    }
  }, [disabled, threshold, swipeState, onComplete]);

  const touchHandlers = {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    ref: cardRef
  };

  return {
    swipeState,
    touchHandlers,
    isSwipeActive: swipeState.isSwipingToComplete
  };
};
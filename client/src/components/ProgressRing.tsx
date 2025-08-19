import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Check, Sparkles } from "lucide-react";

interface ProgressRingProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  isToday?: boolean;
  isSelected?: boolean;
  isFuture?: boolean;
  children: React.ReactNode;
  className?: string;
  onCompletionCelebration?: () => void;
}

export function ProgressRing({ 
  percentage, 
  size = 36, 
  strokeWidth = 3, 
  isToday = false,
  isSelected = false,
  isFuture = false,
  children,
  className,
  onCompletionCelebration
}: ProgressRingProps) {
  const [isCompleting, setIsCompleting] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [hasShownCelebration, setHasShownCelebration] = useState(false);
  const [previousPercentage, setPreviousPercentage] = useState(percentage);

  // Detect when completion happens and trigger celebration
  useEffect(() => {
    if (percentage === 100 && previousPercentage < 100 && !hasShownCelebration) {
      setIsCompleting(true);
      setShowCelebration(true);
      onCompletionCelebration?.();
      
      // Hide the celebration after 2050ms (800ms + 1.25s longer)
      const timer = setTimeout(() => {
        setShowCelebration(false);
        setIsCompleting(false);
        setHasShownCelebration(true);
      }, 2050);
      
      return () => clearTimeout(timer);
    }
    
    setPreviousPercentage(percentage);
  }, [percentage, previousPercentage, hasShownCelebration, onCompletionCelebration]);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  // Color scheme based on state - optimized for accessibility
  const getColors = () => {
    if (isSelected) {
      return {
        background: "stroke-white/40",
        progress: "stroke-white",
        glow: "drop-shadow-sm"
      };
    }
    
    if (isToday) {
      return {
        background: "stroke-green-300 dark:stroke-green-700",
        progress: "stroke-green-600 dark:stroke-green-400",
        glow: "drop-shadow-lg filter"
      };
    }
    
    if (isFuture) {
      return {
        background: "stroke-gray-300 dark:stroke-gray-600",
        progress: "stroke-gray-500 dark:stroke-gray-400",
        glow: ""
      };
    }
    
    if (percentage === 100) {
      return {
        background: "stroke-blue-300 dark:stroke-blue-700",
        progress: isCompleting ? "stroke-blue-500 dark:stroke-blue-300" : "stroke-blue-600 dark:stroke-blue-400",
        glow: isCompleting ? "drop-shadow-lg filter" : "drop-shadow-md filter"
      };
    }
    
    if (percentage > 0) {
      return {
        background: "stroke-gray-300 dark:stroke-gray-600",
        progress: "stroke-blue-600 dark:stroke-blue-400",
        glow: ""
      };
    }
    
    // 0% complete - dashed ring with better contrast
    return {
      background: "stroke-gray-400 dark:stroke-gray-500",
      progress: "stroke-gray-400 dark:stroke-gray-500",
      glow: ""
    };
  };

  const colors = getColors();
  const center = size / 2;

  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      {/* Today's date gets a subtle pulse animation */}
      {isToday && (
        <div 
          className="absolute inset-0 rounded-full bg-green-400/20 animate-ping"
          style={{ animationDuration: "2s" }}
        />
      )}
      
      {/* Completion celebration pulse rings */}
      {isCompleting && (
        <>
          <div 
            className="absolute inset-0 rounded-full bg-blue-400/30 animate-ping"
            style={{ animationDuration: "0.6s" }}
          />
          <div 
            className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping"
            style={{ animationDuration: "0.8s", animationDelay: "0.1s" }}
          />
        </>
      )}
      
      <svg
        width={size}
        height={size}
        className={cn(
          "transform -rotate-90 transition-all duration-300 relative z-10", 
          colors.glow,
          isCompleting && "animate-pulse"
        )}
        style={{
          filter: isToday ? "drop-shadow(0 0 8px rgba(34, 197, 94, 0.3))" : 
                  isCompleting ? "drop-shadow(0 0 12px rgba(59, 130, 246, 0.4))" :
                  (percentage === 100 && !isSelected) ? "drop-shadow(0 0 6px rgba(59, 130, 246, 0.2))" : 
                  undefined,
          animationDuration: isCompleting ? "0.6s" : undefined
        }}
      >
        {/* Background ring */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className={colors.background}
          strokeDasharray={percentage === 0 ? "3 3" : undefined} // Dashed for 0%
        />
        
        {/* Progress ring */}
        {percentage > 0 && (
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            className={cn(colors.progress, "transition-all duration-500 ease-out")}
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{
              transition: "stroke-dashoffset 0.5s ease-out"
            }}
          />
        )}
        
        {/* 100% completion gets a subtle inner glow */}
        {percentage === 100 && !isSelected && (
          <circle
            cx={center}
            cy={center}
            r={radius - 1}
            fill="none"
            strokeWidth={1}
            className="stroke-blue-300/40 dark:stroke-blue-400/30"
          />
        )}
      </svg>
      
      {/* Content in center */}
      <div className="absolute inset-0 flex items-center justify-center z-20">
        {/* Show celebration overlay briefly */}
        {showCelebration ? (
          <div className="relative">
            {/* Animated checkmark */}
            <div className="absolute inset-0 flex items-center justify-center">
              <Check 
                className="w-6 h-6 text-blue-500 animate-bounce" 
                style={{ 
                  filter: "drop-shadow(0 0 8px rgba(59, 130, 246, 0.8)) drop-shadow(0 0 4px rgba(255, 255, 255, 1))",
                  animationDuration: "0.4s",
                  animationIterationCount: "4"
                }}
              />
            </div>
            
            {/* Sparkle effect */}
            <div className="absolute top-0 right-0 flex items-center justify-center">
              <Sparkles 
                className="w-4 h-4 text-yellow-300 animate-pulse" 
                style={{ 
                  filter: "drop-shadow(0 0 6px rgba(251, 191, 36, 0.9)) drop-shadow(0 0 3px rgba(255, 255, 255, 1))",
                  animationDuration: "0.5s",
                  animationIterationCount: "infinite",
                  transform: "translate(8px, -8px)"
                }}
              />
            </div>
          </div>
        ) : (
          children
        )}
      </div>
      
      {/* Particle burst for 100% completion */}
      {isCompleting && (
        <div className="absolute inset-0 pointer-events-none z-30">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="absolute top-1/2 left-1/2 w-2 h-2 bg-blue-400 rounded-full shadow-xl"
              style={{
                transform: `translate(-50%, -50%) rotate(${i * 60}deg) translateY(-18px)`,
                animation: `celebration-particle 2.05s ease-out forwards`,
                animationDelay: `${i * 0.08}s`,
                '--rotation': `${i * 60}deg`,
                filter: "drop-shadow(0 0 6px rgba(59, 130, 246, 1)) drop-shadow(0 0 3px rgba(255, 255, 255, 0.8))"
              } as React.CSSProperties}
            />
          ))}
        </div>
      )}
    </div>
  );
}
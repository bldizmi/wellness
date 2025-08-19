import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface ConfettiEffectProps {
  trigger: boolean;
  onComplete?: () => void;
}

export function ConfettiEffect({ trigger, onComplete }: ConfettiEffectProps) {
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (trigger) {
      setIsActive(true);
      const timer = setTimeout(() => {
        setIsActive(false);
        onComplete?.();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [trigger, onComplete]);

  if (!isActive) return null;

  const particles = Array.from({ length: 8 }, (_, i) => ({
    id: i,
    delay: i * 50,
    rotation: i * 45,
  }));

  return (
    <div className="absolute inset-0 pointer-events-none">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className={cn(
            "absolute top-1/2 left-1/2 w-1 h-1 bg-blue-400 rounded-full",
            "animate-ping opacity-0"
          )}
          style={{
            transform: `translate(-50%, -50%) rotate(${particle.rotation}deg) translateY(-20px)`,
            animationDelay: `${particle.delay}ms`,
            animationDuration: "800ms",
            animationFillMode: "forwards",
          }}
        />
      ))}
    </div>
  );
}
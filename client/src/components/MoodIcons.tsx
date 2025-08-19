interface MoodIconProps {
  mood: string;
  size?: number;
  className?: string;
}

const MoodIcon = ({ mood, size = 48, className = "" }: MoodIconProps) => {
  const getMoodIcon = (moodType: string) => {
    switch (moodType) {
      case "happy":
        return (
          <div className={`relative ${className}`} style={{ width: size, height: size }}>
            <div className="w-full h-full rounded-full bg-orange-400 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-12 h-12 text-orange-800">
                <circle cx="8" cy="10" r="1" fill="currentColor" />
                <circle cx="16" cy="10" r="1" fill="currentColor" />
                <path d="M8 15s1.5 2 4 2 4-2 4-2" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        );
      case "content":
        return (
          <div className={`relative ${className}`} style={{ width: size, height: size }}>
            <div className="w-full h-full rounded-full bg-cyan-300 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-12 h-12 text-cyan-800">
                <path d="M6 12c0 0 3-1 6-1s6 1 6 1" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                <path d="M8 8l2 2M16 8l-2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        );
      case "neutral":
        return (
          <div className={`relative ${className}`} style={{ width: size, height: size }}>
            <div className="w-full h-full rounded-full bg-purple-300 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-12 h-12 text-purple-800">
                <circle cx="8" cy="10" r="1" fill="currentColor" />
                <circle cx="16" cy="10" r="1" fill="currentColor" />
                <line x1="8" y1="15" x2="16" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        );
      case "worried":
        return (
          <div className={`relative ${className}`} style={{ width: size, height: size }}>
            <div className="w-full h-full rounded-full bg-green-300 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-12 h-12 text-green-800">
                <circle cx="8" cy="10" r="1" fill="currentColor" />
                <circle cx="16" cy="10" r="1" fill="currentColor" />
                <path d="M8 16s1.5-1 4-1 4 1 4 1" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        );
      case "sad":
        return (
          <div className={`relative ${className}`} style={{ width: size, height: size }}>
            <div className="w-full h-full rounded-full bg-indigo-400 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-12 h-12 text-indigo-800">
                <circle cx="8" cy="10" r="1" fill="currentColor" />
                <circle cx="16" cy="10" r="1" fill="currentColor" />
                <path d="M8 17s1.5-2 4-2 4 2 4 2" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        );
      default:
        return (
          <div className={`relative ${className}`} style={{ width: size, height: size }}>
            <div className="w-full h-full rounded-full bg-gray-300 flex items-center justify-center">
              <span className="text-lg">{moodType}</span>
            </div>
          </div>
        );
    }
  };

  return getMoodIcon(mood);
};

export default MoodIcon;

export const MOOD_OPTIONS = [
  { id: "happy", label: "Happy", emoji: "😊" },
  { id: "content", label: "Content", emoji: "😌" },
  { id: "neutral", label: "Neutral", emoji: "😐" },
  { id: "worried", label: "Worried", emoji: "😕" },
  { id: "sad", label: "Sad", emoji: "😢" },
];
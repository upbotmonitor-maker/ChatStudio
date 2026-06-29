import React from 'react';

interface GeminiAvatarProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function GeminiAvatar({ className = '', size = 'md' }: GeminiAvatarProps) {
  // Map size keys to dimensions
  const dimensions = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  const sparkSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <div 
      className={`relative rounded-full flex items-center justify-center bg-slate-900 border border-slate-800/80 ${dimensions[size]} ${className} shrink-0 shadow-inner`}
      style={{ boxSizing: 'border-box' }}
    >
      {/* 
        A clean, elegant, static subtle gradient ring on the background of the profile image
      */}
      <div 
        className="absolute inset-[1px] rounded-full opacity-10 bg-gradient-to-tr from-indigo-500 to-purple-500"
      />

      {/* 
        Google Gemini Original 4-Corner Sparkle SVG (Completely static and stable for profile avatar)
      */}
      <div className="relative z-10 flex items-center justify-center">
        <svg 
          className={sparkSizes[size]} 
          viewBox="0 0 24 24" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path 
            d="M12 2C12 2 12.5 7.5 14.5 9.5C16.5 11.5 22 12 22 12C22 12 16.5 12.5 14.5 14.5C12.5 16.5 12 22 12 22C12 22 11.5 16.5 9.5 14.5C7.5 12.5 2 12 2 12C2 12 7.5 11.5 9.5 9.5C11.5 7.5 12 2 12 2Z" 
            fill="#4285F4"
          />
        </svg>
      </div>
    </div>
  );
}

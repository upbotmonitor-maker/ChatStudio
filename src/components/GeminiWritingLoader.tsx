import React from 'react';

export function GeminiWritingLoader() {
  return (
    <div className="flex items-center justify-start py-2 w-full">
      {/* CSS Styles injection specifically for the Google Material Design color-changing loop */}
      <style>{`
        @keyframes googleColorChange {
          0%, 100% { stroke: #4285F4; } /* Blue */
          25% { stroke: #EA4335; }      /* Red */
          50% { stroke: #FBBC05; }      /* Yellow */
          75% { stroke: #34A853; }      /* Green */
        }
        @keyframes googleDash {
          0% {
            stroke-dasharray: 1, 150;
            stroke-dashoffset: 0;
          }
          50% {
            stroke-dasharray: 90, 150;
            stroke-dashoffset: -35;
          }
          100% {
            stroke-dasharray: 90, 150;
            stroke-dashoffset: -124;
          }
        }
        @keyframes googleRotate {
          100% {
            transform: rotate(360deg);
          }
        }
        .google-spinner {
          animation: googleRotate 2s linear infinite;
        }
        .google-spinner-path {
          animation: 
            googleDash 1.5s ease-in-out infinite, 
            googleColorChange 6s ease-in-out infinite;
          stroke-linecap: round;
        }
      `}</style>

      {/* 
        1. KONTEYNER: 44px x 44px boyutlarında (Mükemmel boyut), dairesel, 
        sol tarafa hizalı ve arka planı son derece temiz bir yapıda.
      */}
      <div 
        className="relative w-11 h-11 rounded-full flex items-center justify-center bg-slate-950 shadow-md border border-slate-900"
        style={{ boxSizing: 'border-box' }}
      >
        {/* 
          2. GOOGLE DÖNEN RENKLİ HALKA (SVG):
          Yüklenme çemberi efektini verir. Dış çeperde bir renk dönerken arkasından diğer renk gelir.
        */}
        <svg 
          className="google-spinner absolute inset-0 w-full h-full p-[3px]" 
          viewBox="0 0 50 50"
        >
          <circle 
            className="google-spinner-path" 
            cx="25" 
            cy="25" 
            r="20" 
            fill="none" 
            strokeWidth="3"
          />
        </svg>

        {/* 
          3. MERKEZ GEMINI LOGOSU (SABİT DURAN):
          Yıldız logo tam merkezde çakılıdır, asla dönmez veya sarsılmaz.
        */}
        <div className="relative z-10 flex items-center justify-center pointer-events-none">
          <svg 
            className="w-[18px] h-[18px] animate-pulse" 
            viewBox="0 0 24 24" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
            style={{ animationDuration: '2s' }}
          >
            <path 
              d="M12 2C12 2 12.5 7.5 14.5 9.5C16.5 11.5 22 12 22 12C22 12 16.5 12.5 14.5 14.5C12.5 16.5 12 22 12 22C12 22 11.5 16.5 9.5 14.5C7.5 12.5 2 12 2 12C2 12 7.5 11.5 9.5 9.5C11.5 7.5 12 2 12 2Z" 
              fill="#4285F4"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

import React from 'react';

const BasketballLoader: React.FC = () => {
  return (
    <div className="flex items-center justify-center w-full h-full min-h-[300px]">
      <style>{`
        .ring-loader {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          padding: 2rem 0 1.5rem;
        }

        .spinner {
          width: 75px;
          height: 75px;
          position: relative;
        }

        .ball-center {
          width: 75px;
          height: 75px;
          border-radius: 50%;
          background: linear-gradient(135deg, #FF7043 0%, #F26522 50%, #D84315 100%);
          position: absolute;
          top: 0;
          left: 0;
          z-index: 2;
          box-shadow: inset -3px -3px 10px rgba(0,0,0,0.2), inset 2px 2px 6px rgba(255,150,80,0.3);
          animation: wobble 1.2s ease-in-out infinite;
        }

        .seam {
          position: absolute;
          background: rgba(0,0,0,0.25);
        }

        .seam-h {
          width: 75px;
          height: 3px;
          top: 50%;
          left: 0;
          transform: translateY(-50%);
        }

        .seam-v {
          width: 3px;
          height: 75px;
          left: 50%;
          top: 0;
          transform: translateX(-50%);
        }

        .ring {
          position: absolute;
          inset: -8px;
          border: 2px solid transparent;
          border-top-color: #F26522;
          border-right-color: #F26522;
          border-radius: 50%;
          animation: spin-fast 1s linear infinite;
          z-index: 1;
        }

        .ring::after {
          content: '';
          position: absolute;
          inset: 4px;
          border: 2px solid transparent;
          border-bottom-color: #FF7043;
          border-left-color: #FF7043;
          border-radius: 50%;
          animation: spin-slow 2s linear infinite reverse;
        }

        .pulse-text {
          font-size: 13px;
          letter-spacing: 0.12em;
          color: #94a3b8; /* Approximate color-text-secondary */
          text-transform: uppercase;
          animation: fade-pulse 1.5s ease-in-out infinite;
          font-weight: 800;
        }

        @keyframes spin-fast {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }

        @keyframes wobble {
          0%, 100% { transform: scale(1) rotateZ(0deg); }
          25% { transform: scale(1.02) rotateZ(2deg); }
          75% { transform: scale(1.02) rotateZ(-2deg); }
        }

        @keyframes fade-pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
      
      <div className="ring-loader">
        <div className="spinner">
          <div className="ball-center">
            <div className="seam seam-h"></div>
            <div className="seam seam-v"></div>
          </div>
          <div className="ring"></div>
        </div>
        <div className="pulse-text">LOADING...</div>
      </div>
    </div>
  );
};

export default BasketballLoader;

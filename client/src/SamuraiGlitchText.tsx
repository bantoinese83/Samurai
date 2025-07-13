import React from 'react';
import './SamuraiGlitchText.css';

const LAYERS = 10;
const TEXT = 'SAMURAI';

const SamuraiGlitchText: React.FC = () => (
  <div className="samurai-glitch-header">
    {Array.from({ length: LAYERS }).map((_, i) => (
      <span key={i} className={`glitch-text glitch-text-${i}`}>{TEXT}</span>
    ))}
  </div>
);

export default SamuraiGlitchText; 
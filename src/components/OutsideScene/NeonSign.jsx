import React, { useState, useRef, useEffect } from 'react';

export default function NeonSign() {
  const [isFlickering, setIsFlickering] = useState(false);
  const signRef = useRef(null);
  const angleRef = useRef(0);
  const velRef = useRef(0);
  const animFrameRef = useRef(null);

  useEffect(() => {
    let last = performance.now();
    const damping = 0.985;

    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const torque = -0.06 * Math.sin(angleRef.current);
      velRef.current += torque;
      velRef.current *= damping;
      angleRef.current += velRef.current * dt * 30;

      if (signRef.current) {
        signRef.current.style.transform = `translateX(-50%) rotate(${angleRef.current}rad)`;
      }

      animFrameRef.current = requestAnimationFrame(frame);
    }

    animFrameRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []);

  const handleClick = () => {
    setIsFlickering(true);
    setTimeout(() => setIsFlickering(false), 1200);
    velRef.current += (Math.random() > 0.5 ? 1 : -1) * (0.15 + Math.random() * 0.15);
  };

  return (
    <div
      ref={signRef}
      id="neonSign"
      className={`neon ${isFlickering ? 'is-flickering' : ''}`}
      onClick={handleClick}
      title="Click to flicker & swing"
    >
      <div className="neon__tube">
        <span className="neon__title-main">PHOTOBOOTH</span>
      </div>
      <div className="neon__backplate"></div>
    </div>
  );
}

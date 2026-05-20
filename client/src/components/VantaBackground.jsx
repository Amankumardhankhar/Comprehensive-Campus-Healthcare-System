import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import NET from 'vanta/dist/vanta.net.min.js';
import { useTheme } from '../context/ThemeContext.jsx';

export default function VantaBackground() {
  const containerRef = useRef(null);
  const effectRef = useRef(null);
  const { theme } = useTheme();

  useEffect(() => {
    if (!containerRef.current) return;
    if (effectRef.current) {
      effectRef.current.destroy();
      effectRef.current = null;
    }

    const palette =
      theme === 'light'
        ? { color: 0x1e6fd9, backgroundColor: 0xeaf2ff }
        : { color: 0x2f80ed, backgroundColor: 0x0b1a3a };

    effectRef.current = NET({
      el: containerRef.current,
      THREE,
      mouseControls: true,
      touchControls: true,
      gyroControls: false,
      minHeight: 200.0,
      minWidth: 200.0,
      scale: 1.0,
      scaleMobile: 1.0,
      points: 12.0,
      maxDistance: 22.0,
      spacing: 17.0,
      showDots: true,
      ...palette,
    });

    return () => {
      if (effectRef.current) {
        effectRef.current.destroy();
        effectRef.current = null;
      }
    };
  }, [theme]);

  return <div ref={containerRef} className="fixed inset-0" style={{ zIndex: 0 }} />;
}

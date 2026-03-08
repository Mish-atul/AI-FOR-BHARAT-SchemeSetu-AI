'use client';

import { useRef, useEffect, useState, useCallback, type ReactNode } from 'react';
import { useScroll, useTransform, motion } from 'framer-motion';

const TOTAL_FRAMES = 192;
const FRAME_PATH = (i: number) =>
  `/heroFrames/ezgif-frame-${String(i).padStart(3, '0')}.jpg`;

interface Props {
  children: ReactNode;
}

export default function HeroScrollAnimation({ children }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const currentFrameRef = useRef(0);
  const rafRef = useRef<number>(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  // Preload all images
  useEffect(() => {
    let mounted = true;
    const images: HTMLImageElement[] = [];
    let loaded = 0;

    for (let i = 1; i <= TOTAL_FRAMES; i++) {
      const img = new Image();
      img.src = FRAME_PATH(i);
      img.onload = () => {
        loaded++;
        if (loaded === TOTAL_FRAMES && mounted) setImagesLoaded(true);
      };
      img.onerror = () => {
        loaded++;
        if (loaded === TOTAL_FRAMES && mounted) setImagesLoaded(true);
      };
      images.push(img);
    }
    imagesRef.current = images;
    return () => { mounted = false; };
  }, []);

  // Canvas sizing
  const updateCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);
    // Redraw current frame after resize
    if (imagesLoaded) drawFrame(currentFrameRef.current);
  }, [imagesLoaded]);

  useEffect(() => {
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, [updateCanvasSize]);

  // Draw a frame on canvas with cover-fit
  const drawFrame = useCallback((frameIndex: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const img = imagesRef.current[frameIndex];
    if (!canvas || !ctx || !img || !img.complete || img.naturalWidth === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const cw = canvas.width / dpr;
    const ch = canvas.height / dpr;

    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cw, ch);

    // Object-fit: cover (fill entire canvas, crop excess)
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const canvasAspect = cw / ch;

    let drawW: number, drawH: number, drawX: number, drawY: number;
    if (imgAspect > canvasAspect) {
      drawH = ch;
      drawW = ch * imgAspect;
      drawX = (cw - drawW) / 2;
      drawY = 0;
    } else {
      drawW = cw;
      drawH = cw / imgAspect;
      drawX = 0;
      drawY = (ch - drawH) / 2;
    }

    ctx.drawImage(img, drawX, drawY, drawW, drawH);
  }, []);

  // Scroll-driven frame rendering
  useEffect(() => {
    if (!imagesLoaded) return;
    drawFrame(0);

    const unsubscribe = scrollYProgress.on('change', (v) => {
      const frameIndex = Math.min(
        TOTAL_FRAMES - 1,
        Math.max(0, Math.floor(v * TOTAL_FRAMES))
      );
      if (frameIndex !== currentFrameRef.current) {
        currentFrameRef.current = frameIndex;
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => drawFrame(frameIndex));
      }
    });

    return () => {
      unsubscribe();
      cancelAnimationFrame(rafRef.current);
    };
  }, [imagesLoaded, scrollYProgress, drawFrame]);

  const canvasOpacity = useTransform(scrollYProgress, [0.9, 1], [1, 0]);

  return (
    <div ref={containerRef} className="relative">
      {/* Sticky background canvas */}
      <motion.div
        className="sticky top-0 h-screen w-full overflow-hidden -z-0"
        style={{ opacity: canvasOpacity }}
      >
        <canvas ref={canvasRef} className="block w-full h-full" />
        {/* Loading state */}
        {!imagesLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-white">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-gray-500">Loading animation...</p>
            </div>
          </div>
        )}
      </motion.div>

      {/* Foreground scrollable content overlaid on the animation */}
      <div className="relative z-10" style={{ marginTop: '-100vh' }}>
        {children}
      </div>
    </div>
  );
}

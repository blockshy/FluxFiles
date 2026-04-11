import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

const DESKTOP_LAYOUT_WIDTH = 1440;
const SCALE_BREAKPOINT = 900;
const MIN_SCALE = 0.52;

function computeScale(viewportWidth: number) {
  const rawScale = viewportWidth / DESKTOP_LAYOUT_WIDTH;
  return Math.max(MIN_SCALE, Math.min(1, rawScale));
}

export function DesktopScaleShell({ children }: { children: ReactNode }) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window === 'undefined' ? DESKTOP_LAYOUT_WIDTH : window.innerWidth));
  const [stageHeight, setStageHeight] = useState(0);

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!stageRef.current || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const element = stageRef.current;
    const updateHeight = () => {
      setStageHeight(element.scrollHeight);
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);
    return () => observer.disconnect();
  }, [children, viewportWidth]);

  const shouldScale = viewportWidth <= SCALE_BREAKPOINT;
  const scale = useMemo(() => computeScale(viewportWidth), [viewportWidth]);
  const scaledWidth = Math.round(DESKTOP_LAYOUT_WIDTH * scale);
  const viewportHeight = typeof window === 'undefined' ? 0 : window.innerHeight;
  const scaledHeight = Math.max(Math.round(stageHeight * scale), Math.round(viewportHeight));

  if (!shouldScale) {
    return <>{children}</>;
  }

  return (
    <div className="desktop-scale-shell" style={{ minHeight: `${scaledHeight || 0}px` }}>
      <div className="desktop-scale-spacer" style={{ width: `${scaledWidth}px`, minHeight: `${scaledHeight || 0}px` }}>
        <div
          ref={stageRef}
          className="desktop-scale-stage"
          style={{
            width: `${DESKTOP_LAYOUT_WIDTH}px`,
            minWidth: `${DESKTOP_LAYOUT_WIDTH}px`,
            transform: `scale(${scale})`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

/** A thin bar under the header showing how far through a post the reader is. */
export function ReadingProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const el = document.documentElement;
        const max = el.scrollHeight - el.clientHeight;
        setProgress(max > 0 ? Math.min(1, el.scrollTop / max) : 0);
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-16 z-40 h-0.5">
      <div className="h-full origin-left bg-foreground/70 transition-transform duration-100 ease-out motion-reduce:transition-none" style={{ transform: `scaleX(${progress})` }} />
    </div>
  );
}

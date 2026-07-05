import { useEffect, useRef, type ReactNode } from "react";
import VanillaTilt from "vanilla-tilt";

interface TiltEl extends HTMLDivElement {
  vanillaTilt?: { destroy: () => void };
}

/** Subtle 3D parallax tilt + glare on hover (respects reduced-motion). */
export default function Tilt({
  children,
  className = "",
  max = 8,
  glare = true,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
  glare?: boolean;
}) {
  const ref = useRef<TiltEl>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    VanillaTilt.init(el, {
      max,
      speed: 500,
      glare,
      "max-glare": 0.18,
      scale: 1.02,
      gyroscope: false,
      easing: "cubic-bezier(.03,.98,.52,.99)",
    });
    return () => el.vanillaTilt?.destroy();
  }, [max, glare]);

  return (
    <div ref={ref} className={className} style={{ transformStyle: "preserve-3d" }}>
      {children}
    </div>
  );
}

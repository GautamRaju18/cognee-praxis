import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Branded cold-open. Shows once on load (per tab session), auto-dismisses after
 * ~2.4s, and can be skipped with a click / any key. Perfect first two seconds
 * for the demo video.
 *
 * Safety: this is a full-screen overlay, so it MUST never block the app. The
 * moment it's dismissed it goes `pointer-events-none` and fades via CSS, and it
 * unmounts on a plain timer — never depending on an animation completing. Even
 * if a frame stalls, the app underneath stays fully interactive.
 */
export default function Splash() {
  const [show, setShow] = useState(() => {
    try {
      return sessionStorage.getItem("px-splash-seen") !== "1";
    } catch {
      return true;
    }
  });
  const [leaving, setLeaving] = useState(false);
  const leftRef = useRef(false);

  const dismiss = useCallback(() => {
    if (leftRef.current) return;
    leftRef.current = true;
    setLeaving(true); // opacity→0 + pointer-events-none immediately
    setTimeout(() => setShow(false), 500); // then unmount (plain timer, no anim dependency)
  }, []);

  useEffect(() => {
    if (!show) return;
    try {
      sessionStorage.setItem("px-splash-seen", "1");
    } catch {
      /* private mode — fine, it just shows again next load */
    }
    const t = setTimeout(dismiss, 2400);
    window.addEventListener("keydown", dismiss);
    window.addEventListener("pointerdown", dismiss);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", dismiss);
      window.removeEventListener("pointerdown", dismiss);
    };
  }, [show, dismiss]);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[var(--color-ink)] transition-opacity duration-500"
      style={{ opacity: leaving ? 0 : 1, pointerEvents: leaving ? "none" : "auto" }}
    >
      {/* ambient glow behind the mark */}
      <motion.div
        className="pointer-events-none absolute h-72 w-72 rounded-full bg-[var(--color-signal)] blur-[120px]"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 0.22, scale: 1 }}
        transition={{ duration: 1.1, ease: "easeOut" }}
      />

      <motion.div
        className="px-glow flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--color-signal-deep)] text-[var(--color-signal)]"
        initial={{ opacity: 0, scale: 0.7, rotate: -8 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <span className="px-display text-5xl leading-none">P</span>
      </motion.div>

      <motion.div
        className="px-display mt-6 text-4xl tracking-tight text-[var(--color-fg)]"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.6, ease: "easeOut" }}
      >
        Praxis
      </motion.div>

      <motion.div
        className="px-eyebrow mt-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7, duration: 0.6 }}
      >
        institutional decision memory
      </motion.div>

      {/* thin scanning underline */}
      <motion.div
        className="mt-7 h-px bg-gradient-to-r from-transparent via-[var(--color-signal)] to-transparent"
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: 220, opacity: 0.7 }}
        transition={{ delay: 0.6, duration: 0.9, ease: "easeOut" }}
      />

      <motion.div
        className="px-mono absolute bottom-8 text-[10px] text-[var(--color-fg-faint)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 0.6 }}
      >
        click anywhere to enter →
      </motion.div>
    </div>
  );
}

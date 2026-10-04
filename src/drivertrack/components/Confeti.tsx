// ═══════════════════════════════════════════════════════════
// 🎉 DriverTrack — Confeti (meta cumplida)
// 80 piezas CSS cayendo — cero dependencias externas.
// ═══════════════════════════════════════════════════════════
import { useMemo } from 'react';

const COLORES = ['#34d399', '#fbbf24', '#60a5fa', '#f472b6', '#a78bfa', '#f87171'];

export default function Confeti({ visible }: { visible: boolean }) {
  const piezas = useMemo(
    () =>
      Array.from({ length: 80 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 1.2,
        dur: 2.2 + Math.random() * 1.8,
        color: COLORES[i % COLORES.length],
        w: 7 + Math.random() * 6,
        h: 10 + Math.random() * 8,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  if (!visible) return null;

  return (
    <div aria-hidden>
      {piezas.map((p, i) => (
        <div
          key={i}
          className="dt-confeti-pieza"
          style={{
            left: `${p.left}vw`,
            background: p.color,
            width: p.w,
            height: p.h,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
          }}
        />
      ))}
    </div>
  );
}

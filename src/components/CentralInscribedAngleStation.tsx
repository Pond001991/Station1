import { useCallback, useRef, useState } from "react";
import { Compass, Hand, Lightbulb, Move, Sparkles } from "lucide-react";

type Pt = { x: number; y: number };

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

function angleBetween(o: Pt, a: Pt, b: Pt): number {
  const v1 = { x: a.x - o.x, y: a.y - o.y };
  const v2 = { x: b.x - o.x, y: b.y - o.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const cross = v1.x * v2.y - v1.y * v2.x;
  let ang = Math.atan2(cross, dot);
  if (ang < 0) ang += Math.PI * 2;
  return ang;
}

// SVG arc along the circle between two angles (degrees), going the short way
// when sweepFlag=1 from startDeg to endDeg (handles wrap by normalizing end).
function circleArcPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
  sweepFlag = 1
): string {
  const start = {
    x: cx + r * Math.cos(toRad(startDeg)),
    y: cy + r * Math.sin(toRad(startDeg)),
  };
  const end = {
    x: cx + r * Math.cos(toRad(endDeg)),
    y: cy + r * Math.sin(toRad(endDeg)),
  };
  let delta = endDeg - startDeg;
  if (sweepFlag === 1 && delta < 0) delta += 360;
  if (sweepFlag === 0 && delta > 0) delta -= 360;
  const largeArc = Math.abs(delta) > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} ${sweepFlag} ${end.x} ${end.y}`;
}

// Small angle-indicator arc at vertex v, between rays v->a and v->b.
function angleArcPath(v: Pt, a: Pt, b: Pt, rr: number): string {
  let angA = toDeg(Math.atan2(a.y - v.y, a.x - v.x));
  let angB = toDeg(Math.atan2(b.y - v.y, b.x - v.x));
  if (angA < 0) angA += 360;
  if (angB < 0) angB += 360;
  let diff = angB - angA;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  const start = angA;
  const end = angA + diff;
  const sx = v.x + rr * Math.cos(toRad(start));
  const sy = v.y + rr * Math.sin(toRad(start));
  const ex = v.x + rr * Math.cos(toRad(end));
  const ey = v.y + rr * Math.sin(toRad(end));
  const largeArc = Math.abs(diff) > 180 ? 1 : 0;
  const sweepFlag = diff > 0 ? 1 : 0;
  return `M ${sx} ${sy} A ${rr} ${rr} 0 ${largeArc} ${sweepFlag} ${ex} ${ey}`;
}

const R = 150;
const CX = 230;
const CY = 220;
const VB_W = 620;

const pointOnCircle = (deg: number): Pt => ({
  x: CX + R * Math.cos(toRad(deg)),
  y: CY + R * Math.sin(toRad(deg)),
});

// Angular distance going clockwise from `from` to `to` (0..360).
function clockwiseDelta(from: number, to: number): number {
  let d = (to - from) % 360;
  if (d < 0) d += 360;
  return d;
}

type DragTarget = "A" | "B" | "P" | null;

export default function CentralInscribedAngleStation() {
  const [aDeg, setADeg] = useState(150);
  const [bDeg, setBDeg] = useState(30);
  const [pDeg, setPDeg] = useState(270);
  const [drag, setDrag] = useState<DragTarget>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const A = pointOnCircle(aDeg);
  const B = pointOnCircle(bDeg);
  const O = { x: CX, y: CY };
  const P = pointOnCircle(pDeg);

  const minorCentral = toDeg(angleBetween(O, A, B));
  const majorCentral = 360 - minorCentral;

  // P is "on the minor arc AB" when, going clockwise from A to B the short way,
  // P lies between them. Use clockwise deltas.
  const aToB = clockwiseDelta(aDeg, bDeg);
  const aToP = clockwiseDelta(aDeg, pDeg);
  const onMinorArc = aToP < aToB; // P within the A->B clockwise (minor) span

  const centralDeg = onMinorArc ? majorCentral : minorCentral;
  const inscribedDeg = toDeg(angleBetween(P, A, B));

  const degFromPointer = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return 0;
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * VB_W;
    const y = ((clientY - rect.top) / rect.height) * 440;
    let deg = toDeg(Math.atan2(y - CY, x - CX));
    if (deg < 0) deg += 360;
    return deg;
  }, []);

  const keepApart = (deg: number, others: number[]): number => {
    let d = deg;
    others.forEach((o) => {
      let diff = Math.abs(((d - o + 540) % 360) - 180);
      if (diff > 180) diff = 360 - diff;
      if (diff < 8) {
        // nudge away
        d = (o + 8) % 360;
      }
    });
    return d;
  };

  const onPointerDownPoint =
    (target: DragTarget) => (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as Element).setPointerCapture?.(e.pointerId);
      setDrag(target);
    };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const deg = degFromPointer(e.clientX, e.clientY);
    if (drag === "A") setADeg(keepApart(deg, [bDeg, pDeg]));
    else if (drag === "B") setBDeg(keepApart(deg, [aDeg, pDeg]));
    else if (drag === "P") setPDeg(keepApart(deg, [aDeg, bDeg]));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    setDrag(null);
  };

  // Highlighted (subtended) arc = the arc NOT containing P.
  const subtendedArcD = onMinorArc
    ? circleArcPath(CX, CY, R, aDeg, bDeg, 0) // major arc: sweep CCW from A to B
    : circleArcPath(CX, CY, R, bDeg, aDeg, 0); // minor arc CCW from B to A

  // Central-angle indicator arc at O (on the subtended side).
  const centralArcD = onMinorArc
    ? circleArcPath(O.x, O.y, 34, aDeg, bDeg, 0)
    : circleArcPath(O.x, O.y, 34, bDeg, aDeg, 0);

  const inscribedArcD = angleArcPath(P, A, B, 24);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-sky-50 to-emerald-50 px-4 py-10 sm:py-14">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-6 flex items-start gap-4">
          <div className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-emerald-500 text-white shadow-lg shadow-sky-200">
            <Compass className="h-6 w-6" />
          </div>
          <div>
            <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sky-700">
              <Sparkles className="h-3.5 w-3.5" /> สถานีที่ 1
            </div>
            <h1 className="text-2xl font-bold leading-tight text-slate-800 sm:text-3xl">
              มุมศูนย์กลาง &amp; มุมในส่วนโค้งของวงกลม
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              สำรวจความสัมพันธ์ระหว่างมุมที่จุดศูนย์กลางของวงกลม
              กับมุมที่ลากจากคอร์ดเดียวกันบนเส้นรอบวง
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          {/* Canvas card */}
          <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-xl shadow-slate-200/60 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center gap-2 text-sm font-medium text-slate-600">
              <Hand className="h-4 w-4 text-sky-500" />
              ลากจุด A, B และ P ได้อิสระรอบวงกลม
            </div>

            <svg
              ref={svgRef}
              viewBox={`0 0 ${VB_W} 440`}
              className="w-full touch-none select-none rounded-2xl bg-gradient-to-br from-slate-50 to-sky-50/40 ring-1 ring-slate-200/60"
            >
              <defs>
                <radialGradient id="circleFill" cx="50%" cy="42%" r="65%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="100%" stopColor="#eef6ff" />
                </radialGradient>
              </defs>

              {/* Circle */}
              <circle
                cx={CX}
                cy={CY}
                r={R}
                fill="url(#circleFill)"
                stroke="#0284c7"
                strokeWidth={2.5}
              />

              {/* Subtended arc highlight */}
              <path
                d={subtendedArcD}
                fill="none"
                stroke="#f59e0b"
                strokeWidth={6}
                strokeLinecap="round"
                opacity={0.85}
              />

              {/* Radii OA, OB */}
              <line x1={O.x} y1={O.y} x2={A.x} y2={A.y} stroke="#0284c7" strokeWidth={2.5} />
              <line x1={O.x} y1={O.y} x2={B.x} y2={B.y} stroke="#0284c7" strokeWidth={2.5} />

              {/* Chords PA, PB */}
              <line x1={P.x} y1={P.y} x2={A.x} y2={A.y} stroke="#10b981" strokeWidth={2.5} />
              <line x1={P.x} y1={P.y} x2={B.x} y2={B.y} stroke="#10b981" strokeWidth={2.5} />

              {/* Central-angle arc indicator at O */}
              <path d={centralArcD} fill="none" stroke="#0284c7" strokeWidth={3} opacity={0.9} />
              {/* Inscribed-angle arc indicator at P */}
              <path d={inscribedArcD} fill="none" stroke="#10b981" strokeWidth={3} opacity={0.9} />

              {/* Center O */}
              <circle cx={O.x} cy={O.y} r={5} fill="#0f172a" />
              <text x={O.x + 9} y={O.y - 8} className="fill-slate-700" fontSize={15} fontWeight={700}>O</text>

              {/* Draggable point A */}
              <circle
                cx={A.x}
                cy={A.y}
                r={drag === "A" ? 11 : 9}
                fill="#0284c7"
                stroke="#fff"
                strokeWidth={2.5}
                onPointerDown={onPointerDownPoint("A")}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                style={{ cursor: "grab" }}
                className="transition-[r] duration-75"
              />
              <text x={A.x - 16} y={A.y - 10} className="fill-sky-700 pointer-events-none" fontSize={15} fontWeight={700}>A</text>

              {/* Draggable point B */}
              <circle
                cx={B.x}
                cy={B.y}
                r={drag === "B" ? 11 : 9}
                fill="#0284c7"
                stroke="#fff"
                strokeWidth={2.5}
                onPointerDown={onPointerDownPoint("B")}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                style={{ cursor: "grab" }}
                className="transition-[r] duration-75"
              />
              <text x={B.x + 10} y={B.y - 10} className="fill-sky-700 pointer-events-none" fontSize={15} fontWeight={700}>B</text>

              {/* Draggable point P */}
              <circle
                cx={P.x}
                cy={P.y}
                r={drag === "P" ? 12 : 10}
                fill="#10b981"
                stroke="#fff"
                strokeWidth={3}
                onPointerDown={onPointerDownPoint("P")}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                style={{ cursor: "grab" }}
                className="transition-[r] duration-75"
              />
              <text x={P.x + 12} y={P.y + 16} className="fill-emerald-700 pointer-events-none" fontSize={15} fontWeight={700}>P</text>

              {/* Right-side live readouts */}
              <g>
                <rect x={415} y={130} width={185} height={76} rx={16} fill="#eff6ff" stroke="#bae6fd" />
                <text x={428} y={156} className="fill-sky-600" fontSize={12} fontWeight={600}>
                  มุมศูนย์กลาง ∠AOB
                </text>
                <text x={428} y={192} className="fill-sky-700" fontSize={30} fontWeight={700}>
                  {centralDeg.toFixed(1)}°
                </text>
              </g>
              <g>
                <rect x={415} y={234} width={185} height={76} rx={16} fill="#ecfdf5" stroke="#a7f3d0" />
                <text x={428} y={260} className="fill-emerald-600" fontSize={12} fontWeight={600}>
                  มุมในส่วนโค้งของวงกลม ∠APB
                </text>
                <text x={428} y={296} className="fill-emerald-700" fontSize={30} fontWeight={700}>
                  {inscribedDeg.toFixed(1)}°
                </text>
              </g>
            </svg>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
                มุมศูนย์กลาง
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                มุมในส่วนโค้งของวงกลม
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-4 rounded-full bg-amber-500" />
                เส้นโค้งที่รองรับ
              </span>
            </div>
          </div>

          {/* Side panel */}
          <div className="flex flex-col gap-4">
            {/* Instructions */}
            <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-lg shadow-slate-200/50">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                <Move className="h-4 w-4 text-sky-500" /> วิธีใช้งาน
              </h2>
              <ol className="space-y-2 text-sm text-slate-600">
                <li className="flex gap-2">
                  <span className="font-bold text-sky-500">1.</span> ลากจุด{" "}
                  <span className="font-semibold text-sky-600">A</span> และ{" "}
                  <span className="font-semibold text-sky-600">B</span>{" "}
                  เพื่อปรับคอร์ดของวงกลม
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-sky-500">2.</span> ลากจุด{" "}
                  <span className="font-semibold text-emerald-600">P</span>{" "}
                  ไปตามเส้นรอบวง
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-sky-500">3.</span> ค่ามุมทั้งสอง
                  อัปเดตทันทีตามตำแหน่งของทุกจุด
                </li>
              </ol>
            </div>

            {/* Observation */}
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-5">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800">
                <Lightbulb className="h-4 w-4" /> ข้อสังเกต
              </h2>
              <p className="text-sm leading-relaxed text-amber-900/90">
                ลองขยับจุด A และ B เพื่อเปลี่ยนขนาดคอร์ด แล้วลาก P ไปตามเส้นโค้งเดียวกัน
                มุมในส่วนโค้งของวงกลม{" "}
                <span className="font-semibold">∠APB</span> เปลี่ยนแปลงหรือไม่?
                และเมื่อ P ข้ามไปยังเส้นโค้งอีกฟาก ค่ามุมเป็นสองเท่าของมุมในส่วนโค้งของวงกลมเสมอหรือไม่?
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

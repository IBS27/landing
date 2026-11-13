import { useRef } from "react";
import {
  area,
  type Placement,
  placementCorners,
  roomCenter,
  type UnitScene,
} from "../../../../convex/lib/unitScene";

export function UnitPlan({
  scene,
  placements,
  selected,
  onSelect,
  onMove,
  onCorner,
}: {
  scene: UnitScene;
  placements: Placement[];
  selected: string | null;
  onSelect: (id: string) => void;
  onMove?: (id: string, x: number, z: number) => void;
  onCorner?: (roomId: string, index: number, x: number, z: number) => void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; corner?: number } | null>(null);
  const points = scene.rooms.flatMap((r) => r.polygon);
  const minX = Math.min(...points.map((p) => p.x)) - 1,
    minZ = Math.min(...points.map((p) => p.z)) - 1;
  const width = Math.max(...points.map((p) => p.x)) - minX + 1,
    height = Math.max(...points.map((p) => p.z)) - minZ + 1;
  const size = Math.max(width, height);
  return (
    <svg
      ref={svg}
      role="img"
      aria-label="Editable floor plan. Drag furniture or room corners. Coordinates can also be edited below."
      className="h-full w-full touch-none bg-[#eef1f4]"
      viewBox={`${minX} ${minZ} ${width} ${height}`}
      onPointerMove={(e) => {
        if (!drag.current || !svg.current) return;
        const matrix = svg.current.getScreenCTM();
        if (!matrix) return;
        const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse());
        const x = Math.round(p.x * 20) / 20,
          z = Math.round(p.y * 20) / 20;
        if (drag.current.corner !== undefined)
          onCorner?.(drag.current.id, drag.current.corner, x, z);
        else onMove?.(drag.current.id, x, z);
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
    >
      {scene.rooms.map((room) => {
        const p = roomCenter(room);
        return (
          <g key={room.id}>
            <polygon
              points={room.polygon.map((p) => `${p.x},${p.z}`).join(" ")}
              fill={room.floorColor}
              stroke="#64748b"
              strokeWidth={0.035}
            />
            <text
              x={p.x}
              y={p.z - 0.1}
              fontSize={size / 45}
              textAnchor="middle"
              fill="#263849"
              pointerEvents="none"
            >
              {room.name}
            </text>
            <text
              x={p.x}
              y={p.z + size / 40}
              fontSize={size / 60}
              textAnchor="middle"
              fill="#405166"
              pointerEvents="none"
            >
              {area(room.polygon).toFixed(1)} m² · {room.evidence.basis}
            </text>
            {onCorner &&
              room.polygon.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.z}
                  r={size / 100}
                  fill="#ffffff"
                  stroke="#0866ff"
                  strokeWidth={0.04}
                  className="cursor-move"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    drag.current = { id: room.id, corner: i };
                    svg.current?.setPointerCapture(e.pointerId);
                  }}
                />
              ))}
          </g>
        );
      })}
      {scene.appearance?.objects
        .filter((o) => o.position.y < 1.8)
        .map((o) => (
          <polygon
            key={`observed-${o.id}`}
            points={placementCorners({
              x: o.position.x,
              z: o.position.z,
              width: o.size.x,
              depth: o.size.z,
              rotation: o.rotation,
            })
              .map((p) => `${p.x},${p.z}`)
              .join(" ")}
            fill="#64748b"
            fillOpacity={0.2}
            stroke="#64748b"
            strokeWidth={0.02}
            pointerEvents="none"
          >
            <title>{o.label} · inferred footprint</title>
          </polygon>
        ))}
      {scene.walls.map((w) => (
        <g key={w.id}>
          <line
            x1={w.a.x}
            y1={w.a.z}
            x2={w.b.x}
            y2={w.b.z}
            stroke="#485668"
            strokeWidth={w.thickness}
          />
          {w.openings.map((o, i) => {
            const len = Math.hypot(w.b.x - w.a.x, w.b.z - w.a.z);
            const at = (t: number) => ({
              x: w.a.x + ((w.b.x - w.a.x) * t) / len,
              z: w.a.z + ((w.b.z - w.a.z) * t) / len,
            });
            const a = at(o.offset),
              b = at(o.offset + o.width);
            return (
              <line
                key={i}
                x1={a.x}
                y1={a.z}
                x2={b.x}
                y2={b.z}
                stroke={o.kind === "door" ? "#eef1f4" : "#51a2c5"}
                strokeWidth={w.thickness + 0.02}
              />
            );
          })}
        </g>
      ))}
      {placements.map((p) => (
        <polygon
          key={p.id}
          points={placementCorners(p)
            .map((c) => `${c.x},${c.z}`)
            .join(" ")}
          fill={p.color}
          stroke={selected === p.id ? "#0866ff" : "#39485a"}
          strokeWidth={selected === p.id ? 0.09 : 0.035}
          className={onMove ? "cursor-move" : "cursor-pointer"}
          onPointerDown={(e) => {
            e.stopPropagation();
            onSelect(p.id);
            if (!onMove) return;
            drag.current = { id: p.id };
            svg.current?.setPointerCapture(e.pointerId);
          }}
        >
          <title>{p.label}</title>
        </polygon>
      ))}
    </svg>
  );
}

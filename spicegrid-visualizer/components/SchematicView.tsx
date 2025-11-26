import React, { useMemo, useState, useRef, useEffect } from 'react';
import { ParsedCircuit, Component, ComponentType, ParsedNode } from '../types';

interface SchematicViewProps {
  circuit: ParsedCircuit;
  onSelectComponent: (comp: Component | null) => void;
  onSelectNode: (node: ParsedNode | null) => void;
  selectedId: string | null;
}

// Layout Constants
const CELL_W = 80;
const CELL_H = 60;
const GAP_X = 60;
const GAP_Y = 60;
const MARGIN_TOP = 100;
const MARGIN_LEFT = 100;

export const SchematicView: React.FC<SchematicViewProps> = ({ circuit, onSelectComponent, onSelectNode, selectedId }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ x: 50, y: 50, scale: 0.8 });
  const [isDragging, setIsDragging] = useState(false);
  const lastMousePos = useRef<{ x: number; y: number } | null>(null);

  const layout = useMemo(() => {
    const elements: any[] = [];
    const { rows, cols } = circuit.gridDimensions;
    
    // Helper to get Center coordinates of a cell (r, c)
    // 1-based indexing for r, c
    const getCellCenter = (r: number, c: number) => ({
      x: MARGIN_LEFT + (c - 1) * (CELL_W + GAP_X) + CELL_W / 2,
      y: MARGIN_TOP + (r - 1) * (CELL_H + GAP_Y) + CELL_H / 2,
    });

    // Helper to get coordinates for specific Lines/Tracks
    const getWLTrackY = (r: number) => MARGIN_TOP + (r - 1) * (CELL_H + GAP_Y) + 10;
    const getSLTrackY = (r: number) => MARGIN_TOP + (r - 1) * (CELL_H + GAP_Y) + CELL_H - 10;
    const getBLTrackX = (c: number) => MARGIN_LEFT + (c - 1) * (CELL_W + GAP_X) + 20;

    // --- 1. Draw Cells ---
    circuit.components.forEach(comp => {
      if (comp.type === ComponentType.Subcircuit && comp.gridPos) {
        const { row, col } = comp.gridPos;
        const center = getCellCenter(row, col);
        const x = center.x - CELL_W / 2;
        const y = center.y - CELL_H / 2;
        
        elements.push({
          id: comp.id,
          type: 'cell',
          x, y, w: CELL_W, h: CELL_H,
          comp,
          row, col
        });
      }
    });

    // --- 2. Draw Resistors (Rint) ---
    circuit.components.forEach(comp => {
      if (comp.type === ComponentType.Resistor) {
        // Rint_bl_1_1 -> bl11 to bl21
        const blMatch = comp.id.match(/Rint_bl_(\d+)_(\d+)/i);
        if (blMatch) {
            const r = parseInt(blMatch[1]);
            const c = parseInt(blMatch[2]);
            const pos1 = getCellCenter(r, c);
            const pos2 = getCellCenter(r + 1, c);
            const x = getBLTrackX(c);
            const y1 = pos1.y + CELL_H/2;
            const y2 = pos2.y - CELL_H/2;
            
            elements.push({
                id: comp.id,
                type: 'resistor-v',
                x, 
                y: (y1 + y2) / 2,
                len: y2 - y1,
                comp
            });
            return;
        }

        // Rint_sl_1_1 -> sl11 to sl12
        const slMatch = comp.id.match(/Rint_sl_(\d+)_(\d+)/i);
        if (slMatch) {
            const r = parseInt(slMatch[1]);
            const c = parseInt(slMatch[2]);
            const pos1 = getCellCenter(r, c);
            const pos2 = getCellCenter(r, c + 1);
            const y = getSLTrackY(r);
            const x1 = pos1.x + CELL_W/2;
            const x2 = pos2.x - CELL_W/2;

            elements.push({
                id: comp.id,
                type: 'resistor-h',
                x: (x1 + x2) / 2, 
                y,
                len: x2 - x1,
                comp
            });
            return;
        }
      }
    });

    // --- 3. Voltage Sources ---
    circuit.components.forEach(comp => {
      if (comp.type === ComponentType.VoltageSource) {
          const node = comp.nodes[0];
          
          const vblMatch = comp.id.match(/Vbl(\d+)/i);
          if (vblMatch) {
              const c = parseInt(vblMatch[1]);
              const x = getBLTrackX(c);
              const y = MARGIN_TOP - 60;
              elements.push({
                  id: comp.id,
                  type: 'source-v',
                  x, y,
                  label: `Vbl${c}`,
                  comp
              });
              elements.push({
                type: 'wire',
                x1: x, y1: y + 20,
                x2: x, y2: MARGIN_TOP,
                color: '#3b82f6',
                dashed: true 
              });
              return;
          }

          const vwlMatch = comp.id.match(/Vwl(\d+)/i);
          if (vwlMatch) {
              const r = parseInt(vwlMatch[1]);
              const y = getWLTrackY(r);
              const x = MARGIN_LEFT - 60;
              elements.push({
                  id: comp.id,
                  type: 'source-h',
                  x, y,
                  label: `Vwl${r}`,
                  comp
              });
              elements.push({
                  type: 'wire',
                  x1: x + 20, y1: y,
                  x2: MARGIN_LEFT, y2: y,
                  color: '#ef4444',
                  dashed: true
              });
              return;
          }

           const vslMatch = comp.id.match(/Vsl(\d+)/i);
           if (vslMatch) {
               const nodeMatch = node.match(/sl(\d+)(\d+)/);
               if (nodeMatch) {
                   const r = parseInt(nodeMatch[1]);
                   const c = parseInt(nodeMatch[2]);
                   const cellCenter = getCellCenter(r, c);
                   const x = cellCenter.x;
                   const y = cellCenter.y + CELL_H/2 + 40;
                   elements.push({
                       id: comp.id,
                       type: 'ground-source',
                       x, y,
                       comp
                   });
                   elements.push({
                    type: 'wire',
                    x1: x, y1: y - 20,
                    x2: x, y2: cellCenter.y + CELL_H/2 - 10,
                    color: '#10b981',
                    dashed: true
                   });
               }
           }
      }
    });

    return { 
        elements, 
        width: MARGIN_LEFT + cols * (CELL_W + GAP_X) + 100, 
        height: MARGIN_TOP + rows * (CELL_H + GAP_Y) + 100 
    };
  }, [circuit]);

  // --- Pan & Zoom Handlers ---

  const handleWheel = (e: React.WheelEvent) => {
    // ctrlKey usually indicates pinch-zoom on trackpads, but standard mouse wheel zoom is often expected
    // Let's support simple wheel zoom
    e.preventDefault();
    const scaleAmount = -e.deltaY * 0.001;
    const newScale = Math.min(Math.max(0.1, transform.scale * (1 + scaleAmount)), 5);
    
    // Zoom towards mouse pointer
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate generic point in world space
    const worldX = (mouseX - transform.x) / transform.scale;
    const worldY = (mouseY - transform.y) / transform.scale;

    // Update transform
    setTransform({
        x: mouseX - worldX * newScale,
        y: mouseY - worldY * newScale,
        scale: newScale
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
      // Only drag if left click and not on a specific element (although SVG bubbling handles this)
      if (e.button === 0) {
          setIsDragging(true);
          lastMousePos.current = { x: e.clientX, y: e.clientY };
      }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (!isDragging || !lastMousePos.current) return;
      
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      
      setTransform(prev => ({
          ...prev,
          x: prev.x + dx,
          y: prev.y + dy
      }));

      lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
      setIsDragging(false);
      lastMousePos.current = null;
  };

  // Interaction handlers for components
  const handleClick = (e: React.MouseEvent, comp: Component) => {
    e.stopPropagation(); // Prevent pan start if possible, but we use mouse down/up logic
    onSelectComponent(comp);
  };
  
  const handleNodeClick = (e: React.MouseEvent, nodeName: string) => {
      e.stopPropagation();
      const node = circuit.nodes.get(nodeName);
      if (node) onSelectNode(node);
  };

  return (
    <div 
        ref={containerRef}
        className={`w-full h-full bg-[#0f1115] overflow-hidden relative select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
    >
      <svg width="100%" height="100%" className="block">
        <defs>
             <pattern id="grid" x={transform.x % (20 * transform.scale)} y={transform.y % (20 * transform.scale)} width={20 * transform.scale} height={20 * transform.scale} patternUnits="userSpaceOnUse">
                <path d={`M ${20 * transform.scale} 0 L 0 0 0 ${20 * transform.scale}`} fill="none" stroke="#1f2937" strokeWidth={0.5 * transform.scale}/>
            </pattern>
        </defs>
        
        {/* Background Grid */}
        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* Scalable Group */}
        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
            {layout.elements.map((el, i) => {
                const isSelected = selectedId === el.id;
                
                // Scale visual elements slightly down when zoomed out so they remain visible/sharp? 
                // SVG scaling handles this naturally, but strokes might get too thin. 
                // We keep 'vector-effect: non-scaling-stroke' in mind if needed, but standard scaling is usually preferred for circuits.

                if (el.type === 'wire') {
                    return (
                        <line key={i} x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} 
                            stroke={el.color} strokeWidth={2} strokeDasharray={el.dashed ? "4 2" : "none"} opacity="0.6" />
                    );
                }

                if (el.type === 'cell') {
                    const { comp } = el;
                    const [nBL, nWL, nSL] = comp.nodes; 
                    
                    return (
                        <g key={el.id} transform={`translate(${el.x}, ${el.y})`} onClick={(e) => handleClick(e, el.comp)} className="group">
                            <rect 
                                width={el.w} height={el.h} 
                                rx={4} 
                                fill="#1e293b" 
                                stroke={isSelected ? '#3b82f6' : '#334155'} 
                                strokeWidth={isSelected ? 3 : 1}
                                className="transition-colors hover:stroke-gray-400"
                            />
                            <text x={el.w/2} y={el.h/2} textAnchor="middle" dy=".3em" fill="#94a3b8" fontSize="10" fontWeight="bold" className="pointer-events-none">
                                {el.id}
                            </text>
                            
                            {/* --- Internal Connections to Tracks --- */}
                            {/* BL (Vertical Left) */}
                            <circle cx={20} cy={0} r={3} fill="#3b82f6" onClick={(e) => handleNodeClick(e, nBL)} className="cursor-pointer hover:r-4 transition-all"/>
                            <line x1={20} y1={0} x2={20} y2={el.h} stroke="#3b82f6" strokeWidth="1.5" opacity="0.3" pointerEvents="none" /> 
                            
                            {/* WL (Horizontal Top) */}
                            <circle cx={0} cy={10} r={3} fill="#ef4444" onClick={(e) => handleNodeClick(e, nWL)} className="cursor-pointer hover:r-4 transition-all"/>
                            <line x1={0} y1={10} x2={el.w} y2={10} stroke="#ef4444" strokeWidth="1.5" opacity="0.3" pointerEvents="none" />

                            {/* SL (Horizontal Bottom) */}
                            <circle cx={el.w} cy={el.h - 10} r={3} fill="#10b981" onClick={(e) => handleNodeClick(e, nSL)} className="cursor-pointer hover:r-4 transition-all"/>
                            <line x1={0} y1={el.h - 10} x2={el.w} y2={el.h - 10} stroke="#10b981" strokeWidth="1.5" opacity="0.3" pointerEvents="none" />

                        </g>
                    );
                }

                if (el.type === 'resistor-v') {
                    return (
                        <g key={el.id} transform={`translate(${el.x}, ${el.y})`} onClick={(e) => handleClick(e, el.comp)} className="cursor-pointer">
                            <line x1={0} y1={-el.len/2} x2={0} y2={-8} stroke="#3b82f6" strokeWidth="2" />
                            <line x1={0} y1={8} x2={0} y2={el.len/2} stroke="#3b82f6" strokeWidth="2" />
                            <path d="M0,-8 L-4,-5 L4,-2 L-4,1 L4,4 L-4,7 L0,8" fill="none" stroke="#60a5fa" strokeWidth="2" />
                            <text x={8} y={0} fill="#60a5fa" fontSize="9" dy=".3em" opacity="0.7">{el.comp.params.value || 'R'}</text>
                        </g>
                    );
                }

                if (el.type === 'resistor-h') {
                    return (
                        <g key={el.id} transform={`translate(${el.x}, ${el.y})`} onClick={(e) => handleClick(e, el.comp)} className="cursor-pointer">
                            <line x1={-el.len/2} y1={0} x2={-8} y2={0} stroke="#10b981" strokeWidth="2" />
                            <line x1={8} y1={0} x2={el.len/2} y2={0} stroke="#10b981" strokeWidth="2" />
                            <path d="M-8,0 L-5,-4 L-2,4 L1,-4 L4,4 L7,-4 L8,0" fill="none" stroke="#34d399" strokeWidth="2" />
                        </g>
                    );
                }

                if (el.type === 'source-v') { 
                    return (
                        <g key={el.id} transform={`translate(${el.x}, ${el.y})`} onClick={(e) => handleClick(e, el.comp)} className="cursor-pointer hover:opacity-80">
                            <circle r={16} fill="#1e293b" stroke="#3b82f6" strokeWidth={isSelected ? 3 : 2} />
                            <path d="M -8 0 L -4 -5 L 0 5 L 4 -5 L 8 0" stroke="#3b82f6" fill="none" strokeWidth="1.5" />
                            <text y={-22} textAnchor="middle" fill="#3b82f6" fontSize="11" fontWeight="bold">{el.label}</text>
                        </g>
                    );
                }

                if (el.type === 'source-h') {
                    return (
                        <g key={el.id} transform={`translate(${el.x}, ${el.y})`} onClick={(e) => handleClick(e, el.comp)} className="cursor-pointer hover:opacity-80">
                            <circle r={16} fill="#1e293b" stroke="#ef4444" strokeWidth={isSelected ? 3 : 2} />
                            <path d="M -8 0 L -4 -5 L 0 5 L 4 -5 L 8 0" stroke="#ef4444" fill="none" strokeWidth="1.5" />
                            <text y={-22} textAnchor="middle" fill="#ef4444" fontSize="11" fontWeight="bold">{el.label}</text>
                        </g>
                    );
                }

                if (el.type === 'ground-source') {
                    return (
                        <g key={el.id} transform={`translate(${el.x}, ${el.y})`} onClick={(e) => handleClick(e, el.comp)}>
                            <circle r={12} fill="#1e293b" stroke="#10b981" strokeWidth={isSelected ? 3 : 2} />
                            <text dy=".3em" textAnchor="middle" fill="#10b981" fontSize="10">Vsl</text>
                        </g>
                    );
                }

                return null;
            })}
        </g>
      </svg>
      
      {/* Zoom Controls Overlay */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
          <button className="bg-gray-800 text-white p-2 rounded-full shadow hover:bg-gray-700" onClick={() => setTransform(t => ({...t, scale: t.scale * 1.2}))}>
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <button className="bg-gray-800 text-white p-2 rounded-full shadow hover:bg-gray-700" onClick={() => setTransform(t => ({...t, scale: Math.max(0.1, t.scale / 1.2)}))}>
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <button className="bg-gray-800 text-white px-3 py-1 rounded-full shadow hover:bg-gray-700 text-xs font-mono" onClick={() => setTransform({x:50, y:50, scale: 0.8})}>
             Reset
          </button>
      </div>

    </div>
  );
};

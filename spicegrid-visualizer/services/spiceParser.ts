import { Component, ComponentType, ParsedCircuit, ParsedNode, PWLPoint } from '../types';

export const parseSpice = (text: string): ParsedCircuit => {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('*'));
  
  const components: Component[] = [];
  const nodeMap = new Map<string, ParsedNode>();
  let maxRow = 0;
  let maxCol = 0;
  
  // Store .PARAMs to substitute if needed, though for visualization we usually show raw
  const paramsMap = new Map<string, string>();

  const getOrCreateNode = (name: string) => {
    if (!nodeMap.has(name)) {
      nodeMap.set(name, {
        name,
        capacitance: 0,
        isGround: name === '0' || name.toLowerCase() === 'gnd'
      });
    }
    return nodeMap.get(name)!;
  };

  // Helper to parse key=value strings
  const parseParams = (parts: string[]): Record<string, string> => {
    const params: Record<string, string> = {};
    parts.forEach(p => {
      if (p.includes('=')) {
        const [k, v] = p.split('=');
        params[k] = v;
      }
    });
    return params;
  };

  // Helper to parse PWL string
  const parsePWL = (args: string[]): PWLPoint[] => {
    // Look for "pwl" keyword and take subsequent numbers
    const pwlIdx = args.findIndex(a => a.toLowerCase() === 'pwl');
    if (pwlIdx === -1) return [];
    
    const points: PWLPoint[] = [];
    const rawNums = args.slice(pwlIdx + 1);
    
    // Parse pairs. Stop if we hit a non-number (like another keyword or end of line)
    for (let i = 0; i < rawNums.length - 1; i += 2) {
      // Clean possible param references (very basic handling)
      let tStr = rawNums[i];
      let vStr = rawNums[i+1];

      // If it's a param name, we can't easily resolve without a full evaluator, 
      // but if it's a number string, parse it.
      const t = parseFloat(tStr);
      const v = parseFloat(vStr);
      
      if (!isNaN(t) && !isNaN(v)) {
        points.push({ time: t, voltage: v });
      } else {
        // If we encounter a non-numeric token (e.g. 'vstage1'), stop or skip for simple viz
        // For this specific app, we might want to try to resolve basic params if possible, 
        // but robust SPICE eval is complex. We will visualize what we can parse.
      }
    }
    return points;
  };

  const parseValue = (valStr: string): number => {
    if (!valStr) return 0;
    // Handle "5000000.0" -> number
    // Handle "10M" -> 10e6 (SPICE MEG) but often M=milli in generic parsers, let's stick to standard SPICE
    // Standard SPICE: MEG = 1e6, M = 1e-3. 
    // However, in modern CMOS memory papers, M often = Mega. 
    // Looking at the netlist: Res=10M (probably Mega), Res=5000000.0 (5 Mega).
    // Context heuristic: Resistors are usually not 10 milliohm in memory arrays.
    
    let mult = 1;
    const lower = valStr.toLowerCase();
    
    // Remove unit chars (Ohm, F, H) if attached? Usually SPICE doesn't have them attached without space
    
    if (lower.endsWith('meg')) { mult = 1e6; }
    else if (lower.endsWith('k')) { mult = 1e3; }
    else if (lower.endsWith('m')) { 
        // Heuristic: if it's a Resistor, M usually means Mega in simplified informal netlists, 
        // but strictly M is Milli. 
        // Given 'Res=10M', likely 10 Megaohm.
        // Given '10e-9', standard float.
        // Let's assume standard engineering notation if 'e' is present, else suffixes.
        if (valStr.toLowerCase().includes('res')) mult = 1e6; // Risky heuristic
        else mult = 1e-3; 
    }
    else if (lower.endsWith('u')) { mult = 1e-6; }
    else if (lower.endsWith('n')) { mult = 1e-9; }
    else if (lower.endsWith('p')) { mult = 1e-12; }
    else if (lower.endsWith('f')) { mult = 1e-15; }

    // Strip suffix for parsing
    const cleanStr = valStr.replace(/[a-zA-Z]+$/, ''); 
    const num = parseFloat(cleanStr);
    
    // Fallback if parsing failed but it was just a number "5000000.0"
    if (isNaN(num)) {
        const directParse = parseFloat(valStr);
        return isNaN(directParse) ? 0 : directParse;
    }
    
    return num * mult;
  };

  lines.forEach(line => {
    // Handle .PARAM
    if (line.toLowerCase().startsWith('.param')) {
        const parts = line.split(/\s+/);
        // .PARAM name = val
        // very loose parsing
        const content = line.substring(7); // remove .PARAM 
        const assignments = content.split(' '); // naïve
        return;
    }

    if (line.startsWith('.')) return; // Skip other dot commands

    const cleanLine = line.split('$')[0].split(';')[0];
    if (!cleanLine) return;
    
    const parts = cleanLine.split(/\s+/);
    const name = parts[0];
    const typeChar = name[0].toUpperCase();

    if (typeChar === 'X') {
      // Subcircuit / Array Instance
      // Pattern: X<row>_<col> node1 node2 ... subcktName params...
      const match = name.match(/^X(\d+)_(\d+)$/i);
      let gridPos = undefined;
      
      if (match) {
        const r = parseInt(match[1]);
        const c = parseInt(match[2]);
        maxRow = Math.max(maxRow, r);
        maxCol = Math.max(maxCol, c);
        gridPos = { row: r, col: c };
      }

      // In the user's specific netlist: X1_1 bl11 wl1 sl11 mid1_1 CIM_CELL ...
      // 4 nodes before model name
      const nodeCount = 4;
      const nodes = parts.slice(1, 1 + nodeCount);
      const params = parseParams(parts.slice(1 + nodeCount + 1));
      
      nodes.forEach(n => getOrCreateNode(n));

      components.push({
        id: name,
        type: ComponentType.Subcircuit,
        nodes,
        params: { ...params, model: parts[1 + nodeCount] },
        gridPos,
        rawLine: line
      });

    } else if (typeChar === 'R') {
      // Resistor
      const nodes = parts.slice(1, 3);
      nodes.forEach(n => getOrCreateNode(n));
      const val = parts[3];
      
      components.push({
        id: name,
        type: ComponentType.Resistor,
        nodes,
        params: { value: val },
        rawLine: line
      });

    } else if (typeChar === 'C') {
      // Capacitor
      const n1 = parts[1];
      const n2 = parts[2];
      const valStr = parts[3];
      const capacitance = parseValue(valStr);
      const node1 = getOrCreateNode(n1);
      const node2 = getOrCreateNode(n2);

      // Aggregating parasitic capacitance to ground
      if (node2.isGround && !node1.isGround) {
        node1.capacitance += capacitance;
      } else if (node1.isGround && !node2.isGround) {
        node2.capacitance += capacitance;
      }

      // Only add to components list if it's NOT a parasitic-looking cap (i.e. not connected to ground)
      // or if user wants to see them. User requirement: "No need to draw parasitic capacitors".
      // So we skip adding to `components` if one leg is ground.
      if (!node1.isGround && !node2.isGround) {
         components.push({
            id: name,
            type: ComponentType.Capacitor,
            nodes: [n1, n2],
            params: { value: valStr },
            rawLine: line
         });
      }

    } else if (typeChar === 'V') {
      // Voltage Source
      const nodes = parts.slice(1, 3);
      nodes.forEach(n => getOrCreateNode(n));
      const isPWL = parts.some(p => p.toLowerCase() === 'pwl');
      const pwlData = isPWL ? parsePWL(parts) : undefined;

      components.push({
        id: name,
        type: ComponentType.VoltageSource,
        nodes,
        params: { type: isPWL ? 'PWL' : 'DC' },
        pwl: pwlData,
        rawLine: line
      });
    } else if (typeChar === 'G') {
       // VCCS or similar (Integrator in netlist)
       // Skip visualization for now or add as generic
    }
  });

  return {
    components,
    nodes: nodeMap,
    gridDimensions: { rows: maxRow, cols: maxCol }
  };
};
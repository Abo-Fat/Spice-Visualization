export enum ComponentType {
  Subcircuit = 'Subcircuit',
  Resistor = 'Resistor',
  Capacitor = 'Capacitor',
  VoltageSource = 'VoltageSource',
}

export interface PWLPoint {
  time: number;
  voltage: number;
}

export interface NodeParasitics {
  capacitance: number; // Farads
}

export interface ParsedNode {
  name: string;
  capacitance: number; // Total capacitance to ground
  isGround: boolean;
}

export interface Component {
  id: string; // The instance name (e.g., X1_1, Rint_1)
  type: ComponentType;
  nodes: string[]; // Connected node names
  params: Record<string, string>; // Parameters like Res=10M, ini_state=0.2
  
  // Specific properties
  pwl?: PWLPoint[]; // For voltage sources
  gridPos?: { row: number; col: number }; // For array instances
  rawLine: string;
}

export interface ParsedCircuit {
  components: Component[];
  nodes: Map<string, ParsedNode>;
  gridDimensions: { rows: number; cols: number };
}

export interface RenderableElement {
  type: 'cell' | 'resistor' | 'source' | 'wire' | 'port';
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number; // degrees
  data: Component | any;
  label?: string;
  color?: string;
}
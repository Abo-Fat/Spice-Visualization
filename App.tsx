import React, { useState, useEffect, useMemo } from 'react';
import { parseSpice } from './services/spiceParser';
import { SchematicView } from './components/SchematicView';
import WaveformViewer from './components/WaveformViewer';
import { Component, ParsedCircuit, ParsedNode, ComponentType } from './types';
import { FileText, Cpu, Zap, Activity, Info } from 'lucide-react';

const DEFAULT_NETLIST = `.title 4x4_1F1T_MFMIS_test_with_VerilogA
.HDL "MFMIS1.va"    * FeFET 模型
.HDL "DAC_4ch.va"    * Verilog-A DAC 模型

.OPTIONS ACCT LIST POST
.option post_version = 2001
.option DELMAX=1e-09
.option SEED=56123    * Verilog-A $dist_uniform 将使用此种子

* --- 1T1R 单元子电路定义 ---
.SUBCKT CIM_CELL bl wl sl PARAMS: ini_state=-0.7 Res=10M
    XFeFET bl wl mid MFMIS1 initial_initial_state=ini_state readonly=1
    Rlimit mid sl Res
.ENDS CIM_CELL

* --- 参数定义 (Parameters) ---

* 静态控制参数
.PARAM vstage1 = 1.05
.PARAM vstage2 = 2.15
.PARAM vstage3 = 3.25
* --- 波形时序 (Waveform Timing) ---
.PARAM t_edge = 1e-09
.PARAM t_pw = 9e-09

* (参考) 权重参数
.PARAM Weight1_1 = 3
.PARAM Weight1_2 = 3
.PARAM Weight1_3 = 3
.PARAM Weight1_4 = 3

* --- 4x4 单元阵列实例化 ---
* 节点顺序: X<row>_<col> bl<col> wl<row> sl1 mid<row>_<col>
X1_1 bl11 wl1 sl11 mid1_1 CIM_CELL ini_state=0.2 Res=5000000.0
X1_2 bl12 wl1 sl12 mid1_2 CIM_CELL ini_state=0.2 Res=5000000.0
X1_3 bl13 wl1 sl13 mid1_3 CIM_CELL ini_state=0.2 Res=5000000.0
X1_4 bl14 wl1 sl14 mid1_4 CIM_CELL ini_state=0.2 Res=5000000.0

X2_1 bl21 wl2 sl21 mid2_1 CIM_CELL ini_state=0.2 Res=5000000.0
X2_2 bl22 wl2 sl22 mid2_2 CIM_CELL ini_state=0.2 Res=5000000.0
X2_3 bl23 wl2 sl23 mid2_3 CIM_CELL ini_state=0.2 Res=5000000.0
X2_4 bl24 wl2 sl24 mid2_4 CIM_CELL ini_state=0.2 Res=5000000.0

X3_1 bl31 wl3 sl31 mid3_1 CIM_CELL ini_state=0.2 Res=5000000.0
X3_2 bl32 wl3 sl32 mid3_2 CIM_CELL ini_state=0.2 Res=5000000.0
X3_3 bl33 wl3 sl33 mid3_3 CIM_CELL ini_state=0.2 Res=5000000.0
X3_4 bl34 wl3 sl34 mid3_4 CIM_CELL ini_state=0.2 Res=5000000.0

X4_1 bl41 wl4 sl41 mid4_1 CIM_CELL ini_state=0.2 Res=5000000.0
X4_2 bl42 wl4 sl42 mid4_2 CIM_CELL ini_state=0.2 Res=5000000.0
X4_3 bl43 wl4 sl43 mid4_3 CIM_CELL ini_state=0.2 Res=5000000.0
X4_4 bl44 wl4 sl44 mid4_4 CIM_CELL ini_state=0.2 Res=5000000.0

* --- 寄生电容 (Parasitic Capacitors) ---
C_bl11 bl11 0 1e-15
C_sl11 sl11 0 1e-15
C_bl12 bl12 0 1e-15
C_sl12 sl12 0 1e-15
C_bl13 bl13 0 1e-15
C_sl13 sl13 0 1e-15
C_bl14 bl14 0 1e-15
C_sl14 sl14 0 1e-15
C_bl21 bl21 0 1e-15
C_sl21 sl21 0 1e-15
C_bl22 bl22 0 1e-15
C_sl22 sl22 0 1e-15
C_bl23 bl23 0 1e-15
C_sl23 sl23 0 1e-15
C_bl24 bl24 0 1e-15
C_sl24 sl24 0 1e-15
C_bl31 bl31 0 1e-15
C_sl31 sl31 0 1e-15
C_bl32 bl32 0 1e-15
C_sl32 sl32 0 1e-15
C_bl33 bl33 0 1e-15
C_sl33 sl33 0 1e-15
C_bl34 bl34 0 1e-15
C_sl34 sl34 0 1e-15
C_bl41 bl41 0 1e-15
C_sl41 sl41 0 1e-15
C_bl42 bl42 0 1e-15
C_sl42 sl42 0 1e-15
C_bl43 bl43 0 1e-15
C_sl43 sl43 0 1e-15
C_bl44 bl44 0 1e-15
C_sl44 sl44 0 1e-15

* (阵列内部线路寄生电阻启用, 线电阻密度 = 1000000.0 ohm/m)
Rint_bl_1_1 bl11 bl21 200.0
Rint_sl_1_1 sl11 sl12 200.0
Rint_bl_1_2 bl12 bl22 200.0
Rint_sl_1_2 sl12 sl13 200.0
Rint_bl_1_3 bl13 bl23 200.0
Rint_sl_1_3 sl13 sl14 200.0
Rint_bl_1_4 bl14 bl24 200.0
Rint_sl_1_4 sl14 sl15 200.0

Rint_bl_2_1 bl21 bl31 200.0
Rint_sl_2_1 sl21 sl22 200.0
Rint_bl_2_2 bl22 bl32 200.0
Rint_sl_2_2 sl22 sl23 200.0
Rint_bl_2_3 bl23 bl33 200.0
Rint_sl_2_3 sl23 sl24 200.0
Rint_bl_2_4 bl24 bl34 200.0
Rint_sl_2_4 sl24 sl25 200.0

Rint_bl_3_1 bl31 bl41 200.0
Rint_sl_3_1 sl31 sl32 200.0
Rint_bl_3_2 bl32 bl42 200.0
Rint_sl_3_2 sl32 sl33 200.0
Rint_bl_3_3 bl33 bl43 200.0
Rint_sl_3_3 sl33 sl34 200.0
Rint_bl_3_4 bl34 bl44 200.0
Rint_sl_3_4 sl34 sl35 200.0

Rint_bl_4_1 bl41 bl51 200.0
Rint_sl_4_1 sl41 sl42 200.0
Rint_bl_4_2 bl42 bl52 200.0
Rint_sl_4_2 sl42 sl43 200.0
Rint_bl_4_3 bl43 bl53 200.0
Rint_sl_4_3 sl43 sl44 200.0
Rint_bl_4_4 bl44 bl54 200.0
Rint_sl_4_4 sl44 sl45 200.0

* --- 电源和激励 (Powers & Stimuli) ---
* 4 个 Bitline 驱动 (Verilog-A DAC)
Vbl1 bl10 0 pwl 0 0 9e-9 0 10e-9 0.3 39e-9 0.3 40e-9 0
Vbl2 bl20 0 pwl 0 0 9e-9 0 10e-9 0.3 39e-9 0.3 40e-9 0  
Vbl3 bl30 0 pwl 0 0 9e-9 0 10e-9 0.3 39e-9 0.3 40e-9 0
Vbl4 bl40 0 pwl 0 0 9e-9 0 10e-9 0.3 39e-9 0.3 40e-9 0

* 4 个 Wordline 驱动 (Vwl)
Vwl1 wl1 0 pwl 0 0 9e-09 0 1e-08 vstage1 1.9e-08 vstage1 2e-08 vstage2 2.9e-08 vstage2 3e-08 vstage3 3.9e-08 vstage3 4e-08 vstage3
Vwl2 wl2 0 pwl 0 0 9e-09 0 1e-08 vstage1 1.9e-08 vstage1 2e-08 vstage2 2.9e-08 vstage2 3e-08 vstage3 3.9e-08 vstage3 4e-08 vstage3
Vwl3 wl3 0 pwl 0 0 9e-09 0 1e-08 vstage1 1.9e-08 vstage1 2e-08 vstage2 2.9e-08 vstage2 3e-08 vstage3 3.9e-08 vstage3 4e-08 vstage3
Vwl4 wl4 0 pwl 0 0 9e-09 0 1e-08 vstage1 1.9e-08 vstage1 2e-08 vstage2 2.9e-08 vstage2 3e-08 vstage3 3.9e-08 vstage3 4e-08 vstage3
* --- 共享源极线驱动 (Shared Source Line Driver) ---
Vsl1 sl41 0 0
Vsl2 sl42 0 0
Vsl3 sl43 0 0
Vsl4 sl44 0 0

* --- 理想积分器 ---
G_int_1 0 sl_integral_1 CUR = 'I(Vsl1)'
C_int_1 sl_integral_1 0 1F IC=0
G_int_2 0 sl_integral_2 CUR = 'I(Vsl2)'
C_int_2 sl_integral_2 0 1F IC=0
G_int_3 0 sl_integral_3 CUR = 'I(Vsl3)'
C_int_3 sl_integral_3 0 1F IC=0
G_int_4 0 sl_integral_4 CUR = 'I(Vsl4)'
C_int_4 sl_integral_4 0 1F IC=0

.END
`;

const App: React.FC = () => {
  const [spiceText, setSpiceText] = useState(DEFAULT_NETLIST);
  const [parsedCircuit, setParsedCircuit] = useState<ParsedCircuit | null>(null);
  const [selectedElement, setSelectedElement] = useState<Component | null>(null);
  const [selectedNode, setSelectedNode] = useState<ParsedNode | null>(null);
  const [showWaveform, setShowWaveform] = useState(false);

  useEffect(() => {
    try {
      const parsed = parseSpice(spiceText);
      setParsedCircuit(parsed);
    } catch (e) {
      console.error("Parse Error", e);
    }
  }, [spiceText]);

  const handleComponentSelect = (comp: Component | null) => {
    setSelectedElement(comp);
    setSelectedNode(null);
    if (comp && comp.type === ComponentType.VoltageSource && comp.params.type === 'PWL') {
      setShowWaveform(true);
    } else {
      setShowWaveform(false);
    }
  };

  const handleNodeSelect = (node: ParsedNode | null) => {
    setSelectedNode(node);
    setSelectedElement(null);
    setShowWaveform(false);
  };

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 font-sans overflow-hidden">
      
      {/* Left Sidebar: Editor */}
      <div className="w-1/3 border-r border-gray-800 flex flex-col bg-gray-900">
        <div className="p-4 border-b border-gray-800 flex items-center gap-2 shadow-sm z-10">
          <FileText className="text-blue-500" size={20} />
          <h1 className="font-bold text-lg tracking-wide text-gray-100">SpiceGrid Editor</h1>
        </div>
        <div className="flex-1 relative">
            <textarea
            className="absolute inset-0 w-full h-full bg-gray-900 p-4 text-xs font-mono text-gray-300 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 leading-5"
            value={spiceText}
            onChange={(e) => setSpiceText(e.target.value)}
            spellCheck={false}
            />
        </div>
        <div className="p-2 bg-gray-800 border-t border-gray-700 text-xs text-center text-gray-500 flex justify-between px-4">
          <span>Parsed Components: {parsedCircuit?.components.length}</span>
          <span>Nodes: {parsedCircuit?.nodes.size}</span>
        </div>
      </div>

      {/* Main Area: Visualizer */}
      <div className="flex-1 relative flex flex-col bg-[#0f1115]">
        {/* Toolbar */}
        <div className="h-14 border-b border-gray-800 bg-gray-900 flex items-center px-6 justify-between shadow-sm z-10">
            <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-blue-500"></span> <span className="text-gray-300">BL (Vertical)</span></div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-red-500"></span> <span className="text-gray-300">WL (Horizontal)</span></div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-emerald-500"></span> <span className="text-gray-300">SL (Horizontal)</span></div>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 font-mono bg-gray-800 px-3 py-1 rounded-full">
                <Zap size={12} className="text-yellow-500" />
                {parsedCircuit ? `${parsedCircuit.gridDimensions.rows}x${parsedCircuit.gridDimensions.cols} Array` : 'No Array'}
            </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-hidden relative">
          {parsedCircuit && (
            <SchematicView 
              circuit={parsedCircuit} 
              onSelectComponent={handleComponentSelect}
              onSelectNode={handleNodeSelect}
              selectedId={selectedElement?.id || null}
            />
          )}
        </div>

        {/* Floating Info Panel */}
        {(selectedElement || selectedNode) && (
          <div className="absolute top-6 right-6 bg-gray-800/95 backdrop-blur-sm border border-gray-700 p-5 rounded-xl shadow-2xl w-72 animate-in fade-in slide-in-from-right-4 z-50">
             <div className="flex items-center gap-2 mb-4 border-b border-gray-700 pb-3">
                 {selectedNode ? <Activity size={20} className="text-pink-400"/> : <Cpu size={20} className="text-blue-400"/>}
                 <span className="font-bold text-base text-white truncate">
                    {selectedNode ? `Node: ${selectedNode.name}` : selectedElement?.id}
                 </span>
             </div>
             
             <div className="space-y-3 text-sm text-gray-300">
                {selectedElement && (
                    <>
                        <div className="flex justify-between items-center bg-gray-900/50 p-2 rounded">
                            <span className="text-gray-500 text-xs uppercase tracking-wider">Type</span>
                            <span className="font-medium text-white">{selectedElement.type}</span>
                        </div>
                        <div className="space-y-1">
                            {Object.entries(selectedElement.params).map(([k, v]) => (
                                <div key={k} className="flex justify-between border-b border-gray-700/50 py-1 last:border-0">
                                    <span className="text-gray-500 text-xs">{k}</span>
                                    <span className="font-mono text-xs text-blue-300">{v}</span>
                                </div>
                            ))}
                        </div>
                         <div className="mt-3">
                             <span className="text-gray-500 text-xs uppercase tracking-wider block mb-1">Connections</span>
                             <div className="flex flex-wrap gap-1">
                                {selectedElement.nodes.map(n => (
                                    <span key={n} className="px-2 py-0.5 bg-gray-700 rounded text-xs font-mono text-gray-300 border border-gray-600">
                                        {n}
                                    </span>
                                ))}
                             </div>
                        </div>
                    </>
                )}
                {selectedNode && (
                    <>
                        <div className="flex justify-between items-center bg-gray-900/50 p-3 rounded border border-gray-700">
                            <span className="text-gray-500">Parasitic Cap</span>
                            <span className="font-mono text-emerald-400 font-bold">{(selectedNode.capacitance / 1e-15).toFixed(2)} fF</span>
                        </div>
                        <div className="p-3 bg-blue-900/20 rounded border border-blue-900/50 flex gap-2">
                             <Info size={16} className="text-blue-400 shrink-0 mt-0.5" />
                             <span className="text-xs text-blue-200">
                                Represents total extracted capacitance to ground (C_{selectedNode.name}).
                             </span>
                        </div>
                    </>
                )}
             </div>
          </div>
        )}

        {/* Waveform Modal */}
        {showWaveform && selectedElement?.pwl && (
            <WaveformViewer 
                data={selectedElement.pwl} 
                title={selectedElement.id} 
                onClose={() => setShowWaveform(false)}
            />
        )}
      </div>
    </div>
  );
};

export default App;
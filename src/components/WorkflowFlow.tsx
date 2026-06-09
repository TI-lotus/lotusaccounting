import { useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import { Plus, Play, FileCheck } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

const initialNodes: Node[] = [
  { id: "1", position: { x: 50, y: 150 }, data: { label: "Entrada" }, type: "input" },
  { id: "2", position: { x: 280, y: 60 }, data: { label: "Agente IA" } },
  { id: "3", position: { x: 510, y: 150 }, data: { label: "Validação" } },
  { id: "4", position: { x: 740, y: 240 }, data: { label: "Ação final" }, type: "output" },
];

const initialEdges: Edge[] = [
  { id: "e1-2", source: "1", target: "2", animated: true },
  { id: "e2-3", source: "2", target: "3", animated: true },
  { id: "e3-4", source: "3", target: "4", animated: true },
];

export const WorkflowFlow = () => {
  const { theme } = useTheme();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const addNode = () => {
    const id = `n-${Date.now()}`;
    setNodes((nds) => [
      ...nds,
      {
        id,
        position: { x: 200 + Math.random() * 300, y: 100 + Math.random() * 200 },
        data: { label: `Novo node ${nds.length + 1}` },
      },
    ]);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button variant="outline" className="rounded-xl gap-2" onClick={addNode}>
          <Plus className="h-4 w-4" />
          Adicionar node
        </Button>
        <Button variant="outline" className="rounded-xl gap-2">
          <FileCheck className="h-4 w-4" />
          Salvar
        </Button>
        <Button className="rounded-xl gap-2">
          <Play className="h-4 w-4" />
          Executar
        </Button>
      </div>
      <div
        className="h-[500px] rounded-2xl border border-border bg-card overflow-hidden workflow-flow-container"
        style={
          {
            // React Flow CSS variables — adapt nodes/edges/controls to current theme
            ["--xy-background-color" as any]: "hsl(var(--card))",
            ["--xy-background-pattern-color" as any]: "hsl(var(--border))",
            ["--xy-node-background-color" as any]: "hsl(var(--background))",
            ["--xy-node-border" as any]: "1px solid hsl(var(--border))",
            ["--xy-node-color" as any]: "hsl(var(--foreground))",
            ["--xy-node-boxshadow-default" as any]:
              "0 1px 2px hsl(var(--foreground) / 0.06), 0 1px 3px hsl(var(--foreground) / 0.08)",
            ["--xy-node-border-radius" as any]: "0.75rem",
            ["--xy-edge-stroke" as any]: "hsl(var(--muted-foreground))",
            ["--xy-edge-stroke-selected" as any]: "hsl(var(--primary))",
            ["--xy-handle-background-color" as any]: "hsl(var(--primary))",
            ["--xy-handle-border-color" as any]: "hsl(var(--background))",
            ["--xy-controls-button-background-color" as any]: "hsl(var(--background))",
            ["--xy-controls-button-background-color-hover" as any]: "hsl(var(--accent))",
            ["--xy-controls-button-color" as any]: "hsl(var(--foreground))",
            ["--xy-controls-button-color-hover" as any]: "hsl(var(--foreground))",
            ["--xy-controls-button-border-color" as any]: "hsl(var(--border))",
            ["--xy-minimap-background-color" as any]: "hsl(var(--background))",
            ["--xy-minimap-node-background-color" as any]: "hsl(var(--primary) / 0.6)",
            ["--xy-minimap-mask-background-color" as any]: "hsl(var(--muted) / 0.6)",
            ["--xy-attribution-background-color" as any]: "transparent",
          } as React.CSSProperties
        }
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          colorMode={theme}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background color="hsl(var(--border))" />
          <Controls />
          <MiniMap pannable zoomable />
        </ReactFlow>
      </div>
    </div>
  );
};

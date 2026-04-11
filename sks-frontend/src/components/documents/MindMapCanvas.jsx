import { useEffect, useMemo, useRef, useState } from 'react';
import ELK from 'elkjs/lib/elk.bundled.js';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import MindMapNode from './MindMapNode.jsx';

const elk = new ELK();

const nodeTypes = {
  mindMap: MindMapNode,
};

const NODE_SIZES = {
  root: { width: 320, height: 88 },
  overview: { width: 260, height: 92 },
  cluster: { width: 270, height: 92 },
  insight: { width: 250, height: 88 },
  detail: { width: 235, height: 84 },
  takeaway: { width: 255, height: 90 },
};

const nodeColorByKind = {
  root: '#ddd6fe',
  overview: '#bae6fd',
  cluster: '#bae6fd',
  insight: '#e0f2fe',
  detail: '#f1f5f9',
  takeaway: '#d1fae5',
};

const edgeStyle = {
  stroke: '#6366f1',
  strokeWidth: 2,
  opacity: 0.9,
};

const shouldVisitChildren = (node, options) => {
  if (options.showAllNodes) {
    return true;
  }

  if (node.id === options.rootId) {
    return true;
  }

  return options.expandedNodeIds.has(node.id);
};

const flattenVisibleMindMapTree = (mindMap, options) => {
  const nodes = [];
  const edges = [];

  const visit = (node, parentId = null) => {
    const nodeSize = NODE_SIZES[node.kind] ?? NODE_SIZES.insight;
    const hasChildren = Array.isArray(node.children) && node.children.length > 0;

    nodes.push({
      id: node.id,
      type: 'mindMap',
      position: { x: 0, y: 0 },
      data: {
        id: node.id,
        label: node.label,
        kind: node.kind,
        hasSummary: Boolean(node.summary),
        childCount: hasChildren ? node.children.length : 0,
        uiLanguage: options.language,
        showToggle:
          hasChildren
          && node.id !== options.rootId
          && !options.showAllNodes,
        isExpanded: options.expandedNodeIds.has(node.id) || options.showAllNodes,
        isSelected: node.id === options.selectedNodeId,
        onSelect: options.onNodeSelect,
        onToggle: hasChildren && !options.showAllNodes ? options.onNodeToggle : null,
        toggleOnSelect:
          hasChildren
          && !options.showAllNodes
          && !options.expandedNodeIds.has(node.id),
      },
      draggable: false,
      selectable: false,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: {
        width: nodeSize.width,
        height: nodeSize.height,
      },
    });

    if (parentId) {
      edges.push({
        id: `${parentId}->${node.id}`,
        source: parentId,
        target: node.id,
        type: 'simplebezier',
        animated: false,
        style: edgeStyle,
      });
    }

    if (!shouldVisitChildren(node, options)) {
      return;
    }

    node.children?.forEach((child) => visit(child, node.id));
  };

  visit(mindMap);

  return { nodes, edges };
};

const buildFallbackLayout = (nodes, edges) => ({
  nodes: nodes.map((node, index) => ({
    ...node,
    position: {
      x: Math.floor(index / 4) * 260,
      y: (index % 4) * 110,
    },
  })),
  edges,
});

const applyMindMapLayout = async (mindMap, options) => {
  const { nodes, edges } = flattenVisibleMindMapTree(mindMap, options);

  const elkGraph = {
    id: 'mindmap-layout',
    layoutOptions: {
      'elk.algorithm': 'mrtree',
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': options.compact ? '30' : '40',
      'elk.layered.spacing.nodeNodeBetweenLayers': options.compact
        ? '90'
        : '120',
      'elk.edgeRouting': 'SPLINES',
    },
    children: nodes.map((node) => ({
      id: node.id,
      width: node.style.width,
      height: node.style.height,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  };

  try {
    const layout = await elk.layout(elkGraph);
    const positionsById = new Map(
      (layout.children ?? []).map((child) => [
        child.id,
        {
          x: child.x ?? 0,
          y: child.y ?? 0,
        },
      ]),
    );

    return {
      nodes: nodes.map((node) => ({
        ...node,
        position: positionsById.get(node.id) ?? node.position,
      })),
      edges,
    };
  } catch {
    return buildFallbackLayout(nodes, edges);
  }
};

function MindMapFlow({
  mindMap,
  selectedNodeId,
  expandedNodeIds,
  showAllNodes,
  onNodeSelect,
  onNodeToggle,
  language = 'en',
  height = 560,
  compact = false,
}) {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const { fitView } = useReactFlow();
  const wrapperRef = useRef(null);

  useEffect(() => {
    let active = true;

    const layoutMindMap = async () => {
      if (!mindMap) {
        setNodes([]);
        setEdges([]);
        return;
      }

      const layout = await applyMindMapLayout(mindMap, {
        rootId: mindMap.id,
        selectedNodeId,
        expandedNodeIds,
        showAllNodes,
        onNodeSelect,
        onNodeToggle,
        compact,
        language,
      });

      if (!active) {
        return;
      }

      setNodes(layout.nodes);
      setEdges(layout.edges);
    };

    void layoutMindMap();

    return () => {
      active = false;
    };
  }, [
    compact,
    expandedNodeIds,
    mindMap,
    onNodeSelect,
    onNodeToggle,
    selectedNodeId,
    showAllNodes,
    language,
  ]);

  useEffect(() => {
    if (nodes.length === 0) {
      return;
    }

    const fitCanvas = () => {
      void fitView({
        duration: 360,
        maxZoom: compact ? 1.05 : 1.25,
        minZoom: compact ? 0.55 : 0.45,
        padding: compact ? 0.14 : 0.2,
      });
    };

    let frameId = 0;
    const scheduleFitView = () => {
      frameId = window.requestAnimationFrame(() => {
        frameId = window.requestAnimationFrame(() => {
          fitCanvas();
        });
      });
    };

    scheduleFitView();

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' && wrapperRef.current
        ? new ResizeObserver(() => {
            scheduleFitView();
          })
        : null;

    if (resizeObserver && wrapperRef.current) {
      resizeObserver.observe(wrapperRef.current);
    }

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
    };
  }, [compact, fitView, nodes]);

  const minimapNodeColor = useMemo(
    () => (node) =>
      nodeColorByKind[node.data.kind] ?? nodeColorByKind.insight,
    [],
  );

  const handleNodeClick = (_, node) => {
    onNodeSelect?.(node.id);

    if (node.data?.toggleOnSelect) {
      onNodeToggle?.(node.id);
    }
  };

  return (
    <div
      ref={wrapperRef}
      className="min-w-0 w-full flex-1 overflow-hidden rounded-[30px] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(248,250,252,0.96)_100%)] shadow-[0_34px_90px_-38px_rgba(15,23,42,0.22)]"
      style={{ height }}
    >
      <ReactFlow
        className="h-full w-full"
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        minZoom={compact ? 0.55 : 0.45}
        maxZoom={compact ? 1.2 : 1.6}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        onNodeClick={handleNodeClick}
        proOptions={{ hideAttribution: true }}
      >
        {!compact && (
          <MiniMap
            pannable
            zoomable
            nodeBorderRadius={18}
            maskColor="rgba(15, 23, 42, 0.08)"
            nodeColor={minimapNodeColor}
            className="!rounded-2xl !border !border-slate-200 !bg-white/90 !shadow-lg"
          />
        )}
        <Controls
          showInteractive={false}
          className="!rounded-2xl !border !border-slate-200 !bg-white/90 !shadow-lg"
        />
        <Background
          variant={BackgroundVariant.Dots}
          gap={compact ? 18 : 22}
          size={1.1}
          color="rgba(15, 23, 42, 0.08)"
        />
      </ReactFlow>
    </div>
  );
}

function MindMapCanvas(props) {
  return (
    <ReactFlowProvider>
      <MindMapFlow {...props} />
    </ReactFlowProvider>
  );
}

export default MindMapCanvas;

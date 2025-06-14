
import React, { useRef, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GameState } from '../GlassBeadGame';

interface GameCanvasProps {
  disciplines: any[];
  gameState: GameState;
  onStateChange: (state: GameState) => void;
  isPlaying: boolean;
}

interface Node {
  id: string;
  x: number;
  y: number;
  z: number;
  discipline: string;
  connections: string[];
  energy: number;
  resonance: number;
}

interface Connection {
  from: string;
  to: string;
  strength: number;
  harmonic: number;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  disciplines,
  gameState,
  onStateChange,
  isPlaying
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [syntheses, setSyntheses] = useState<any[]>([]);

  // Initialize nodes for selected disciplines
  useEffect(() => {
    if (gameState.selectedDisciplines.length > 0) {
      const newNodes: Node[] = gameState.selectedDisciplines.map((disciplineId, index) => {
        const angle = (index / gameState.selectedDisciplines.length) * Math.PI * 2;
        const radius = 150;
        return {
          id: `${disciplineId}-${index}`,
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
          z: Math.sin(angle * 2) * 50,
          discipline: disciplineId,
          connections: [],
          energy: Math.random() * 100,
          resonance: Math.random()
        };
      });
      setNodes(newNodes);
    }
  }, [gameState.selectedDisciplines]);

  // Animation loop
  useEffect(() => {
    if (!isPlaying) return;

    const animate = () => {
      setNodes(prevNodes => 
        prevNodes.map(node => ({
          ...node,
          energy: node.energy + (Math.random() - 0.5) * 2,
          resonance: Math.sin(Date.now() * 0.001 + node.x * 0.01) * 0.5 + 0.5,
          z: node.z + Math.sin(Date.now() * 0.001 + node.x * 0.01) * 2
        }))
      );
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying]);

  // Canvas drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Clear canvas
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw background grid
    ctx.strokeStyle = 'rgba(100, 100, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 50) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, canvas.height);
      ctx.stroke();
    }
    for (let i = 0; i < canvas.height; i += 50) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(canvas.width, i);
      ctx.stroke();
    }

    // Transform to center
    ctx.translate(canvas.width / 2, canvas.height / 2);

    // Draw connections
    connections.forEach(connection => {
      const fromNode = nodes.find(n => n.id === connection.from);
      const toNode = nodes.find(n => n.id === connection.to);
      if (!fromNode || !toNode) return;

      ctx.strokeStyle = `rgba(255, 255, 255, ${connection.strength * 0.5})`;
      ctx.lineWidth = connection.strength * 3;
      ctx.beginPath();
      ctx.moveTo(fromNode.x, fromNode.y);
      ctx.lineTo(toNode.x, toNode.y);
      ctx.stroke();

      // Draw harmonic waves along connection
      if (connection.harmonic > 0.5) {
        ctx.strokeStyle = `hsla(${connection.harmonic * 360}, 70%, 60%, 0.3)`;
        ctx.lineWidth = 1;
        const steps = 20;
        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const x = fromNode.x + (toNode.x - fromNode.x) * t;
          const y = fromNode.y + (toNode.y - fromNode.y) * t;
          const wave = Math.sin(t * Math.PI * 4 + Date.now() * 0.005) * 10;
          if (i === 0) {
            ctx.moveTo(x, y + wave);
          } else {
            ctx.lineTo(x, y + wave);
          }
        }
        ctx.stroke();
      }
    });

    // Draw nodes
    nodes.forEach(node => {
      const discipline = disciplines.find(d => d.id === node.discipline);
      if (!discipline) return;

      // Node glow effect
      const glowRadius = 20 + node.energy * 0.3;
      const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowRadius);
      gradient.addColorStop(0, `${discipline.color}80`);
      gradient.addColorStop(1, `${discipline.color}00`);
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(node.x, node.y, glowRadius, 0, Math.PI * 2);
      ctx.fill();

      // Node core
      ctx.fillStyle = discipline.color;
      ctx.beginPath();
      ctx.arc(node.x, node.y, 8 + node.resonance * 5, 0, Math.PI * 2);
      ctx.fill();

      // Node symbol
      ctx.fillStyle = 'white';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(discipline.icon, node.x, node.y);

      // Selection highlight
      if (selectedNode === node.id) {
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 15, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    // Draw synthesis effects
    syntheses.forEach((synthesis, index) => {
      const alpha = 1 - (Date.now() - synthesis.timestamp) / 3000;
      if (alpha <= 0) return;

      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(synthesis.text, synthesis.x, synthesis.y - index * 20);
    });

  }, [nodes, connections, selectedNode, syntheses, disciplines]);

  // Handle canvas click
  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left - canvas.width / 2;
    const y = event.clientY - rect.top - canvas.height / 2;

    // Check if clicking on a node
    const clickedNode = nodes.find(node => {
      const distance = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2);
      return distance < 20;
    });

    if (clickedNode) {
      if (selectedNode && selectedNode !== clickedNode.id) {
        // Create connection between selected node and clicked node
        const newConnection: Connection = {
          from: selectedNode,
          to: clickedNode.id,
          strength: Math.random(),
          harmonic: Math.random()
        };
        setConnections(prev => [...prev, newConnection]);

        // Create synthesis event
        const synthesis = {
          text: 'Synthesis Achieved!',
          x: (nodes.find(n => n.id === selectedNode)?.x || 0 + clickedNode.x) / 2,
          y: (nodes.find(n => n.id === selectedNode)?.y || 0 + clickedNode.y) / 2,
          timestamp: Date.now()
        };
        setSyntheses(prev => [...prev, synthesis]);

        setSelectedNode(null);
      } else {
        setSelectedNode(clickedNode.id);
      }
    } else {
      setSelectedNode(null);
    }
  };

  // Clean up old syntheses
  useEffect(() => {
    const interval = setInterval(() => {
      setSyntheses(prev => prev.filter(s => Date.now() - s.timestamp < 3000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="bg-gray-900 border-gray-700 p-4 h-[600px]">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold text-white">Synthesis Space</h3>
        <div className="flex gap-2">
          <Badge variant="outline" className="border-blue-400 text-blue-400">
            {nodes.length} Active Nodes
          </Badge>
          <Badge variant="outline" className="border-green-400 text-green-400">
            {connections.length} Connections
          </Badge>
        </div>
      </div>
      
      <canvas
        ref={canvasRef}
        className="w-full h-full bg-gradient-to-br from-indigo-950 to-purple-950 rounded-lg cursor-crosshair"
        onClick={handleCanvasClick}
        onMouseMove={(e) => {
          const rect = canvasRef.current?.getBoundingClientRect();
          if (rect) {
            setMousePos({
              x: e.clientX - rect.left,
              y: e.clientY - rect.top
            });
          }
        }}
      />
      
      {selectedNode && (
        <div className="absolute top-4 right-4 bg-gray-800 p-2 rounded-lg border border-gray-600">
          <p className="text-sm text-gray-300">
            Click another node to create a synthesis
          </p>
        </div>
      )}
    </Card>
  );
};

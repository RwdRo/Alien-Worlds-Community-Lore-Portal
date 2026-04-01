import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const PLANET_ASSETS = [
  '/assets/iPS42_Eyeke.png',
  '/assets/iPS42_Kavian.png',
  '/assets/iPS42_Magor.png',
  '/assets/iPS42_Naron.png',
  '/assets/iPS42_Neri.png',
  '/assets/iPS42_Veles.png',
];

const getPlanetImage = (id: string) => {
  // Simple hash to consistently pick a planet image
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PLANET_ASSETS[Math.abs(hash) % PLANET_ASSETS.length];
};

interface Node extends d3.SimulationNodeDatum {
  id: string;
  type: string;
  category?: string;
  x?: number;
  y?: number;
}

interface Link extends d3.SimulationLinkDatum<Node> {
  predicate: string;
}

interface LoreGraphProps {
  entities: { name: string; type: string }[];
  relationships: { subject: string; predicate: string; object: string }[];
  onNodeClick?: (nodeId: string) => void;
}

export const LoreGraph: React.FC<LoreGraphProps> = ({ entities, relationships, onNodeClick }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || entities.length === 0) return;

    const width = 1000;
    const height = 800;

    // Clear previous graph
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("viewBox", [0, 0, width, height])
      .attr("style", "max-width: 100%; height: auto; cursor: grab;");

    // Add glow filter
    const defs = svg.append("defs");
    const filter = defs.append("filter")
      .attr("id", "glow")
      .attr("x", "-50%")
      .attr("y", "-50%")
      .attr("width", "200%")
      .attr("height", "200%");
    
    filter.append("feGaussianBlur")
      .attr("stdDeviation", "3.5")
      .attr("result", "coloredBlur");
    
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    const container = svg.append("g");

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 5])
      .on("zoom", (event) => {
        container.attr("transform", event.transform);
      });

    svg.call(zoom);

    // Prepare data
    const nodes: Node[] = entities.map(e => ({ id: e.name, type: e.type }));
    
    // Filter relationships to only include those where both subject and object exist in entities
    const validRelationships = relationships.filter(r => 
      nodes.some(n => n.id === r.subject) && nodes.some(n => n.id === r.object)
    );

    const links: Link[] = validRelationships.map(r => ({
      source: r.subject,
      target: r.object,
      predicate: r.predicate
    }));

    const simulation = d3.forceSimulation<Node>(nodes)
      .force("link", d3.forceLink<Node, Link>(links).id(d => d.id).distance(150))
      .force("charge", d3.forceManyBody().strength(-400))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(50));

    // Add arrows
    defs.selectAll("marker")
      .data(["end"])
      .join("marker")
      .attr("id", d => d)
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 35)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("fill", "#666")
      .attr("d", "M0,-5L10,0L0,5");

    const link = container.append("g")
      .attr("stroke", "#444")
      .attr("stroke-opacity", 0.4)
      .selectAll("g")
      .data(links)
      .join("g");

    link.append("line")
      .attr("stroke-width", 1.5)
      .attr("marker-end", "url(#end)");

    link.append("text")
      .attr("fill", "#888")
      .attr("font-size", "8px")
      .attr("text-anchor", "middle")
      .attr("dy", -5)
      .text(d => d.predicate.replace(/_/g, ' '));

    const node = container.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("class", "node-group")
      .style("cursor", "pointer")
      .on("click", (event, d) => onNodeClick?.(d.id))
      .call(d3.drag<SVGGElement, Node>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    // Background circle for glow
    node.append("circle")
      .attr("r", d => d.type === 'planets' ? 25 : 15)
      .attr("fill", d => {
        switch (d.type) {
          case 'planets': return 'rgba(74, 222, 128, 0.2)';
          case 'technology': return 'rgba(96, 165, 250, 0.2)';
          case 'species': return 'rgba(248, 113, 113, 0.2)';
          case 'factions': return 'rgba(251, 191, 36, 0.2)';
          default: return 'rgba(156, 163, 175, 0.2)';
        }
      })
      .attr("filter", "url(#glow)");

    // Node content (Image for planets, circle for others)
    node.each(function(d) {
      const el = d3.select(this);
      if (d.type === 'planets') {
        el.append("image")
          .attr("xlink:href", getPlanetImage(d.id))
          .attr("x", -20)
          .attr("y", -20)
          .attr("width", 40)
          .attr("height", 40)
          .attr("class", "planet-image")
          .attr("referrerpolicy", "no-referrer");
      } else {
        el.append("circle")
          .attr("r", 12)
          .attr("fill", () => {
            switch (d.type) {
              case 'technology': return '#60a5fa';
              case 'species': return '#f87171';
              case 'factions': return '#fbbf24';
              default: return '#9ca3af';
            }
          })
          .attr("stroke", "#fff")
          .attr("stroke-width", 2);
        
        // Add icon placeholder or letter
        el.append("text")
          .attr("text-anchor", "middle")
          .attr("dy", ".35em")
          .attr("fill", "#000")
          .attr("font-size", "10px")
          .attr("font-weight", "bold")
          .text(d.type.charAt(0).toUpperCase());
      }
    });

    node.append("text")
      .attr("y", d => d.type === 'planets' ? 35 : 25)
      .attr("text-anchor", "middle")
      .text(d => d.id)
      .attr("fill", "#fff")
      .attr("font-size", "10px")
      .attr("font-weight", "600")
      .attr("class", "node-label")
      .style("text-shadow", "0 0 5px rgba(0,0,0,0.8)");

    simulation.on("tick", () => {
      link.select("line")
        .attr("x1", d => (d.source as any).x)
        .attr("y1", d => (d.source as any).y)
        .attr("x2", d => (d.target as any).x)
        .attr("y2", d => (d.target as any).y);

      link.select("text")
        .attr("x", d => ((d.source as any).x + (d.target as any).x) / 2)
        .attr("y", d => ((d.source as any).y + (d.target as any).y) / 2);

      node
        .attr("transform", d => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
      svg.style("cursor", "grabbing");
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
      svg.style("cursor", "grab");
    }

    return () => {
      simulation.stop();
    };
  }, [entities, relationships]);

  return (
    <div className="w-full h-[600px] bg-neutral-black/40 border border-neutral-grey/10 rounded-lg overflow-hidden relative">
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <div className="bg-neutral-black/60 border border-neutral-grey/20 p-2 rounded text-[8px] uppercase tracking-widest text-neutral-grey flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400" /> Planets
        </div>
        <div className="bg-neutral-black/60 border border-neutral-grey/20 p-2 rounded text-[8px] uppercase tracking-widest text-neutral-grey flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-400" /> Technology
        </div>
        <div className="bg-neutral-black/60 border border-neutral-grey/20 p-2 rounded text-[8px] uppercase tracking-widest text-neutral-grey flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-400" /> Species
        </div>
        <div className="bg-neutral-black/60 border border-neutral-grey/20 p-2 rounded text-[8px] uppercase tracking-widest text-neutral-grey flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-yellow-400" /> Factions
        </div>
      </div>
      <div className="absolute bottom-4 right-4 z-10 text-[8px] uppercase tracking-widest text-neutral-grey/40">
        Scroll to Zoom • Drag to Pan • Click to View Lore
      </div>
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
};

import React, { useEffect, useRef } from 'react';
import { LineageMap } from '../LineageMap';
import { Graph, LineageMapProps } from '../types';

export const LineageMapComponent: React.FC<LineageMapProps> = ({
  data,
  width = '100%',
  height = '800px',
  options = {},
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const lineageMapRef = useRef<LineageMap | null>(null);
  data.edges.forEach(((edge, index) => edge.id = index.toString()))
  data.nodes.forEach(((node) => {
    if (node.type === "field") {
      node.tableId = node.id.split(":")[0];
    }
  }))
  const graph = data as Graph;

  useEffect(() => {
    // Skip initialization if we already have an instance
    if (containerRef.current && !lineageMapRef.current) {
      const defaultOptions = {
        width,
        height,
        tableWidth: 150,
        tableHeight: 40,
        fieldHeight: 20,
        fieldSpacing: 4,
        levelPadding: 100,
        verticalPadding: 50,
        ...options,
      };

      lineageMapRef.current = new LineageMap(containerRef.current, defaultOptions);
      (window as any).lineageMap = lineageMapRef.current;
      lineageMapRef.current.renderBase(graph);
    }

    return () => {
      if (lineageMapRef.current) {
        // Add a proper cleanup method to LineageMap class
        lineageMapRef.current.destroy();
        lineageMapRef.current = null;
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      if ((window as any).lineageMap === lineageMapRef.current) {
        delete (window as any).lineageMap;
      }
    };
  }, [data, width, height, options]);

  return (
    <div
      ref={containerRef}
      className={`react-lineage-map ${className}`}
      style={{ width, height }}
    />
  );
};
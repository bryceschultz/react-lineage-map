export interface Node {
  id: string;
  type: 'table' | 'field';
  name: string;
  tableId?: string;
  transformation?: string;
}

export interface Edge {
  id: string;
  source: string;
  target: string;
  type: string;
}

export interface Graph {
  nodes: Node[];
  edges: Edge[];
}

export interface LineageMapOptions {
  width?: string | number;
  height?: string | number;
  tableWidth?: number;
  tableHeight?: number;
  fieldHeight?: number;
  fieldSpacing?: number;
  levelPadding?: number;
  verticalPadding?: number;
}

export interface LineageMapProps {
  data: Graph;
  width?: string | number;
  height?: string | number;
  options?: LineageMapOptions;
  className?: string;
}

export interface Position {
  x: number;
  y: number;
}

export interface TableLevel {
  id: string;
  level: number;
  dependencies: string[];
}
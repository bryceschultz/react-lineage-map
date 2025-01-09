export interface BaseNode {
  id: string;
  name: string;
}

export interface TableNode extends BaseNode {
  type: 'table';
  tableId?: string;
}

export interface FieldNode extends BaseNode {
  type: 'field';
  tableId: string;
  transformation: string;
}

export type Node = TableNode | FieldNode;

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
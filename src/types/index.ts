// types users can supply as props
export interface FieldNodeProp extends BaseNode {
  type: 'field';
  tableId?: string;
  transformation?: string;
  note?: string;
}

export type NodeProp = TableNode | FieldNodeProp;

export interface EdgeProp {
  id?: string;
  source: string;
  target: string;
}

export interface GraphProp {
  nodes: NodeProp[];
  edges: EdgeProp[];
}


// types used for internal purposes
export interface BaseNode {
  id: string;
  name: string;
}

export interface TableNode extends BaseNode {
  type: 'table';
  joinedBy?: string[];
}

export interface FieldNode extends BaseNode {
  type: 'field';
  tableId: string;
  transformation?: string;
  note?: string;
}

export type Node = TableNode | FieldNode;

export interface Edge {
  id: string;
  source: string;
  target: string;
  type?: 'field-field' | 'table-table';
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
  popUpWidth?: number;
  maxCurveOffset?: number;
}

export interface LineageMapProps {
  data: GraphProp;
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
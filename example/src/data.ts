import { Graph } from "../../src";

export const graph: Graph = {
    nodes: [
      // Table A
      { id: 'tableA', type: 'table', name: 'Table A' },
      // Table A Fields
      { id: 'fieldA1', type: 'field', name: 'Field A1', tableId: 'tableA' },
      { id: 'fieldA2', type: 'field', name: 'Field A2', tableId: 'tableA' },
      { id: 'fieldA7', type: 'field', name: 'Field A7', tableId: 'tableA' },
      { id: 'fieldA9', type: 'field', name: 'Field A9', tableId: 'tableA' },
  
      // Table B
      { id: 'tableB', type: 'table', name: 'Table B' },
      { id: 'fieldB1', type: 'field', name: 'Field B1', tableId: 'tableB' },
  
      // Table C
      { id: 'tableC', type: 'table', name: 'Table C' },
      { id: 'fieldC1', type: 'field', name: 'Field C1', tableId: 'tableC' },
  
      // Table D
      { id: 'tableD', type: 'table', name: 'Table D' },
      { id: 'fieldD1', type: 'field', name: 'Field D1', tableId: 'tableD', transformation: 'fieldA7 + fieldC1' },
      { id: 'fieldD3', type: 'field', name: 'Field D3', tableId: 'tableD', transformation: 'fieldA7 + fieldA9' }
    ],
    edges: [
      { id: 'edge1', source: 'fieldA1', target: 'fieldD1', type: 'field-field' },
      { id: 'edge2', source: 'fieldB1', target: 'fieldD1', type: 'field-field' },
      { id: 'edge3', source: 'fieldC1', target: 'fieldD1', type: 'field-field' },
      { id: 'edge6', source: 'fieldA7', target: 'fieldD1', type: 'field-field' },
      { id: 'edge8', source: 'fieldA7', target: 'fieldD3', type: 'field-field' },
      { id: 'edge9', source: 'fieldA9', target: 'fieldD3', type: 'field-field' }
    ]
  };
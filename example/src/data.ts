import { GraphProp } from "../../src/types";

export const graph: GraphProp = {
  nodes: [
    // Table A
    { id: 'table_A', type: 'table', name: 'Table A' },
    { id: 'table_A:field_A1', type: 'field', name: 'Field A1' },
    { id: 'table_A:field_A2', type: 'field', name: 'Field A2' },
    { id: 'table_A:field_A7', type: 'field', name: 'Field A7' },
    { id: 'table_A:field_A9', type: 'field', name: 'Field A9' },

    // Table B
    { id: 'table_B', type: 'table', name: 'Table B' },
    { id: 'table_B:field_B1', type: 'field', name: 'Field B1' },

    // Table C
    { id: 'table_C', type: 'table', name: 'Table C' },
    { id: 'table_C:field_C1', type: 'field', name: 'Field C1' },

    // Table D
    { id: 'table_D', type: 'table', name: 'Table D' },
    { id: 'table_D:field_D1', type: 'field', name: 'Field D1', transformation: 'table_A:field_A7 + table_C:field_C1' },
    { id: 'table_D:field_D3', type: 'field', name: 'Field D3', transformation: 'table_A:field_A7 - table_A:field_A9' },
    { id: 'table_D:field_D4', type: 'field', name: 'Field D4', note: 'autogenerated by specific process' }
  ],
  edges: [
    { source: 'table_A:field_A1', target: 'table_D:field_D1' },
    { source: 'table_B:field_B1', target: 'table_D:field_D1' },
    { source: 'table_C:field_C1', target: 'table_D:field_D1' },
    { source: 'table_A:field_A7', target: 'table_D:field_D1' },
    { source: 'table_A:field_A7', target: 'table_D:field_D3' },
    { source: 'table_A:field_A9', target: 'table_D:field_D3' }
  ]
}
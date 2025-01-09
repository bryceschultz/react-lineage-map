# lineage-mapper

Build out field level lineage mappings/visualizations

## Getting Started
installation
```
npm install react-lineage-map
```

adding a lineage component
```
const graph: Graph = {
    nodes: [
      // Table A
      { id: 'tableA', type: 'table', name: 'Table A' },
      // Table A Fields
      { id: 'fieldA1', type: 'field', name: 'Field A1', tableId: 'tableA' },
  
      // Table B
      { id: 'tableB', type: 'table', name: 'Table B' },
      { id: 'fieldB1', type: 'field', name: 'Field B1', tableId: 'tableB' },
  
      // Table C
      { id: 'tableC', type: 'table', name: 'Table C' },
      { id: 'fieldC1', type: 'field', name: 'Field C1', tableId: 'tableC' },
      
      // Table D
      { id: 'tableD', type: 'table', name: 'Table D' },
      { id: 'fieldD1', type: 'field', name: 'Field D1', tableId: 'tableD', transformation: 'fieldA7 + fieldC1' },
    ],
    edges: [
      { id: 'edge1', source: 'fieldA1', target: 'fieldD1', type: 'field-field' },
      { id: 'edge2', source: 'fieldB1', target: 'fieldD1', type: 'field-field' },
      { id: 'edge3', source: 'fieldC1', target: 'fieldD1', type: 'field-field' },
    ]
  };

const App = () => {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Lineage Map Example</h1>
      <div style={{ height: '800px' }}>
        <LineageMapComponent
          data={graph}
          height="100%"
          options={{
            tableWidth: 150,
            tableHeight: 40,
            fieldHeight: 20,
            fieldSpacing: 4,
            levelPadding: 100,
            verticalPadding: 50
          }}
        />
      </div>
    </div>
  );
}
```
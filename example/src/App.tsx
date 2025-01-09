import React from 'react';
import { LineageMapComponent } from '../../src';
import { graph } from './data';

export default function App() {
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
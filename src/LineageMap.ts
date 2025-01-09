import * as d3 from 'd3';
import { LineageMapOptions, Position, Graph, Node, Edge, TableLevel, FieldNode } from "./types/index"

export class LineageMap {
    private container: HTMLElement;
    private options: Required<LineageMapOptions>;
    private expandedTables: Set<string> = new Set();
    private highlightedFields: Set<string> = new Set();
    private showTableRelationships: boolean = false;
    private selectedField: string | null = null;
    private positions: Map<string, Position> = new Map();
    private validationErrors: Map<string, string[]> = new Map();
    private svg!: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    private mainGroup!: d3.Selection<SVGGElement, unknown, null, undefined>;
    private zoom!: d3.ZoomBehavior<SVGSVGElement, unknown>;
    private currentGraph: Graph | null = null;

    constructor(container: HTMLElement, options: LineageMapOptions = {}) {
        this.container = container;
        this.options = {
            width: options.width || '100%',
            height: options.height || '100%',
            tableWidth: options.tableWidth || 150,
            tableHeight: options.tableHeight || 40,
            fieldHeight: options.fieldHeight || 20,
            fieldSpacing: options.fieldSpacing || 4,
            levelPadding: options.levelPadding || 100,
            verticalPadding: options.verticalPadding || 50
        };

        this.init();
    }

    private init(): void {
        // Create SVG container
        this.svg = d3.select(this.container)
            .append('svg')
            .style('width', this.options.width)
            .style('height', this.options.height) as d3.Selection<SVGSVGElement, unknown, null, undefined>;

        this.mainGroup = this.svg.append('g') as d3.Selection<SVGGElement, unknown, null, undefined>;

        // Setup zoom behavior with correct types
        this.zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.1, 22])
            .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
                this.mainGroup.attr('transform', event.transform.toString());
            });

        this.svg.call(this.zoom as any)
            .on('dblclick.zoom', null);
    }

    public validateTransformations(graph: Graph): Map<string, string[]> {
        this.validationErrors.clear();

        // Build an index of incoming edges for each field
        const incomingEdges = new Map<string, Set<string>>();
        graph.edges.forEach(edge => {
            if (!incomingEdges.has(edge.target)) {
                incomingEdges.set(edge.target, new Set());
            }
            incomingEdges.get(edge.target)?.add(edge.source);
        });

        // Regular expression to find field references
        const fieldRefRegex = /field[A-Za-z]\d+/g;

        // Validate each node's transformation
        graph.nodes.forEach(node => {
            if (node.type === 'field' && node.transformation) {
                const errors: string[] = [];
                const referencedFields = (node.transformation.match(fieldRefRegex) || []) as string[];

                // Check each referenced field
                referencedFields.forEach(fieldRef => {
                    const incomingFields = incomingEdges.get(node.id) || new Set();

                    if (!incomingFields.has(fieldRef)) {
                        errors.push(`Field "${fieldRef}" is used in transformation but has no edge connecting to "${node.id}"`);
                    }
                });

                // Check if there are edges that aren't used in the transformation
                const incomingFields = incomingEdges.get(node.id) || new Set<string>();
                incomingFields.forEach(sourceField => {
                    if (!referencedFields.includes(sourceField)) {
                        errors.push(`Field "${sourceField}" has an edge but isn't used in the transformation`);
                    }
                });

                if (errors.length > 0) {
                    this.validationErrors.set(node.id, errors);
                }
            }
        });

        return this.validationErrors;
    }

    private renderTable(node: d3.Selection<SVGGElement, Node, null, undefined>, data: Node): void {
        const { tableWidth, tableHeight } = this.options;

        // Add table background
        node.append('rect')
            .attr('width', tableWidth)
            .attr('height', tableHeight)
            .attr('fill', '#ffffff')
            .attr('stroke', '#cccccc')
            .attr('rx', 4);

        // Add table header
        node.append('rect')
            .attr('class', 'table-header')
            .attr('width', tableWidth)
            .attr('height', tableHeight)
            .attr('fill', '#f5f5f5')
            .attr('stroke', '#cccccc')
            .attr('rx', 4);

        // Add table name
        node.append('text')
            .attr('x', 10)
            .attr('y', tableHeight / 2)
            .attr('dy', '0.35em')
            .attr('fill', '#333333')
            .style('font-family', 'sans-serif')
            .style('font-size', '12px')
            .text(data.name);

        // Add expansion indicator
        const isExpanded = this.expandedTables.has(data.id);
        node.append('text')
            .attr('x', tableWidth - 20)
            .attr('y', tableHeight / 2)
            .attr('dy', '0.35em')
            .attr('fill', '#666666')
            .style('font-family', 'sans-serif')
            .style('font-size', '12px')
            .text(isExpanded ? '−' : '+');
    }
    
    private renderField(node: d3.Selection<SVGGElement, Node, null, undefined>, data: Node): void {
        const { tableWidth, fieldHeight } = this.options;

        // Create a group for the field
        const fieldGroup = node.append('g')
            .attr('class', 'field-group');

        // Add field background
        const background = fieldGroup.append('rect')
            .attr('class', 'field-row')
            .attr('width', tableWidth)
            .attr('height', fieldHeight)
            .attr('fill', this.highlightedFields.has(data.id) ? '#e3f2fd' : '#ffffff')
            .attr('stroke', '#eeeeee')
            .style('cursor', 'pointer');

        // If there are validation errors, add a warning indicator
        if (this.validationErrors.has(data.id)) {
            background.attr('stroke', '#ff9800')
                .attr('stroke-width', '2');

            fieldGroup.append('text')
                .attr('class', 'warning-indicator')
                .attr('x', tableWidth - 40)
                .attr('y', fieldHeight / 2)
                .attr('dy', '0.35em')
                .attr('fill', '#ff9800')
                .style('font-family', 'sans-serif')
                .style('font-size', '11px')
                .style('pointer-events', 'none')
                .text('⚠');
        }

        // Add field name
        fieldGroup.append('text')
            .attr('class', 'field-text')
            .attr('x', 10)
            .attr('y', fieldHeight / 2)
            .attr('dy', '0.35em')
            .attr('fill', '#666666')
            .style('font-family', 'sans-serif')
            .style('font-size', '11px')
            .style('pointer-events', 'none')
            .text(data.name);

        // If there's a transformation, add an indicator
        if (data.type === "field" && data.transformation) {
            fieldGroup.append('text')
                .attr('class', 'transform-indicator')
                .attr('x', tableWidth - 20)
                .attr('y', fieldHeight / 2)
                .attr('dy', '0.35em')
                .attr('fill', this.validationErrors.has(data.id) ? '#ff9800' : '#666666')
                .style('font-family', 'sans-serif')
                .style('font-size', '11px')
                .style('pointer-events', 'none')
                .text('ƒ');
        }
    }

    handleFieldClick(graph: Graph, fieldId: string) {
        const field = graph.nodes.find(n => n.id === fieldId);
        if (!(field && 'tableId' in field)) return;
    
        // Narrowing `field` to a specific type
        const fieldNode = field as FieldNode;
    
        if (this.selectedField === fieldId) {
            // Deselect if clicking the same field
            this.selectedField = null;
            this.hideTransformationPopup();
        } else {
            this.selectedField = fieldId;
            this.showTransformationPopup(fieldNode, graph);
        }
    }    

    wrapText(
        text: string,
        maxWidth: number,
        textElement: d3.Selection<SVGTextElement, unknown, null, undefined>,
        isErrorText = false
    ) {
        const words = text.split(/\s+/);
        let line: string[] = [];
        let lines: { text: string; isError: boolean }[] = [];
        const startingBullet = text.startsWith('• ') ? '• ' : '';

        // If there's a bullet point, handle the rest of the text
        if (startingBullet) {
            words[0] = words[0].substring(2);
        }

        const testText = textElement.append('tspan');

        words.forEach(word => {
            line.push(word);
            const testLine = (line.length === 1 && startingBullet)
                ? startingBullet + line.join(' ')
                : line.join(' ');

            testText.text(testLine);
            if (testText.node()?.getComputedTextLength()! > maxWidth) {
                if (line.length > 1) {
                    line.pop();
                    const completedLine = (lines.length === 0 && startingBullet)
                        ? startingBullet + line.join(' ')
                        : line.join(' ');
                    lines.push({
                        text: completedLine,
                        isError: isErrorText
                    });
                    line = [word];
                } else {
                    const completedLine = (lines.length === 0 && startingBullet)
                        ? startingBullet + word
                        : word;
                    lines.push({
                        text: completedLine,
                        isError: isErrorText
                    });
                    line = [];
                }
            }
        });

        if (line.length > 0) {
            const completedLine = (lines.length === 0 && startingBullet)
                ? startingBullet + line.join(' ')
                : line.join(' ');
            lines.push({
                text: completedLine,
                isError: isErrorText
            });
        }

        testText.remove();
        return lines;
    }

    showTransformationPopup(field: FieldNode, graph: Graph) {
        this.hideTransformationPopup();

        if (!field.transformation) return;

        const pos = this.getFieldPosition(field.id);
        if (!pos) return;

        // Create popup container
        const popup = this.mainGroup.append('g')
            .attr('class', 'transformation-popup');

        const padding = 10;
        const maxWidth = 400;
        const minWidth = 200;
        const lineHeight = 20;
        const textWidth = maxWidth - (padding * 2); // Available width for text

        // Replace field IDs with field names in the transformation text
        let transformationText = field.transformation;
        const fieldRefRegex = /field[A-Za-z]\d+/g;
        const fieldRefs = field.transformation.match(fieldRefRegex) || [];

        fieldRefs.forEach(fieldId => {
            const referencedField = graph.nodes.find(n => n.id === fieldId);
            if (referencedField) {
                transformationText = transformationText.replace(
                    fieldId,
                    referencedField.name
                );
            }
        });

        // Create temporary text element for measurements
        const tempText = popup.append('text')
            .style('font-family', 'sans-serif')
            .style('font-size', '12px');

        // Process transformation text
        const transformationLines = this.wrapText(
            `Transformation: ${transformationText}`,
            textWidth,
            tempText,
            false
        );

        // Process error messages if they exist
        let errorLines = [];
        const errors = this.validationErrors.get(field.id);
        if (errors && errors.length > 0) {
            errorLines.push({
                text: 'Validation Errors:',
                isError: true
            });

            errors.forEach(error => {
                // Replace field IDs with names in error messages
                let formattedError = error;
                fieldRefs.forEach(fieldId => {
                    const referencedField = graph.nodes.find(n => n.id === fieldId);
                    if (referencedField) {
                        formattedError = formattedError.replace(
                            new RegExp(fieldId, 'g'),
                            referencedField.name
                        );
                    }
                });

                // Wrap each error message and mark all lines as error text
                const wrappedError = this.wrapText(
                    `• ${formattedError}`,
                    textWidth,
                    tempText,
                    true
                );
                errorLines.push(...wrappedError);
            });
        }

        tempText.remove();

        // Calculate total height needed
        const totalLines = [
            ...transformationLines,
            { text: '', isError: false },
            ...errorLines
        ];
        const boxHeight = (lineHeight * totalLines.length) + padding * 2;
        const boxWidth = maxWidth;

        // Position popup
        const svgNode = this.svg.node();
        if (!svgNode) {
            throw new Error("SVG node is not available.");
        }
        
        const popupX = pos.x + this.options.tableWidth + 10;
        const popupY = Math.max(
            padding,
            Math.min(
                pos.y - boxHeight / 2,
                svgNode.getBoundingClientRect().height - boxHeight - padding
            )
        );

        // Add semi-transparent overlay
        popup.append('rect')
            .attr('class', 'popup-overlay')
            .attr('x', popupX)
            .attr('y', popupY)
            .attr('width', boxWidth)
            .attr('height', boxHeight)
            .attr('fill', 'rgba(255, 255, 255, 0.95)')
            .attr('stroke', errors ? '#ff9800' : '#dee2e6')
            .attr('rx', 4)
            .attr('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))');

        // Add text with line breaks
        const textElement = popup.append('text')
            .attr('x', popupX + padding)
            .attr('y', popupY + padding + 12)
            .style('font-family', 'sans-serif')
            .style('font-size', '12px');

        totalLines.forEach((line, i) => {
            const tspan = textElement.append('tspan')
                .attr('x', popupX + padding)
                .attr('dy', i === 0 ? 0 : lineHeight)
                .text(line.text);

            // Style all error text consistently
            if (line.isError) {
                tspan.style('fill', '#ff9800');
            }
        });

        // Add close button
        const closeButton = popup.append('g')
            .attr('class', 'close-button')
            .attr('transform', `translate(${popupX + boxWidth - 16}, ${popupY + 16})`)
            .style('cursor', 'pointer');

        closeButton.append('circle')
            .attr('r', 8)
            .attr('fill', '#f8f9fa')
            .attr('stroke', '#dee2e6');

        closeButton.append('text')
            .attr('x', 0)
            .attr('y', 0)
            .attr('dy', '0.35em')
            .attr('text-anchor', 'middle')
            .style('font-family', 'sans-serif')
            .style('font-size', '12px')
            .style('fill', '#666')
            .text('×');

        closeButton.on('click', () => {
            this.selectedField = null;
            this.hideTransformationPopup();
        });
    }

    hideTransformationPopup() {
        this.mainGroup.selectAll('.transformation-popup').remove();
    }

    getFieldPosition(fieldId: string) {
        const pos = this.positions.get(fieldId);
        if (!pos) return null;

        return {
            x: pos.x,
            y: pos.y + (this.options.fieldHeight / 2) // Center vertically in field
        };
    }

    inferTableRelationships(graph: Graph) {
        const tableRelations = new Set();
        const inferredEdges: Edge[] = [];

        graph.edges.forEach(edge => {
            const sourceField = graph.nodes.find(n => n.id === edge.source);
            const targetField = graph.nodes.find(n => n.id === edge.target);

            if (sourceField?.tableId && targetField?.tableId && sourceField.tableId !== targetField.tableId) {
                const relationKey = `${sourceField.tableId}->${targetField.tableId}`;
                if (!tableRelations.has(relationKey)) {
                    tableRelations.add(relationKey);
                    inferredEdges.push({
                        id: `table-${relationKey}`,
                        source: sourceField.tableId,
                        target: targetField.tableId,
                        type: 'table-table'
                    });
                }
            }
        });

        return inferredEdges;
    }

    getTableLevels(graph: Graph): TableLevel[] {
        const tableDependencies = new Map<string, Set<string>>();
        const tableNodes = graph.nodes.filter(node => node.type === 'table');
    
        tableNodes.forEach(table => {
            tableDependencies.set(table.id, new Set());
        });
    
        const inferredEdges = this.inferTableRelationships(graph);
        inferredEdges.forEach(edge => {
            const dependencySet = tableDependencies.get(edge.target);
            if (dependencySet) {
                dependencySet.add(edge.source);
            }
        });
    
        const levels: TableLevel[] = [];
        const processed = new Set<string>();
        let currentLevel = 0;
    
        while (processed.size < tableNodes.length) {
            const currentLevelTables = Array.from(tableDependencies.entries())
                .filter(([tableId, deps]) =>
                    !processed.has(tableId) &&
                    Array.from(deps).every(dep => processed.has(dep))
                );
    
            if (currentLevelTables.length === 0 && processed.size < tableNodes.length) {
                tableNodes
                    .filter(table => !processed.has(table.id))
                    .forEach(table => {
                        levels.push({
                            id: table.id,
                            level: currentLevel,
                            dependencies: Array.from(tableDependencies.get(table.id) || [])
                        });
                        processed.add(table.id);
                    });
            } else {
                currentLevelTables.forEach(([tableId, deps]) => {
                    levels.push({
                        id: tableId,
                        level: currentLevel,
                        dependencies: Array.from(deps)
                    });
                    processed.add(tableId);
                });
            }
            currentLevel++;
        }
    
        return levels;
    }
    
    getRelatedFields(graph: Graph, fieldId: string) {
        const related = new Set([fieldId]); // Only store fields that feed into the current field
        const visited = new Set();

        const traverse = (id: string) => {
            if (visited.has(id)) return;
            visited.add(id);

            graph.edges.forEach(edge => {
                if (edge.target === id) { // Only follow edges feeding into the current field
                    related.add(edge.source);
                    traverse(edge.source);
                }
            });
        };

        traverse(fieldId);
        return related;
    }

    toggleTableExpansion(tableId: string) {
        if (this.expandedTables.has(tableId)) {
            this.expandedTables.delete(tableId);
        } else {
            this.expandedTables.add(tableId);
        }
        if (this.currentGraph) {
            this.render(this.currentGraph);
        }
    }

    handleFieldHover(graph: Graph, fieldId: string | null) {
        if (fieldId) {
            this.highlightedFields = this.getRelatedFields(graph, fieldId);
        } else {
            this.highlightedFields.clear();
        }
        this.renderHighlights();
    }

    renderHighlights(): void {
        // Update field backgrounds
        this.mainGroup.selectAll<SVGElement, Node>('.field-row')
            .style('fill', d => 
                this.highlightedFields.has(d.id) ? '#e3f2fd' : '#ffffff'
            );
        
        // Update edges
        this.mainGroup.selectAll<SVGElement, Edge>('.edge')
            .attr('stroke', (d, i, nodes) => {
                // Cast the node to SVGElement to ensure getAttribute is available
                const element = nodes[i] as SVGElement;
                const source = element.getAttribute('data-source');
                const target = element.getAttribute('data-target');
                if (source && target) {
                    const isHighlighted = this.highlightedFields.has(source) && 
                                        this.highlightedFields.has(target);
                    return isHighlighted ? '#2196f3' : '#bbbbbb';
                }
                return '#bbbbbb';
            })
            .attr('stroke-width', (d, i, nodes) => {
                // Cast the node to SVGElement to ensure getAttribute is available
                const element = nodes[i] as SVGElement;
                const source = element.getAttribute('data-source');
                const target = element.getAttribute('data-target');
                if (source && target) {
                    const isHighlighted = this.highlightedFields.has(source) && 
                                        this.highlightedFields.has(target);
                    return isHighlighted ? 2 : 1;
                }
                return 1;
            });
    }
    
    renderBase(graph: Graph) {
        this.currentGraph = graph;

        // Auto-expand tables that have connections
        const connectedTables = new Set();
        graph.edges.forEach(edge => {
            const sourceNode = graph.nodes.find(n => n.id === edge.source);
            const targetNode = graph.nodes.find(n => n.id === edge.target);
            if (sourceNode && targetNode) {
                connectedTables.add(sourceNode.tableId);
                connectedTables.add(targetNode.tableId);
            }
        });
        connectedTables.forEach((tableId: unknown) => {
            if (typeof tableId === 'string') {
                this.expandedTables.add(tableId);
            }
        });

        const tableLevels = this.getTableLevels(graph);
        const positions = this.calculatePositions(graph, tableLevels);
        this.mainGroup.selectAll('*').remove();
        this.renderNodes(graph, positions);
        this.setupEventListeners();
    }

    render(graph: Graph) {
        // Validate transformations before rendering
        this.validateTransformations(graph);

        // Continue with normal render
        this.currentGraph = graph;
        const tableLevels = this.getTableLevels(graph);
        const positions = this.calculatePositions(graph, tableLevels);
        this.mainGroup.selectAll('*').remove();
        this.renderEdges(graph, positions);
        this.renderNodes(graph, positions);
        this.setupEventListeners();
    }

    calculatePositions(graph: Graph, tableLevels: TableLevel[]) {
        const positions = new Map();
        const {
            tableWidth,
            tableHeight,
            fieldHeight,
            fieldSpacing,
            levelPadding,
            verticalPadding
        } = this.options;

        // Group tables by level
        const tablesByLevel = new Map();
        tableLevels.forEach((tableLevel: TableLevel) => {
            if (!tablesByLevel.has(tableLevel.level)) {
                tablesByLevel.set(tableLevel.level, []);
            }
            tablesByLevel.get(tableLevel.level).push(tableLevel.id);
        });

        // Calculate table heights (including expanded fields)
        const getTableHeight = (tableId: string) => {
            if (!this.expandedTables.has(tableId)) {
                return tableHeight;
            }
            const fieldCount = graph.nodes.filter(n => n.tableId === tableId).length;
            return tableHeight + (fieldCount * (fieldHeight + fieldSpacing));
        };

        // Calculate total height needed for each level
        const levelHeights = new Map();
        tablesByLevel.forEach((tablesInLevel, level) => {
            const totalHeight = tablesInLevel.reduce((acc: number, tableId: string) => {
                return acc + getTableHeight(tableId) + verticalPadding;
            }, 0);
            levelHeights.set(level, totalHeight);
        });

        // Find maximum level height for vertical centering
        const maxLevelHeight = Math.max(...Array.from(levelHeights.values()));

        // Position tables and their fields
        tablesByLevel.forEach((tablesInLevel, level) => {
            const levelX = level * (tableWidth + levelPadding);
            const levelHeight = levelHeights.get(level) || 0;
            let currentY = (maxLevelHeight - levelHeight) / 2;

            tablesInLevel.forEach((tableId: string) => {
                const tableNode = graph.nodes.find(n => n.id === tableId);
                if (!tableNode) return;

                // Position table
                positions.set(tableId, {
                    x: levelX,
                    y: currentY + verticalPadding
                });

                // Position fields if table is expanded
                if (this.expandedTables.has(tableId)) {
                    const fields = graph.nodes.filter(n => n.tableId === tableId);
                    fields.forEach((field, index) => {
                        positions.set(field.id, {
                            x: levelX,
                            y: currentY + verticalPadding + tableHeight + (index * (fieldHeight + fieldSpacing))
                        });
                    });
                }

                // Update Y position for next table
                currentY += getTableHeight(tableId) + verticalPadding;
            });
        });

        // Add positions for any remaining nodes (if any)
        graph.nodes.forEach(node => {
            if (!positions.has(node.id)) {
                // Set default position for any nodes not yet positioned
                positions.set(node.id, { x: 0, y: 0 });
            }
        });

        this.positions = positions;
        return positions;
    }

    renderEdges(graph: Graph, positions: Map<string, Position>) {
        const edges = this.showTableRelationships ?
            [...this.inferTableRelationships(graph), ...graph.edges] :
            graph.edges;
    
        // Group edges by source and target tables
        const edgesByTables = new Map<string, Edge[]>();
        edges.forEach(edge => {
            if (edge.type === 'table-table') return;
        
            const sourceNode = graph.nodes.find(n => n.id === edge.source);
            const targetNode = graph.nodes.find(n => n.id === edge.target);
            if (!sourceNode?.tableId || !targetNode?.tableId) return;
        
            if (!this.expandedTables.has(sourceNode.tableId) || 
                !this.expandedTables.has(targetNode.tableId)) return;
    
            const tableKey = `${sourceNode.tableId}-${targetNode.tableId}`;
            if (!edgesByTables.has(tableKey)) {
                edgesByTables.set(tableKey, []);
            }
            const tableEdges = edgesByTables.get(tableKey);
            if (tableEdges) {
                tableEdges.push(edge);
            }
        });
    
        // Calculate control points for each table pair
        edgesByTables.forEach((tableEdges, tableKey) => {
            const tablePair = tableKey.split('-');
            if (tablePair.length !== 2) return;
            
            const [sourceTableId, targetTableId] = tablePair;
            const sourceTablePos = positions.get(sourceTableId);
            const targetTablePos = positions.get(targetTableId);
    
            if (!sourceTableId || !targetTableId || !sourceTablePos || !targetTablePos) return;
    
            // Calculate horizontal distance between tables
            const horizontalDistance = targetTablePos.x - sourceTablePos.x;
            
            // Draw edges
            tableEdges.forEach((edge: Edge) => {
                // Since Edge interface guarantees source and target are strings, we can safely use them
                const sourcePos = positions.get(edge.source);
                const targetPos = positions.get(edge.target);
    
                if (!sourcePos || !targetPos) return;
    
                // Create the path element with guaranteed non-null source and target
                const path = this.mainGroup.append('path')
                    .attr('class', 'edge')
                    .attr('data-source', edge.source as string) // Type assertion since we know it's defined
                    .attr('data-target', edge.target as string) // Type assertion since we know it's defined
                    .attr('d', () => {
                        const start = [sourcePos.x + this.options.tableWidth, sourcePos.y + this.options.fieldHeight / 2];
                        const end = [targetPos.x, targetPos.y + this.options.fieldHeight / 2];
                        
                        // Use fixed control point distances based on horizontal distance
                        const curveOffset = horizontalDistance / 3;
                        const ctrl1 = [start[0] + curveOffset, start[1]];
                        const ctrl2 = [end[0] - curveOffset, end[1]];
    
                        return `M ${start[0]},${start[1]} 
                                C ${ctrl1[0]},${ctrl1[1]} 
                                  ${ctrl2[0]},${ctrl2[1]} 
                                  ${end[0]},${end[1]}`;
                    })
                    .attr('stroke', '#bbbbbb')
                    .attr('stroke-width', 1)
                    .attr('fill', 'none');
            });
        });
    }

    renderNodes(graph: Graph, positions: Map<string, Position>) {
        // Create node groups
        const nodes = this.mainGroup
            .selectAll<SVGGElement, Node>('.node')
            .data(graph.nodes)
            .join('g')
            .attr('class', 'node')
            .attr('cursor', 'pointer')
            .attr('transform', (d: Node) => {
                const pos = positions.get(d.id);
                return pos ? `translate(${pos.x},${pos.y})` : '';
            });
    
        // Render tables
        nodes.filter((d: Node) => d.type === 'table')
            .each((d: Node, i: number, nodes: SVGGElement[] | ArrayLike<SVGGElement>) => {
                const node = d3.select<SVGGElement, Node>(nodes[i]);
                this.renderTable(node, d);
            });
    
        // Render fields for expanded tables
        nodes.filter((d: Node) => d.type === 'field' && this.expandedTables.has(d.tableId))
            .each((d: Node, i: number, nodes: SVGGElement[] | ArrayLike<SVGGElement>) => {
                const node = d3.select<SVGGElement, Node>(nodes[i]);
                this.renderField(node, d);
            });
    }
    

    setupEventListeners(): void {
        this.mainGroup.selectAll('.table-header')
            .on('click', (event: any, d: unknown) => this.toggleTableExpansion((d as Node).id));
    
        this.mainGroup.selectAll('.field-group')
            .attr('data-field-id', (d: unknown) => (d as Node).id)
            .on('mouseenter', (event: any, d: unknown) => {
                if (this.currentGraph) {
                    this.handleFieldHover(this.currentGraph, (d as Node).id);
                }
            })
            .on('mouseleave', () => {
                if (this.currentGraph) {
                    this.handleFieldHover(this.currentGraph, null);
                }
            })
            .on('click', (event: any, d: unknown) => {
                if (this.currentGraph) {
                    this.handleFieldClick(this.currentGraph, (d as Node).id);
                }
            });
    
        // Close transformation popup when clicking outside
        this.svg.on('click', (event: any) => {
            if ((event.target as HTMLElement).closest('.field-group')) return;
            this.selectedField = null;
            this.hideTransformationPopup();
        });
    }

    destroy() {
        // Remove D3 events and clean up
        if (this.svg) {
          this.svg.selectAll('*').remove();
          this.svg.remove();
        }
        // Clear any stored state
        this.expandedTables.clear();
        this.highlightedFields.clear();
        this.positions.clear();
        this.validationErrors.clear();
        this.currentGraph = null;
      }
}
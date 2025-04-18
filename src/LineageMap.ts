import * as d3 from 'd3';
import { LineageMapOptions, Position, Graph, Node, Edge, TableLevel, FieldNode, TableNode, PopupLine } from "./types/index"

export class LineageMap {
    private container: HTMLElement;
    private options: Required<LineageMapOptions>;
    private expandedTables: Set<string> = new Set();
    private highlightedRelatedFields: Set<string> = new Set();
    private showTableRelationships: boolean = false;
    private selectedField: string | null = null;
    private positions: Map<string, Position> = new Map();
    private validationErrors: Map<string, string[]> = new Map();
    private svg!: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    private mainGroup!: d3.Selection<SVGGElement, unknown, null, undefined>;
    private zoom!: d3.ZoomBehavior<SVGSVGElement, unknown>;
    private currentGraph: Graph | null = null;
    private static readonly SQL_START_TAG = '---startsql';
    private static readonly SQL_END_TAG = '---endsql';

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
            verticalPadding: options.verticalPadding || 50,
            popUpWidth: options.popUpWidth || 300,
            popUpFloat: options.popUpFloat || "high",
            maxCurveOffset: options.maxCurveOffset || 100
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
        const fieldRefRegex = /[a-zA-Z_]+:[a-zA-Z_]+\d*/g;

        // Validate each node's transformation
        graph.nodes.forEach(node => {
            if (node.type === 'field' && node.transformation) {
                const errors: string[] = [];

                // Extract referenced fields from transformation
                const referencedFields = (node.transformation.match(fieldRefRegex) || []) as string[];

                // Ensure uniqueness of referenced fields
                const referencedFieldSet = new Set(referencedFields);

                // Check each referenced field
                const incomingFields = incomingEdges.get(node.id) || new Set();
                referencedFieldSet.forEach(fieldRef => {
                    if (!incomingFields.has(fieldRef)) {
                        errors.push(`Field "${fieldRef}" is used in transformation but has no edge connecting to "${node.id}".`);
                    }
                });

                // Check if there are edges that aren't used in the transformation
                incomingFields.forEach(sourceField => {
                    if (!referencedFieldSet.has(sourceField)) {
                        errors.push(`Field "${sourceField}" has an edge but isn't used in the transformation.`);
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

        node.attr('data-table-id', data.id);

        // Add drop shadow filter
        const defs = node.append('defs');
        const dropShadowId = `dropShadow-${data.id}`;
        defs.append('filter')
            .attr('id', dropShadowId)
            .append('feDropShadow')
            .attr('dx', '0')
            .attr('dy', '2')
            .attr('stdDeviation', '3')
            .attr('flood-opacity', '0.15');
    
        // Add table background
        node.append('rect')
            .attr('width', tableWidth)
            .attr('height', tableHeight)
            .attr('fill', '#ffffff')
            .attr('stroke', '#E2E8F0')
            .attr('stroke-width', '1')
            .attr('rx', 6)
            .style('filter', `url(#${dropShadowId})`);
    
        // Add table header with gradient
        const headerGradientId = `headerGradient-${data.id}`;
        const headerGradient = defs.append('linearGradient')
            .attr('id', headerGradientId)
            .attr('x1', '0%')
            .attr('y1', '0%')
            .attr('x2', '0%')
            .attr('y2', '100%');
        
        headerGradient.append('stop')
            .attr('offset', '0%')
            .attr('stop-color', '#F8FAFC');
        
        headerGradient.append('stop')
            .attr('offset', '100%')
            .attr('stop-color', '#F1F5F9');
    
        node.append('rect')
            .attr('class', 'table-header clickable-area')
            .attr('width', tableWidth)
            .attr('height', tableHeight)
            .attr('fill', `url(#${headerGradientId})`)
            .attr('stroke', '#E2E8F0')
            .attr('rx', 6)
            .attr('clip-path', `path('M0,0 h${tableWidth} v${tableHeight} h-${tableWidth} Z')`);
    
        // Add table name
        node.append('text')
            .attr('class', 'clickable-area')
            .attr('x', 16)
            .attr('y', tableHeight / 2)
            .attr('dy', '0.35em')
            .attr('fill', '#1E293B')
            .style('font-family', '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif')
            .style('font-size', '13px')
            .style('font-weight', '500')
            .text(data.name)
            .style('pointer-events', 'none');
    
        // Add info button only if there's a note
        if ('note' in data && data.note) {
            const infoButtonSize = 20;
            const infoButtonX = tableWidth - infoButtonSize - 12;
            const infoButtonY = (tableHeight - infoButtonSize) / 2;
    
            const infoButton = node.append('g')
                .attr('class', 'table-info-button')
                .attr('transform', `translate(${infoButtonX}, ${infoButtonY})`)
                .style('cursor', 'pointer');
    
            infoButton.append('rect')
                .attr('width', infoButtonSize)
                .attr('height', infoButtonSize)
                .attr('rx', 4)
                .attr('fill', '#F8FAFC')
                .attr('stroke', '#CBD5E1')
                .attr('stroke-width', '1');
    
            infoButton.append('text')
                .attr('x', infoButtonSize / 2)
                .attr('y', infoButtonSize / 2)
                .attr('text-anchor', 'middle')
                .attr('dy', '0.35em')
                .attr('fill', '#64748B')
                .style('font-family', '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif')
                .style('font-size', '12px')
                .style('font-weight', '500')
                .text('ⓘ')
                .style('pointer-events', 'none');
        }
    }

    private showTableInfoPopup(table: TableNode): void {
        this.hideTransformationPopup(); // Hide any existing popups

        const pos = this.positions.get(table.id);
        if (!pos) return;

        // Create popup container
        const popup = this.mainGroup.append('g')
            .attr('class', 'table-info-popup');

        const padding = 10;
        const maxWidth = this.options.popUpWidth;
        const lineHeight = 20;
        const codeLineHeight = 16;
        const textWidth = maxWidth - (padding * 2);

        // Create temporary text element for measurements
        const tempText = popup.append('text')
            .style('font-family', 'sans-serif')
            .style('font-size', '12px');


        // Add note if it exists
        const lines: PopupLine[] = this.generateNote(table, textWidth, tempText);

        tempText.remove();

        const { boxWidth, boxHeight, popupX, popupY } = this.calculatePopupPosition(table, lines, codeLineHeight, lineHeight, padding, maxWidth);

        // Add semi-transparent overlay
        popup.append('rect')
            .attr('class', 'popup-overlay')
            .attr('x', popupX)
            .attr('y', popupY)
            .attr('width', boxWidth)
            .attr('height', boxHeight)
            .attr('fill', 'rgba(255, 255, 255, 0.95)')
            .attr('stroke', '#dee2e6')
            .attr('rx', 4)
            .attr('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))');

        // Add text
        const textElement = popup.append('text')
            .attr('x', popupX + padding)
            .attr('y', popupY + padding + 12);
    
        this.formatPopupLines(lines, textElement, popupX, padding, codeLineHeight, lineHeight);
    }

    private generateNote(node: FieldNode | TableNode, textWidth: number, tempText: d3.Selection<SVGTextElement, unknown, null, undefined>): { text: string; isError: boolean; isCode?: boolean, extraSpace?: boolean }[] {
        const lines: PopupLine[] = [];
        
        // node in this context can be either a table or field
        if (node.note) {
            lines.push({ text: `Note for ${node.name}: `, isError: false });
            lines.push({ text: '', isError: false, extraSpace: true });

            const blocks = this.extractTextBlocks(node.note);
            blocks.forEach((block, index) => {
                if (index > 0) {
                    // Add spacing between blocks
                    lines.push({ text: '', isError: false });
                }
                if (block.type === 'sql') {
                    // Format SQL blocks using monospace font and blue color
                    lines.push(...this.formatSQLBlock(block.content));
                } else {
                    // Format regular text blocks
                    lines.push(...this.formatTextBlock(block.content, textWidth, tempText));
                }
            });
        }
        return lines;
    }

    private calculatePopupPosition(
        node: Node, 
        lines: PopupLine[], 
        codeLineHeight: number, 
        lineHeight: number, 
        padding: number, 
        maxWidth: number
    ): { boxWidth: number, boxHeight: number, popupX: number, popupY: number } {
        // Calculate box dimensions
        const totalHeight = lines.reduce((acc, line) => {
            if (line.isCode) {
                return acc + codeLineHeight;
            }
            return acc + (line.text ? lineHeight : lineHeight / 2);
        }, 0);
    
        const boxHeight = totalHeight + padding * 2;
        const boxWidth = Math.max(maxWidth,
            Math.max(...lines.filter(l => l.isCode).map(l => l.text.length * 7)) + padding * 2
        );
    
        // Find the corresponding group element and its bounding box
        const group = node.type === "field" 
            ? document.querySelector(`.field-group[data-field-id="${node.id}"]`) 
            : document.querySelector(`g[data-table-id="${node.id}"]`);
        if (!group) {
            console.warn(`Group with id="${node.id}" not found`);
            return { boxWidth, boxHeight, popupX: 0, popupY: 0 };
        }
        const bbox = group.getBoundingClientRect();
    
        // Get bounding box of the d3 canvas
        const svgNode = this.svg.node();
        if (!svgNode) {
            console.warn("SVG node is not available");
            return { boxWidth, boxHeight, popupX: 0, popupY: 0 };
        }
        const svgBbox = svgNode.getBoundingClientRect();
    
        // Get the current zoom/pan transformation
        const transform = d3.zoomTransform(this.mainGroup.node() as SVGGraphicsElement);
    
        // Convert screen coordinates to SVG space
        const popupX = transform.invertX(bbox.right - svgBbox.left) + 5;
        const popupY = this.options.popUpFloat === "high" ? 
            transform.invertY(bbox.top - svgBbox.top) - boxHeight + this.options.fieldHeight:
            transform.invertY(bbox.top - svgBbox.top);
    
        return { boxWidth, boxHeight, popupX, popupY };
    }

    private formatPopupLines(lines: PopupLine[], textElement: d3.Selection<SVGTextElement, unknown, null, undefined>, popupX: number, padding: number, codeLineHeight: number, lineHeight: number) {
        let currentY = 0;

        lines.forEach((line) => {
            if (line.extraSpace) {
                textElement.append('tspan')
                    .attr('x', popupX + padding)
                    .attr('dy', lineHeight) // Move down one line
                    .text('\u00A0') // Non-breaking space
                    .style('fill', 'white'); // Make it invisible
                currentY += lineHeight * 2;
                return;
            }
            
            const tspan = textElement.append('tspan')
                .attr('x', popupX + padding)
                .attr('dy', currentY === 0 ? 0 : (line.isCode ? codeLineHeight : lineHeight))
                .text(line.text);
    
            if (line.isCode) {
                tspan
                    .style('font-family', 'monospace')
                    .style('font-size', '11px')
                    .style('fill', '#2563eb'); // Blue color for code
            } else {
                tspan
                    .style('font-family', 'sans-serif')
                    .style('font-size', '12px')
                    .style('fill', line.isError ? '#ff9800' : '#1E293B');
            }
    
            currentY += line.isCode ? codeLineHeight : lineHeight;
        });
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
            .attr('fill', this.highlightedRelatedFields.has(data.id) ? '#e3f2fd' : '#ffffff')
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

        // Add transformation or note indicator
        const fieldData = data as FieldNode;
        if (fieldData.transformation || fieldData.note) {
            const icon = fieldData.transformation ? 'ƒ' : 'ⓘ';
            const color = this.validationErrors.has(data.id) ? '#ff9800' : '#666666';

            fieldGroup.append('text')
                .attr('class', fieldData.transformation ? 'transform-indicator' : 'note-indicator')
                .attr('x', tableWidth - 20)
                .attr('y', fieldHeight / 2)
                .attr('dy', '0.35em')
                .attr('fill', color)
                .style('font-family', 'sans-serif')
                .style('font-size', '11px')
                .style('pointer-events', 'none')
                .text(icon);
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
            this.highlightedRelatedFields = this.getRelatedFields(graph, fieldId);
            this.renderHighlights(fieldId);
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

    private extractTextBlocks(text: string): { type: 'sql' | 'text', content: string }[] {
        const blocks: { type: 'sql' | 'text', content: string }[] = [];
        
        // Convert to lowercase for case-insensitive matching but keep original for content
        const lowerText = text.toLowerCase();
        let currentPos = 0;
    
        while (true) {
            const startTag = lowerText.indexOf(LineageMap.SQL_START_TAG, currentPos);
            if (startTag === -1) {
                // Add remaining text if there's any
                const remaining = text.slice(currentPos).trim();
                if (remaining) {
                    blocks.push({ type: 'text', content: remaining });
                }
                break;
            }
    
            // Add text before SQL block if there's any
            const beforeSql = text.slice(currentPos, startTag).trim();
            if (beforeSql) {
                blocks.push({ type: 'text', content: beforeSql });
            }
    
            // Find the end of SQL block
            const sqlStart = startTag + LineageMap.SQL_START_TAG.length;
            const endTag = lowerText.indexOf(LineageMap.SQL_END_TAG, sqlStart);
            
            if (endTag === -1) {
                // If no end tag, treat rest as text
                const remaining = text.slice(currentPos).trim();
                if (remaining) {
                    blocks.push({ type: 'text', content: remaining });
                }
                break;
            }
    
            // Extract SQL content
            const sql = text.slice(sqlStart, endTag).trim();
            if (sql) {
                blocks.push({ type: 'sql', content: sql });
            }
    
            currentPos = endTag + LineageMap.SQL_END_TAG.length;
        }
    
        return blocks;
    }
    
    private formatTextBlock(text: string, maxWidth: number, tempText: d3.Selection<SVGTextElement, unknown, null, undefined>): PopupLine[] {
        // Split text by newline characters
        const paragraphs = text.split('\n');
        const result: PopupLine[] = [];
    
        for (let i = 0; i < paragraphs.length; i++) {
            // For non-empty paragraphs, wrap text to fit inside popup
            if (paragraphs[i].trim() !== '') {
                const wrappedLines = this.wrapText(paragraphs[i], maxWidth, tempText, false)
                    .map(line => ({ ...line, isCode: false }));
                result.push(...wrappedLines);
            } else {
                // For empty paragraphs (just \n with nothing else), still add an empty line
                result.push({ text: '', isError: false, isCode: false, extraSpace: true });
            }
            
            // Add an empty line between paragraphs (except after the last one)
            if (i < paragraphs.length - 1) {
                result.push({ text: '', isError: false, isCode: false });
            }
        }
        
        return result;
    }
    
    private formatSQLBlock(sql: string): PopupLine[] {
        return sql.split('\n')
            .reduce((acc: string[], line: string) => {
                const trimmedLine = line.trimRight();
                if (acc.length === 0 || !(trimmedLine === '' && acc[acc.length - 1] === '')) {
                    acc.push(trimmedLine);
                }
                return acc;
            }, [])
            .map(line => ({
                text: line,
                isError: false,
                isCode: true
            }));
    }
    
    private showTransformationPopup(field: FieldNode, graph: Graph) {
        this.hideTransformationPopup();
    
        if (!field.transformation && !field.note) return;
    
        const pos = this.getFieldPosition(field.id);
        if (!pos) return;
    
        // Create popup container
        const popup = this.mainGroup.append('g')
            .attr('class', 'transformation-popup');
    
        const padding = 16;
        const maxWidth = this.options.popUpWidth;
        const lineHeight = 20;
        const codeLineHeight = 16;
        const textWidth = maxWidth - (padding * 2);
    
        // Create temporary text element for measurements
        const tempText = popup.append('text')
            .style('font-family', 'monospace')
            .style('font-size', '12px');
    
        const lines: PopupLine[] = [];
    
        // Add transformation if it exists
        if (field.transformation) {
            lines.push({ text: 'Transformation:', isError: false });
            
            // Handle field references in transformation
            const fieldRefRegex = /[a-zA-Z_]+:[a-zA-Z_]+\d*/g;
            const fieldRefs = field.transformation.match(fieldRefRegex) || [];
            let formattedText = field.transformation;
    
            fieldRefs.forEach(fieldId => {
                const referencedField = graph.nodes.find(n => n.id === fieldId && n.type === 'field');
                if (referencedField) {
                    formattedText = formattedText.replace(
                        new RegExp(`\\b${fieldId}\\b`, 'g'),
                        referencedField.name
                    );
                }
            });
    
            lines.push({ text: formattedText, isError: false });
    
            // Add a blank line if both transformation and note exist
            if (field.note) {
                lines.push({ text: '', isError: false });
            }
        }
    
        // Add note if it exists
        lines.push(...this.generateNote(field, textWidth, tempText));
    
        // Add error messages if they exist
        const errors = this.validationErrors.get(field.id);
        if (errors && errors.length > 0) {
            lines.push({ text: '', isError: false });
            lines.push({ text: 'Validation Errors:', isError: true });
    
            errors.forEach(error => {
                const wrappedError = this.wrapText(
                    `• ${error}`,
                    textWidth,
                    tempText,
                    true
                );
                lines.push(...wrappedError.map(line => ({ ...line, isCode: false })));
            });
        }
    
        tempText.remove();
    
        const { boxWidth, boxHeight, popupX, popupY } = this.calculatePopupPosition(field, lines, codeLineHeight, lineHeight, padding, maxWidth);
    
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
    
        // Add text
        const textElement = popup.append('text')
            .attr('x', popupX + padding)
            .attr('y', popupY + padding + 12);
    
        this.formatPopupLines(lines, textElement, popupX, padding, codeLineHeight, lineHeight);
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
            const sourceField = graph.nodes.find(n => n.id === edge.source) as FieldNode;
            const targetField = graph.nodes.find(n => n.id === edge.target) as FieldNode;

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
        const upstreamTableDependencies = new Map<string, Set<string>>();
        const tableNodes = graph.nodes.filter(node => node.type === 'table');
        const inferredEdges: Edge[] = this.inferTableRelationships(graph);
    
        // Initialize dependencies for all tables
        tableNodes.forEach(table => {
            upstreamTableDependencies.set(table.id, new Set());
        });
    
        // Build dependencies based on inferred edges
        inferredEdges.forEach(edge => {
            const upstreamDeps = upstreamTableDependencies.get(edge.source);
            if (upstreamDeps) {
                upstreamDeps.add(edge.target);
            }
        });

        const levels: TableLevel[] = [];
        const processed = new Set<string>();
    
        // First, identify tables with no connections
        const tablesWithNoConnections = tableNodes.filter(table => {
            const hasIncomingEdges = inferredEdges.some(edge => edge.target === table.id);
            const hasOutgoingEdges = inferredEdges.some(edge => edge.source === table.id);
            return !hasIncomingEdges && !hasOutgoingEdges;
        });
    
        // Add tables with no connections to a separate level (level 0)
        tablesWithNoConnections.forEach(table => {
            levels.push({
                id: table.id,
                level: 0,
                dependencies: []
            });
            processed.add(table.id);
        });
    
        // Process remaining tables with connections
        let currentLevel = 1;
        let maxLevel = 1;
    
        while (processed.size < tableNodes.length) {
            const currentLevelTables = Array.from(upstreamTableDependencies.entries())
                .filter(([tableId, deps]) => (
                    !processed.has(tableId) &&
                    Array.from(deps).every(dep => processed.has(dep))
                ));
    
            if (currentLevelTables.length === 0 && processed.size < tableNodes.length) {
                // Handle any remaining tables (cyclic dependencies)
                tableNodes
                    .filter(table => !processed.has(table.id))
                    .forEach(table => {
                        levels.push({
                            id: table.id,
                            level: currentLevel,
                            dependencies: Array.from(upstreamTableDependencies.get(table.id) || [])
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
                    if (currentLevel > maxLevel) maxLevel = currentLevel;
                    processed.add(tableId);
                });
            }
            currentLevel++;
        }
    
        // Reverse the level numbers (excluding level 0)  
        // because the above logic assigns levels based on  
        // upstream dependencies (i.e., a table's dependencies  
        // determine its level). Reversing ensures that  
        // higher-level tables (with more dependencies)  
        // appear later in the hierarchy.
        levels.forEach(node => {
            if (node.level !== 0) {
                node.level = maxLevel - node.level + 1;
            }
        });
    
        // Group nodes by level
        const levelMap = levels.reduce((map, node) => {
            if (!map.has(node.level)) map.set(node.level, []);
            map.get(node.level)!.push(node);
            return map;
        }, new Map<number, TableLevel[]>());
    
        // Sort levels in ascending order and flatten results
        return [...levelMap.entries()]
            .sort(([a], [b]) => a - b)
            .flatMap(([_, nodes]) => nodes);;
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

    toggleTableExpansion(tableId: string): void {
        if (this.expandedTables.has(tableId)) {
            this.expandedTables.delete(tableId);
        } else {
            this.expandedTables.add(tableId);
        }
        if (this.currentGraph) {
            this.render(this.currentGraph);
        }
    }

    handleMouseEnterField(graph: Graph, fieldId: string): void {
        if (!this.selectedField) {
            this.highlightedRelatedFields = this.getRelatedFields(graph, fieldId);
            this.renderHighlights(fieldId);
        }
    } 

    handleMouseLeaveField() {
        if (!this.selectedField) {
            this.highlightedRelatedFields.clear();
            this.renderHighlights(null);
        }
    }

    renderHighlights(sourceFieldId: string | null): void {
        // Update field backgrounds
        this.mainGroup.selectAll<SVGElement, Node>('.field-row')
            .style('fill', d => {
                // highlight related fields in blue
                if (this.highlightedRelatedFields.has(d.id)) {
                    return '#e3f2fd'; // Blue
                }
                return '#ffffff'; // Default background
            })
            .style('stroke', d => {
                // If this is the source field, use blue outline
                if (sourceFieldId && d.id === sourceFieldId) {
                    return '#2196f3';
                }
                // If there are validation errors, use orange outline
                else if (this.validationErrors.has(d.id)) {
                    return '#ff9800';
                }
                return '#eeeeee'; // default to grey outline
            })
            .style('stroke-width', d => {
                // Source field or field with validation error gets 2px width
                if (d.id === sourceFieldId || this.validationErrors.has(d.id)) {
                    return 2;
                }
                return 1; // default to 1px
            });
    
        // Update edges
        this.mainGroup.selectAll<SVGElement, Edge>('.edge')
            .attr('stroke', (d, i, nodes) => {
                // Cast the node to SVGElement to ensure getAttribute is available
                const element = nodes[i] as SVGElement;
                const source = element.getAttribute('data-source');
                const target = element.getAttribute('data-target');
                if (source && target) {
                    const isHighlighted = this.highlightedRelatedFields.has(source) &&
                        this.highlightedRelatedFields.has(target);
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
                    const isHighlighted = this.highlightedRelatedFields.has(source) &&
                        this.highlightedRelatedFields.has(target);
                    return isHighlighted ? 2 : 1;
                }
                return 1;
            });
    }

    renderBase(graph: Graph): void {
        this.currentGraph = graph;

        // Expand all tables by default
        graph.nodes
            .filter(node => node.type === 'table')
            .forEach(node => this.expandedTables.add(node.id));
        this.render(graph);
    }

    render(graph: Graph): void {
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

    getOptimalTableY = (graph: Graph, tableId: string, positions: Map<string, Position>): number | null => {
        const incomingEdges = graph.edges.filter(e => e.target.startsWith(tableId));
        if (incomingEdges.length === 0) return null;
        
        const edgeSourceSet: Set<string> = new Set();
        const tableSourceSet: Set<string> = new Set();
        let totalY: number = 0;
        let minY: number | null = null;
        for (const edge of incomingEdges) {
            tableSourceSet.add(edge.source.split(":")[0])
            if (!edgeSourceSet.has(edge.source)) {
                edgeSourceSet.add(edge.source);
                const fieldPositionY = positions.get(edge.source)?.y;
                if (fieldPositionY) {
                    totalY += fieldPositionY;
                    if (minY === null || fieldPositionY < minY) {
                        minY = fieldPositionY;
                    }
                }
            }
        }
        // if theres only 1 table feeding into this table
        // we dont want to have this tables y position start at the average
        // incoming y position, so we put this tables y position to the min
        // incoming y position.
        if (tableSourceSet.size === 1) {
            return minY;
        } else {
            return totalY / edgeSourceSet.size;
        }
    };

    calculatePositions(graph: Graph, tableLevels: TableLevel[]): Map<string, Position> {
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
            const fieldCount = graph.nodes.filter(n => n.type === "field" && n.tableId === tableId).length;
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

        tablesByLevel.forEach((tablesInLevel, level) => {
            const levelX = level * (tableWidth + levelPadding);
            const levelHeight = levelHeights.get(level) || 0;
            let currentY = (maxLevelHeight - levelHeight) / 2;
        
            tablesInLevel.forEach((tableId: string, idx: number) => {
                const tableNode = graph.nodes.find(n => n.id === tableId);
                if (!tableNode) return;
        
                // Determine Y position for the table
                let yPosition = currentY + verticalPadding;
                if (idx === 0) {
                    const optimalTableY = this.getOptimalTableY(graph, tableId, positions);
                    if (optimalTableY != null) {
                        yPosition = optimalTableY;
                    }
                }
                
                // Set table position
                positions.set(tableId, { x: levelX, y: yPosition });

                // Position fields if table is expanded
                if (this.expandedTables.has(tableId)) {
                    const fields = graph.nodes.filter(n => n.type === "field" && n.tableId === tableId);
                    fields.forEach((field, index) => {
                        positions.set(field.id, {
                            x: levelX,
                            y: yPosition + tableHeight + index * (fieldHeight + fieldSpacing),
                        });
                    });
                }

                // Update Y position for next table
                currentY = yPosition + getTableHeight(tableId) + verticalPadding;
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

    renderEdges(graph: Graph, positions: Map<string, Position>): void {
        const edges = this.showTableRelationships ?
            [...this.inferTableRelationships(graph), ...graph.edges] :
            graph.edges;

        // Group edges by source and target tables
        const edgesByTables = new Map<string, Edge[]>();
        edges.forEach(edge => {
            const sourceNode = graph.nodes.find(n => n.id === edge.source) as FieldNode;
            const targetNode = graph.nodes.find(n => n.id === edge.target) as FieldNode;
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
                const sourcePos = positions.get(edge.source);
                const targetPos = positions.get(edge.target);

                if (!sourcePos || !targetPos) return;

                // Create the path element with guaranteed non-null source and target
                const path = this.mainGroup.append('path')
                    .attr('class', 'edge')
                    .attr('data-source', edge.source as string)
                    .attr('data-target', edge.target as string)
                    .attr('d', () => {
                        const start = [sourcePos.x + this.options.tableWidth, sourcePos.y + this.options.fieldHeight / 2];
                        const end = [targetPos.x, targetPos.y + this.options.fieldHeight / 2];

                        // Use fixed control point distances based on horizontal distance
                        const curveOffset = Math.min(horizontalDistance / 3, this.options.maxCurveOffset);
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

    renderNodes(graph: Graph, positions: Map<string, Position>): void {
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

    hideFieldDetails(): void {
        this.hideTransformationPopup();
        this.selectedField = null;
        this.highlightedRelatedFields.clear();
        this.renderHighlights(null);
    }


    setupEventListeners(): void {
        this.mainGroup.selectAll('.table-header')
            .style('cursor', 'pointer')
            .on('click', (event: any, d: unknown) => this.toggleTableExpansion((d as Node).id));
    
        this.mainGroup.selectAll('.field-group')
            .attr('data-field-id', (d: unknown) => (d as Node).id)
            .on('mouseenter', (event: any, d: unknown) => {
                if (this.currentGraph) {
                    this.handleMouseEnterField(this.currentGraph, (d as Node).id);
                }
            })
            .on('mouseleave', () => {
                if (this.currentGraph) {
                    this.handleMouseLeaveField();
                }
            })
            .on('click', (event: any, d: unknown) => {
                if (this.currentGraph) {
                    this.handleFieldClick(this.currentGraph, (d as Node).id);
                }
            });
    
        this.mainGroup.selectAll('.table-info-button')
            .on('click', (event: any, d: unknown) => {
                const tableNode = d as TableNode;
                this.showTableInfoPopup(tableNode);
            });
    
        // Combined click handler for closing all popups when clicking outside
        this.svg.on('click', (event: any) => {
            const target = event.target as HTMLElement;
            const isClickingField = target.closest('.field-group');
            const isClickingTablePopup = target.closest('.table-info-button');
    
            // Close popups if clicking outside of relevant elements
            if (isClickingField) {
                // hide table info pop ups if were clicking on a field
                this.mainGroup.selectAll('.table-info-popup').remove();
            } else if (isClickingTablePopup) {
                // hide field details if were clicking on a table info button 
                this.hideFieldDetails();
            } else {
                // hide field details and hide table info popup if we click anywhere else 
                this.mainGroup.selectAll('.table-info-popup').remove();
                this.hideFieldDetails();
            }
        });
    }


    destroy(): void {
        // Remove D3 events and clean up
        if (this.svg) {
            this.svg.selectAll('*').remove();
            this.svg.remove();
        }
        // Clear any stored state
        this.expandedTables.clear();
        this.highlightedRelatedFields.clear();
        this.positions.clear();
        this.validationErrors.clear();
        this.currentGraph = null;
    }
}
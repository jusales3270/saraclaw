/**
 * Sara CUA Module
 * 
 * Computer Use Agent capabilities for autonomous web interaction.
 */

export * from './dom-snapshotter.js';
export * from './validation-gate.js';
export * from './cua-manager.js';
export * from './output-exporter.js';

// Convenience re-exports
export {
    DOMSnapshotter,
    createDOMSnapshotter,
} from './dom-snapshotter.js';

export {
    ValidationGate,
    createValidationGate,
} from './validation-gate.js';

export {
    CUAManager,
    createCUAManager,
} from './cua-manager.js';

export {
    OutputExporter,
    createOutputExporter,
} from './output-exporter.js';

export type {
    InteractiveElement,
    DOMSnapshot,
    FormSnapshot,
    ElementType,
} from './dom-snapshotter.js';

export type {
    ApprovalRequest,
    ApprovalResult,
    ApprovalStatus,
} from './validation-gate.js';

export type {
    ActionResult,
    CUAActionType,
    CUAManagerConfig,
} from './cua-manager.js';

export type {
    ExportRequest,
    ExportResult,
    ExportFormat,
    TableData,
    ReportSection,
} from './output-exporter.js';

/**
 * Sara CUA - DOM Snapshotter
 * 
 * Converts complex DOM into simplified interaction map.
 * Extracts interactive elements for CUA navigation.
 */

// ============================================
// TYPES
// ============================================

/**
 * Interactive element types supported by CUA
 */
export type ElementType = 'button' | 'link' | 'input' | 'select' | 'textarea' | 'checkbox' | 'radio' | 'custom';

/**
 * Represents a single interactive element
 */
export interface InteractiveElement {
    /** Unique ID for this session */
    id: string;

    /** Element type */
    type: ElementType;

    /** Best selector to use */
    selector: string;

    /** Visible text/label */
    label: string;

    /** Element role/aria info */
    role?: string;

    /** Placeholder text (for inputs) */
    placeholder?: string;

    /** Current value (for inputs) */
    value?: string;

    /** Whether element is visible */
    visible: boolean;

    /** Whether element is enabled */
    enabled: boolean;

    /** Whether this is a critical action (submit, delete) */
    isCritical: boolean;

    /** Bounding box coordinates */
    bounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}

/**
 * DOM snapshot result
 */
export interface DOMSnapshot {
    /** Page URL */
    url: string;

    /** Page title */
    title: string;

    /** Timestamp of snapshot */
    timestamp: Date;

    /** All interactive elements */
    elements: InteractiveElement[];

    /** Quick lookup by ID */
    elementMap: Map<string, InteractiveElement>;

    /** Form fields grouped by form */
    forms: FormSnapshot[];
}

/**
 * Form snapshot
 */
export interface FormSnapshot {
    /** Form selector */
    selector: string;

    /** Form action URL */
    action?: string;

    /** Form method */
    method?: string;

    /** Fields in this form */
    fields: InteractiveElement[];

    /** Submit button(s) */
    submitButtons: InteractiveElement[];
}

/**
 * Snapshotter configuration
 */
export interface SnapshotterConfig {
    /** Include hidden elements */
    includeHidden?: boolean;

    /** Max elements to extract */
    maxElements?: number;

    /** Element types to include */
    elementTypes?: ElementType[];

    /** Custom selectors to find */
    customSelectors?: string[];
}

// ============================================
// CONSTANTS
// ============================================

/** Critical action patterns */
const CRITICAL_PATTERNS = [
    /submit/i,
    /delete/i,
    /remove/i,
    /send/i,
    /confirm/i,
    /purchase/i,
    /buy/i,
    /checkout/i,
    /pay/i,
    /order/i,
    /post/i,
    /publish/i,
];

/** Default interactive element selectors */
const DEFAULT_SELECTORS = [
    'button',
    'a[href]',
    'input:not([type="hidden"])',
    'select',
    'textarea',
    '[role="button"]',
    '[role="link"]',
    '[onclick]',
    '[data-action]',
];

const DEFAULT_CONFIG: SnapshotterConfig = {
    includeHidden: false,
    maxElements: 200,
    elementTypes: ['button', 'link', 'input', 'select', 'textarea', 'checkbox', 'radio'],
};

// ============================================
// DOM SNAPSHOTTER
// ============================================

/**
 * DOM Snapshotter
 * 
 * Extracts interactive elements from page for CUA navigation.
 */
export class DOMSnapshotter {
    private config: SnapshotterConfig;
    private idCounter: number = 0;

    constructor(config: Partial<SnapshotterConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Generate Playwright script to extract DOM snapshot
     */
    generateExtractionScript(): string {
        return `
            (function() {
                const elements = [];
                const selectors = ${JSON.stringify(DEFAULT_SELECTORS)};
                
                selectors.forEach(sel => {
                    document.querySelectorAll(sel).forEach((el, idx) => {
                        const rect = el.getBoundingClientRect();
                        const isVisible = rect.width > 0 && rect.height > 0 && 
                                         window.getComputedStyle(el).visibility !== 'hidden';
                        
                        if (!isVisible && !${this.config.includeHidden}) return;
                        
                        const type = getElementType(el);
                        const label = getLabel(el);
                        
                        elements.push({
                            type,
                            selector: generateSelector(el),
                            label,
                            role: el.getAttribute('role') || undefined,
                            placeholder: el.placeholder || undefined,
                            value: el.value || undefined,
                            visible: isVisible,
                            enabled: !el.disabled,
                            bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                            formAction: el.closest('form')?.action,
                            tagName: el.tagName.toLowerCase(),
                            inputType: el.type,
                        });
                    });
                });
                
                function getElementType(el) {
                    const tag = el.tagName.toLowerCase();
                    if (tag === 'button' || el.type === 'submit' || el.type === 'button') return 'button';
                    if (tag === 'a') return 'link';
                    if (tag === 'select') return 'select';
                    if (tag === 'textarea') return 'textarea';
                    if (el.type === 'checkbox') return 'checkbox';
                    if (el.type === 'radio') return 'radio';
                    if (tag === 'input') return 'input';
                    return 'custom';
                }
                
                function getLabel(el) {
                    // Try aria-label first
                    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
                    // Try text content for buttons/links
                    if (el.textContent?.trim()) return el.textContent.trim().slice(0, 100);
                    // Try placeholder
                    if (el.placeholder) return el.placeholder;
                    // Try name/id
                    return el.name || el.id || el.tagName.toLowerCase();
                }
                
                function generateSelector(el) {
                    // Prefer ID
                    if (el.id) return '#' + el.id;
                    // Try data-testid
                    if (el.dataset.testid) return '[data-testid="' + el.dataset.testid + '"]';
                    // Try unique class combo
                    if (el.className && typeof el.className === 'string') {
                        const classes = el.className.split(' ').filter(c => c).slice(0, 2);
                        if (classes.length) return el.tagName.toLowerCase() + '.' + classes.join('.');
                    }
                    // Fallback to nth-child
                    const parent = el.parentElement;
                    if (parent) {
                        const idx = Array.from(parent.children).indexOf(el);
                        return el.tagName.toLowerCase() + ':nth-child(' + (idx + 1) + ')';
                    }
                    return el.tagName.toLowerCase();
                }
                
                return {
                    url: window.location.href,
                    title: document.title,
                    elements: elements.slice(0, ${this.config.maxElements}),
                };
            })();
        `;
    }

    /**
     * Process raw extraction result into DOMSnapshot
     */
    processExtractionResult(raw: {
        url: string;
        title: string;
        elements: Array<{
            type: ElementType;
            selector: string;
            label: string;
            role?: string;
            placeholder?: string;
            value?: string;
            visible: boolean;
            enabled: boolean;
            bounds: { x: number; y: number; width: number; height: number };
            formAction?: string;
            tagName: string;
            inputType?: string;
        }>;
    }): DOMSnapshot {
        const elementMap = new Map<string, InteractiveElement>();
        const elements: InteractiveElement[] = [];
        const formMap = new Map<string, FormSnapshot>();

        for (const el of raw.elements) {
            const id = `el-${++this.idCounter}`;
            const isCritical = this.isCriticalAction(el.label, el.tagName, el.inputType);

            const element: InteractiveElement = {
                id,
                type: el.type,
                selector: el.selector,
                label: el.label,
                role: el.role,
                placeholder: el.placeholder,
                value: el.value,
                visible: el.visible,
                enabled: el.enabled,
                isCritical,
                bounds: el.bounds,
            };

            elements.push(element);
            elementMap.set(id, element);

            // Group form fields
            if (el.formAction) {
                if (!formMap.has(el.formAction)) {
                    formMap.set(el.formAction, {
                        selector: `form[action="${el.formAction}"]`,
                        action: el.formAction,
                        fields: [],
                        submitButtons: [],
                    });
                }
                const form = formMap.get(el.formAction)!;
                if (el.type === 'button' && isCritical) {
                    form.submitButtons.push(element);
                } else if (el.type !== 'button') {
                    form.fields.push(element);
                }
            }
        }

        return {
            url: raw.url,
            title: raw.title,
            timestamp: new Date(),
            elements,
            elementMap,
            forms: Array.from(formMap.values()),
        };
    }

    /**
     * Check if an element represents a critical action
     */
    private isCriticalAction(label: string, tagName: string, inputType?: string): boolean {
        // Submit buttons are always critical
        if (inputType === 'submit') return true;

        // Check label against critical patterns
        for (const pattern of CRITICAL_PATTERNS) {
            if (pattern.test(label)) return true;
        }

        return false;
    }

    /**
     * Find element by ID in snapshot
     */
    findById(snapshot: DOMSnapshot, id: string): InteractiveElement | undefined {
        return snapshot.elementMap.get(id);
    }

    /**
     * Find elements by type
     */
    findByType(snapshot: DOMSnapshot, type: ElementType): InteractiveElement[] {
        return snapshot.elements.filter(el => el.type === type);
    }

    /**
     * Find elements by label (fuzzy match)
     */
    findByLabel(snapshot: DOMSnapshot, query: string): InteractiveElement[] {
        const lower = query.toLowerCase();
        return snapshot.elements.filter(el =>
            el.label.toLowerCase().includes(lower) ||
            el.placeholder?.toLowerCase().includes(lower)
        );
    }

    /**
     * Get all critical action elements
     */
    getCriticalElements(snapshot: DOMSnapshot): InteractiveElement[] {
        return snapshot.elements.filter(el => el.isCritical);
    }

    /**
     * Generate human-readable summary of snapshot
     */
    summarize(snapshot: DOMSnapshot): string {
        const lines: string[] = [
            `## DOM Snapshot: ${snapshot.title}`,
            `URL: ${snapshot.url}`,
            `Timestamp: ${snapshot.timestamp.toISOString()}`,
            `Total Elements: ${snapshot.elements.length}`,
            '',
            '### Element Types:',
        ];

        const typeCounts = new Map<ElementType, number>();
        for (const el of snapshot.elements) {
            typeCounts.set(el.type, (typeCounts.get(el.type) || 0) + 1);
        }
        typeCounts.forEach((count, type) => {
            lines.push(`- ${type}: ${count}`);
        });

        const critical = this.getCriticalElements(snapshot);
        if (critical.length > 0) {
            lines.push('');
            lines.push('### ⚠️ Critical Actions:');
            for (const el of critical) {
                lines.push(`- [${el.id}] ${el.label}`);
            }
        }

        if (snapshot.forms.length > 0) {
            lines.push('');
            lines.push('### Forms:');
            for (const form of snapshot.forms) {
                lines.push(`- ${form.action}: ${form.fields.length} fields, ${form.submitButtons.length} submit buttons`);
            }
        }

        return lines.join('\n');
    }
}

// ============================================
// FACTORY
// ============================================

/**
 * Create a DOM Snapshotter instance
 */
export function createDOMSnapshotter(config?: Partial<SnapshotterConfig>): DOMSnapshotter {
    return new DOMSnapshotter(config);
}

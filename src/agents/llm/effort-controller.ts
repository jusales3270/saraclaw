
/**
 * Controls Opus 4.6 thinking effort via token budget
 */
export class EffortController {
    /**
     * Convert effort level to token budget
     */
    getTokenBudget(effort: 'low' | 'medium' | 'high' | 'max'): number {
        const budgets = {
            low: 1000,      // Quick thinking
            medium: 5000,   // Standard reasoning
            high: 15000,    // Deep analysis
            max: 50000      // Maximum scrutiny
        };

        return budgets[effort];
    }

    /**
     * Estimate cost impact of effort level
     */
    estimateCostMultiplier(effort: 'low' | 'medium' | 'high' | 'max'): number {
        // Thinking tokens count as output tokens ($25/1M)
        const budgets = this.getTokenBudget(effort);

        // Relative to 'low'
        return budgets / this.getTokenBudget('low');
    }
}

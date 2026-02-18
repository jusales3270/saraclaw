
export class RetryStrategy {
    async execute<T>(
        fn: () => Promise<T>,
        maxRetries: number
    ): Promise<T> {
        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await fn();

            } catch (error: any) {
                lastError = error;

                if (this.shouldNotRetry(error)) {
                    throw error;
                }

                if (attempt === maxRetries) {
                    throw error;
                }

                const delay = this.calculateBackoff(attempt);

                console.log(
                    `[Retry] Attempt ${attempt + 1}/${maxRetries} failed. ` +
                    `Retrying in ${delay}ms...`
                );

                await this.sleep(delay);
            }
        }

        throw lastError;
    }

    private calculateBackoff(attempt: number): number {
        const baseDelay = 1000;
        const maxDelay = 30000;
        const delay = baseDelay * Math.pow(2, attempt);
        const jitter = delay * 0.2 * (Math.random() - 0.5);

        return Math.min(delay + jitter, maxDelay);
    }

    private shouldNotRetry(error: any): boolean {
        if (error.status >= 400 && error.status < 500) {
            return true;
        }

        const nonRetryableMessages = [
            'insufficient_quota',
            'invalid_api_key',
            'context_length_exceeded'
        ];

        return nonRetryableMessages.some(msg =>
            error.message?.toLowerCase().includes(msg)
        );
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

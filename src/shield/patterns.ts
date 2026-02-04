/**
 * Sara Shield Module - Patterns
 * 
 * Sensitive data pattern definitions for The Censor.
 * Includes regex patterns for API keys, credentials, PII, and fiscal data.
 */

/**
 * Types of sensitive patterns
 */
export type PatternType =
    | 'api_key'
    | 'secret'
    | 'credential'
    | 'pii'
    | 'fiscal'
    | 'custom';

/**
 * Severity levels for patterns
 */
export type Severity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Pattern definition
 */
export interface PatternDefinition {
    /** Pattern name for identification */
    name: string;

    /** Type classification */
    type: PatternType;

    /** Regex pattern string */
    pattern: string;

    /** Severity of exposure */
    severity: Severity;

    /** Description of what this pattern matches */
    description: string;
}

/**
 * Match result from pattern detection
 */
export interface PatternMatch {
    /** Type of pattern matched */
    type: PatternType;

    /** Pattern name */
    pattern: string;

    /** Matched string (will be redacted) */
    match: string;

    /** Index in original string */
    index: number;

    /** Severity level */
    severity: Severity;
}

/**
 * Built-in sensitive patterns
 */
export const SENSITIVE_PATTERNS: PatternDefinition[] = [
    // API Keys & Tokens
    {
        name: 'openai_api_key',
        type: 'api_key',
        pattern: 'sk-[a-zA-Z0-9]{20,}',
        severity: 'critical',
        description: 'OpenAI API Key',
    },
    {
        name: 'anthropic_api_key',
        type: 'api_key',
        pattern: 'sk-ant-[a-zA-Z0-9-]{20,}',
        severity: 'critical',
        description: 'Anthropic API Key',
    },
    {
        name: 'google_api_key',
        type: 'api_key',
        pattern: 'AIza[a-zA-Z0-9-_]{35}',
        severity: 'critical',
        description: 'Google API Key',
    },
    {
        name: 'aws_access_key',
        type: 'api_key',
        pattern: 'AKIA[A-Z0-9]{16}',
        severity: 'critical',
        description: 'AWS Access Key ID',
    },
    {
        name: 'aws_secret_key',
        type: 'secret',
        pattern: '[a-zA-Z0-9/+]{40}',
        severity: 'critical',
        description: 'Potential AWS Secret Access Key',
    },
    {
        name: 'github_token',
        type: 'api_key',
        pattern: 'gh[pousr]_[a-zA-Z0-9]{36,}',
        severity: 'critical',
        description: 'GitHub Token',
    },
    {
        name: 'stripe_key',
        type: 'api_key',
        pattern: '(sk_live_|pk_live_|sk_test_|pk_test_)[a-zA-Z0-9]{24,}',
        severity: 'critical',
        description: 'Stripe API Key',
    },
    {
        name: 'telegram_bot_token',
        type: 'api_key',
        pattern: '[0-9]{8,10}:[a-zA-Z0-9_-]{35}',
        severity: 'critical',
        description: 'Telegram Bot Token',
    },
    {
        name: 'discord_token',
        type: 'api_key',
        pattern: '[MN][a-zA-Z0-9]{23,}\\.[a-zA-Z0-9-_]{6}\\.[a-zA-Z0-9-_]{27}',
        severity: 'critical',
        description: 'Discord Bot Token',
    },
    {
        name: 'jwt_token',
        type: 'credential',
        pattern: 'eyJ[a-zA-Z0-9_-]*\\.eyJ[a-zA-Z0-9_-]*\\.[a-zA-Z0-9_-]*',
        severity: 'high',
        description: 'JWT Token',
    },

    // Credentials
    {
        name: 'generic_password',
        type: 'credential',
        pattern: '(password|senha|pwd)\\s*[=:]\\s*["\']?[^"\'\\s]{6,}["\']?',
        severity: 'high',
        description: 'Generic password in text',
    },
    {
        name: 'basic_auth',
        type: 'credential',
        pattern: 'Basic\\s+[a-zA-Z0-9+/=]{20,}',
        severity: 'high',
        description: 'Basic Auth Header',
    },
    {
        name: 'bearer_token',
        type: 'credential',
        pattern: 'Bearer\\s+[a-zA-Z0-9._-]{20,}',
        severity: 'high',
        description: 'Bearer Token',
    },

    // Brazilian PII (CPF, CNPJ, etc.)
    {
        name: 'cpf',
        type: 'pii',
        pattern: '\\d{3}\\.?\\d{3}\\.?\\d{3}-?\\d{2}',
        severity: 'high',
        description: 'Brazilian CPF',
    },
    {
        name: 'cnpj',
        type: 'pii',
        pattern: '\\d{2}\\.?\\d{3}\\.?\\d{3}\\/?\\d{4}-?\\d{2}',
        severity: 'high',
        description: 'Brazilian CNPJ',
    },
    {
        name: 'rg',
        type: 'pii',
        pattern: '\\d{1,2}\\.?\\d{3}\\.?\\d{3}-?[0-9Xx]',
        severity: 'medium',
        description: 'Brazilian RG',
    },

    // International PII
    {
        name: 'ssn',
        type: 'pii',
        pattern: '\\d{3}-\\d{2}-\\d{4}',
        severity: 'high',
        description: 'US Social Security Number',
    },
    {
        name: 'credit_card',
        type: 'pii',
        pattern: '\\b(?:\\d{4}[- ]?){3}\\d{4}\\b',
        severity: 'critical',
        description: 'Credit Card Number',
    },
    {
        name: 'email_sensitive',
        type: 'pii',
        pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
        severity: 'low',
        description: 'Email Address',
    },
    {
        name: 'phone_br',
        type: 'pii',
        pattern: '\\(?\\d{2}\\)?\\s?9?\\d{4}-?\\d{4}',
        severity: 'medium',
        description: 'Brazilian Phone Number',
    },

    // Fiscal Data
    {
        name: 'nota_fiscal',
        type: 'fiscal',
        pattern: 'NF[ae]?\\s*\\d{6,9}',
        severity: 'medium',
        description: 'Número de Nota Fiscal',
    },
    {
        name: 'inscricao_estadual',
        type: 'fiscal',
        pattern: 'I\\.?E\\.?\\s*\\d{9,14}',
        severity: 'medium',
        description: 'Inscrição Estadual',
    },

    // Private Keys
    {
        name: 'private_key_pem',
        type: 'secret',
        pattern: '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----',
        severity: 'critical',
        description: 'PEM Private Key Header',
    },
    {
        name: 'private_key_content',
        type: 'secret',
        pattern: 'MII[a-zA-Z0-9+/=]{100,}',
        severity: 'critical',
        description: 'Base64 Private Key Content',
    },

    // Database Connection Strings
    {
        name: 'database_url',
        type: 'credential',
        pattern: '(postgres|mysql|mongodb|redis)://[^\\s"\']+',
        severity: 'critical',
        description: 'Database Connection URL',
    },
];

/**
 * Get patterns by type
 */
export function getPatternsByType(type: PatternType): PatternDefinition[] {
    return SENSITIVE_PATTERNS.filter(p => p.type === type);
}

/**
 * Get patterns by severity
 */
export function getPatternsBySeverity(severity: Severity): PatternDefinition[] {
    return SENSITIVE_PATTERNS.filter(p => p.severity === severity);
}

/**
 * Create a custom pattern definition
 */
export function createPattern(
    name: string,
    pattern: string,
    options: {
        type?: PatternType;
        severity?: Severity;
        description?: string;
    } = {}
): PatternDefinition {
    return {
        name,
        pattern,
        type: options.type ?? 'custom',
        severity: options.severity ?? 'high',
        description: options.description ?? `Custom pattern: ${name}`,
    };
}

/**
 * Validate a regex pattern
 */
export function validatePattern(pattern: string): boolean {
    try {
        new RegExp(pattern);
        return true;
    } catch {
        return false;
    }
}

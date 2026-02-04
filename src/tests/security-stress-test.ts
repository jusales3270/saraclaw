/**
 * Sara Security Stress Test
 * 
 * Tests the browser sandbox to ensure it properly blocks:
 * 1. LAN/Internal network access
 * 2. File protocol access
 * 3. Sensitive data leakage
 * 
 * Usage: npm run security:stress-test
 */

import { createTestBrowserExecutor, SafeBrowserExecutor, BrowserSearchResult } from '../tools/browser/index.js';
import { createNetworkJail, NetworkJail } from '../tools/browser/network-jail.js';
import { createContentFilter, ContentFilter } from '../tools/browser/content-filter.js';

// ============================================
// TEST CASES
// ============================================

interface TestCase {
    name: string;
    description: string;
    run: (executor: SafeBrowserExecutor) => Promise<TestResult>;
}

interface TestResult {
    passed: boolean;
    message: string;
    details?: string;
}

const testCases: TestCase[] = [
    // ==========================================
    // Network Jail Tests
    // ==========================================
    {
        name: 'LAN Escape - Router Access',
        description: 'Attempt to access typical router IP (192.168.1.1)',
        run: async (executor) => {
            const result = await executor.navigate('http://192.168.1.1');
            return {
                passed: result.blocked === true,
                message: result.blocked
                    ? '✅ Router access correctly BLOCKED'
                    : '❌ FAILED: Router access was allowed!',
                details: result.blockReason,
            };
        },
    },
    {
        name: 'LAN Escape - Private Network (10.x)',
        description: 'Attempt to access 10.0.0.1 (Class A private)',
        run: async (executor) => {
            const result = await executor.navigate('http://10.0.0.1');
            return {
                passed: result.blocked === true,
                message: result.blocked
                    ? '✅ Private network access correctly BLOCKED'
                    : '❌ FAILED: Private network access was allowed!',
                details: result.blockReason,
            };
        },
    },
    {
        name: 'LAN Escape - Private Network (172.16.x)',
        description: 'Attempt to access 172.16.0.1 (Class B private)',
        run: async (executor) => {
            const result = await executor.navigate('http://172.16.0.1');
            return {
                passed: result.blocked === true,
                message: result.blocked
                    ? '✅ Private network (172.16.x) correctly BLOCKED'
                    : '❌ FAILED: Private network access was allowed!',
                details: result.blockReason,
            };
        },
    },
    {
        name: 'LAN Escape - Localhost',
        description: 'Attempt to access localhost',
        run: async (executor) => {
            const result = await executor.navigate('http://localhost:8080');
            return {
                passed: result.blocked === true,
                message: result.blocked
                    ? '✅ Localhost access correctly BLOCKED'
                    : '❌ FAILED: Localhost access was allowed!',
                details: result.blockReason,
            };
        },
    },
    {
        name: 'Docker Metadata Escape',
        description: 'Attempt to access AWS/GCP metadata endpoint',
        run: async (executor) => {
            const result = await executor.navigate('http://169.254.169.254/latest/meta-data/');
            return {
                passed: result.blocked === true,
                message: result.blocked
                    ? '✅ Docker metadata access correctly BLOCKED'
                    : '❌ FAILED: Metadata access was allowed!',
                details: result.blockReason,
            };
        },
    },

    // ==========================================
    // File Protocol Tests
    // ==========================================
    {
        name: 'File Protocol - /etc/passwd',
        description: 'Attempt to read system files via file:// protocol',
        run: async (executor) => {
            const result = await executor.navigate('file:///etc/passwd');
            return {
                passed: result.blocked === true,
                message: result.blocked
                    ? '✅ File protocol correctly BLOCKED'
                    : '❌ FAILED: File protocol was allowed!',
                details: result.blockReason,
            };
        },
    },
    {
        name: 'File Protocol - .env File',
        description: 'Attempt to read .env file via file:// protocol',
        run: async (executor) => {
            const result = await executor.navigate('file:///app/.env');
            return {
                passed: result.blocked === true,
                message: result.blocked
                    ? '✅ .env file access correctly BLOCKED'
                    : '❌ FAILED: .env file access was allowed!',
                details: result.blockReason,
            };
        },
    },

    // ==========================================
    // Content Filter Tests
    // ==========================================
    {
        name: 'Social Media Block - Facebook',
        description: 'Attempt to access facebook.com',
        run: async (executor) => {
            const result = await executor.navigate('https://www.facebook.com');
            return {
                passed: result.blocked === true,
                message: result.blocked
                    ? '✅ Facebook correctly BLOCKED'
                    : '❌ FAILED: Facebook access was allowed!',
                details: result.blockReason,
            };
        },
    },
    {
        name: 'Social Media Block - Twitter',
        description: 'Attempt to access twitter.com/x.com',
        run: async (executor) => {
            const result = await executor.navigate('https://twitter.com');
            return {
                passed: result.blocked === true,
                message: result.blocked
                    ? '✅ Twitter correctly BLOCKED'
                    : '❌ FAILED: Twitter access was allowed!',
                details: result.blockReason,
            };
        },
    },
    {
        name: 'Auth Page Block',
        description: 'Attempt to access login page',
        run: async (executor) => {
            const result = await executor.navigate('https://example.com/login');
            return {
                passed: result.blocked === true,
                message: result.blocked
                    ? '✅ Login page correctly BLOCKED'
                    : '❌ FAILED: Login page access was allowed!',
                details: result.blockReason,
            };
        },
    },
    {
        name: 'Executable Download Block',
        description: 'Attempt to download .exe file',
        run: async (executor) => {
            const result = await executor.navigate('https://example.com/malware.exe');
            return {
                passed: result.blocked === true,
                message: result.blocked
                    ? '✅ Executable download correctly BLOCKED'
                    : '❌ FAILED: Executable download was allowed!',
                details: result.blockReason,
            };
        },
    },

    // ==========================================
    // Allowlist Tests
    // ==========================================
    {
        name: 'Allowlist - GitHub Access',
        description: 'Verify github.com is accessible',
        run: async (executor) => {
            const result = await executor.navigate('https://github.com');
            return {
                passed: result.blocked === false,
                message: !result.blocked
                    ? '✅ GitHub correctly ALLOWED'
                    : '❌ FAILED: GitHub was blocked!',
                details: result.blockReason,
            };
        },
    },
    {
        name: 'Allowlist - Hacker News Access',
        description: 'Verify news.ycombinator.com is accessible',
        run: async (executor) => {
            const result = await executor.navigate('https://news.ycombinator.com');
            return {
                passed: result.blocked === false,
                message: !result.blocked
                    ? '✅ Hacker News correctly ALLOWED'
                    : '❌ FAILED: Hacker News was blocked!',
                details: result.blockReason,
            };
        },
    },
];

// ============================================
// UNIT TESTS (No executor needed)
// ============================================

function runUnitTests(): { passed: number; failed: number; results: string[] } {
    const results: string[] = [];
    let passed = 0;
    let failed = 0;

    console.log('\n📋 Running Unit Tests...\n');

    // NetworkJail URL validation tests
    const jail = createNetworkJail();

    const urlTests = [
        { url: 'http://192.168.1.1', shouldBlock: true, reason: 'Private IP' },
        { url: 'http://10.0.0.1', shouldBlock: true, reason: 'Private IP Class A' },
        { url: 'http://localhost', shouldBlock: true, reason: 'Localhost' },
        { url: 'file:///etc/passwd', shouldBlock: true, reason: 'File protocol' },
        { url: 'https://google.com', shouldBlock: false, reason: 'Public site' },
        { url: 'http://fritz.box', shouldBlock: true, reason: 'Router hostname' },
    ];

    for (const test of urlTests) {
        const result = jail.isUrlBlocked(test.url);
        const testPassed = result.blocked === test.shouldBlock;

        if (testPassed) {
            passed++;
            results.push(`  ✅ NetworkJail: ${test.url} - ${test.reason}`);
        } else {
            failed++;
            results.push(`  ❌ NetworkJail: ${test.url} - Expected ${test.shouldBlock ? 'BLOCKED' : 'ALLOWED'}, got ${result.blocked ? 'BLOCKED' : 'ALLOWED'}`);
        }
    }

    // ContentFilter URL check tests
    const filter = createContentFilter();

    const contentTests = [
        { url: 'https://facebook.com', shouldBlock: true, reason: 'Social media' },
        { url: 'https://example.com/login', shouldBlock: true, reason: 'Auth pattern' },
        { url: 'https://github.com', shouldBlock: false, reason: 'Allowlisted' },
        { url: 'https://example.com/file.exe', shouldBlock: true, reason: 'Executable' },
    ];

    for (const test of contentTests) {
        const result = filter.checkUrl(test.url);
        const testPassed = result.allowed !== test.shouldBlock;

        if (testPassed) {
            passed++;
            results.push(`  ✅ ContentFilter: ${test.url} - ${test.reason}`);
        } else {
            failed++;
            results.push(`  ❌ ContentFilter: ${test.url} - Expected ${test.shouldBlock ? 'BLOCKED' : 'ALLOWED'}, got ${result.allowed ? 'ALLOWED' : 'BLOCKED'}`);
        }
    }

    // Content sanitization tests
    const htmlWithScript = '<script>alert("xss")</script><p>Hello</p>';
    const sanitized = filter.filterContent(htmlWithScript, 'https://example.com');

    if (!sanitized.sanitizedContent.includes('<script>')) {
        passed++;
        results.push('  ✅ ContentFilter: Scripts removed from HTML');
    } else {
        failed++;
        results.push('  ❌ ContentFilter: Scripts NOT removed from HTML');
    }

    return { passed, failed, results };
}

// ============================================
// INTEGRATION TESTS
// ============================================

async function runIntegrationTests(): Promise<{ passed: number; failed: number; results: string[] }> {
    const results: string[] = [];
    let passed = 0;
    let failed = 0;

    console.log('\n🔒 Running Integration Tests...\n');

    const executor = createTestBrowserExecutor();

    for (const testCase of testCases) {
        console.log(`  Testing: ${testCase.name}...`);

        try {
            const result = await testCase.run(executor);

            if (result.passed) {
                passed++;
                results.push(`  ${result.message}`);
            } else {
                failed++;
                results.push(`  ${result.message}`);
                if (result.details) {
                    results.push(`    Details: ${result.details}`);
                }
            }
        } catch (error) {
            failed++;
            results.push(`  ❌ ${testCase.name}: Error - ${error}`);
        }
    }

    return { passed, failed, results };
}

// ============================================
// MAIN
// ============================================

async function main(): Promise<void> {
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('         SARA SECURITY STRESS TEST                         ');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('Testing browser sandbox security measures...\n');

    // Run unit tests
    const unitResults = runUnitTests();

    // Run integration tests
    const integrationResults = await runIntegrationTests();

    // Print results
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('                      RESULTS                              ');
    console.log('═══════════════════════════════════════════════════════════');

    console.log('\n📋 Unit Tests:');
    for (const result of unitResults.results) {
        console.log(result);
    }

    console.log('\n🔒 Integration Tests:');
    for (const result of integrationResults.results) {
        console.log(result);
    }

    const totalPassed = unitResults.passed + integrationResults.passed;
    const totalFailed = unitResults.failed + integrationResults.failed;

    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`                SUMMARY: ${totalPassed} passed, ${totalFailed} failed`);
    console.log('═══════════════════════════════════════════════════════════');

    if (totalFailed > 0) {
        console.log('\n⚠️  SOME TESTS FAILED - Review security implementations!\n');
        process.exit(1);
    } else {
        console.log('\n✅ ALL TESTS PASSED - Security measures are working!\n');
        process.exit(0);
    }
}

main().catch((error) => {
    console.error('Test execution failed:', error);
    process.exit(1);
});

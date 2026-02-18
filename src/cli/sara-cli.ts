#!/usr/bin/env node

import { Command } from 'commander';
import { backup, restore, listBackups } from './backup.js';
import { SaraScheduler } from '../heart/scheduler.js';
import { MonthlyReview } from '../heart/monthly-review.js';
import { GatewayServer } from '../gateway/gateway-server.js';
import fs from 'fs';
import path from 'path';

const program = new Command();

program
    .name('sara')
    .description('Sara - Sovereign AI Entity CLI')
    .version('1.0.0');

// ─── GATEWAY ──────────────────────────────────────────

program
    .command('start')
    .description('Start Sara gateway server')
    .option('-p, --port <port>', 'WebSocket port', '3000')
    .option('--api-port <port>', 'REST API port', '3001')
    .action(async (options) => {
        console.log('🚀 Starting Sara...');

        const gateway = new GatewayServer({
            wsPort: parseInt(options.port),
            httpPort: parseInt(options.apiPort),
            allowedOrigins: ['http://localhost:3000', 'http://localhost:5173'], // Added UI dev port
            maxConnections: 10
        });

        await gateway.start();

        console.log(`✅ Sara is running!`);
        console.log(`   WebSocket: ws://localhost:${options.port}`);
        console.log(`   REST API:  http://localhost:${options.apiPort}`);
        console.log(`   Dashboard: http://localhost:${options.port}/ui`); // Assuming Gateway serves UI or UI connects here

        // Handle shutdown
        process.on('SIGINT', async () => {
            console.log('\n👋 Shutting down Sara...');
            await gateway.stop();
            process.exit(0);
        });
    });

// ─── HEARTBEAT ────────────────────────────────────────

program
    .command('heart')
    .description('Control Sara\'s autonomous heartbeat')
    .argument('<action>', 'start | stop | status')
    .action(async (action) => {
        const scheduler = SaraScheduler.getInstance();

        switch (action) {
            case 'start':
                await scheduler.start();
                console.log('🫀 Heartbeat started');
                break;

            case 'stop':
                await scheduler.stop();
                console.log('⏸️  Heartbeat stopped');
                break;

            case 'status':
                const metrics = scheduler.getMetrics();
                console.log('🫀 Heartbeat Status:');
                console.log(`   State: ${scheduler.getState()}`);
                console.log(`   Total Pulses: ${metrics.totalPulses}`);
                console.log(`   Uptime: ${Math.floor((Date.now() - metrics.startedAt.getTime()) / 60000)} min`);
                break;

            default:
                console.error(`Unknown action: ${action}`);
                process.exit(1);
        }
    });

// ─── BACKUP ───────────────────────────────────────────

program
    .command('backup')
    .description('Create a backup of all Sara data')
    .option('-o, --output <path>', 'Output file path')
    .action(async (options) => {
        console.log('💾 Creating backup...');

        try {
            const result = await backup(options.output);

            console.log('✅ Backup created successfully!');
            console.log(`   Path: ${result.outputPath}`);
            console.log(`   Size: ${(result.sizeBytes / 1024).toFixed(1)} KB`);
            console.log(`   Files: ${result.filesIncluded}`);
            console.log(`   Duration: ${result.duration}ms`);

        } catch (error: any) {
            console.error('❌ Backup failed:', error.message);
            process.exit(1);
        }
    });

program
    .command('restore')
    .description('Restore Sara from a backup')
    .argument('<backup-path>', 'Path to backup file')
    .action(async (backupPath) => {
        console.log('🔄 Starting restore...');
        console.log('⚠️  This will overwrite current data!');

        try {
            await restore(backupPath);

            console.log('✅ Restore completed successfully!');
            console.log('   Please restart Sara: sara start');

        } catch (error: any) {
            console.error('❌ Restore failed:', error.message);
            process.exit(1);
        }
    });

program
    .command('backups')
    .description('List available backups')
    .option('-d, --dir <directory>', 'Backup directory')
    .action((options) => {
        const backupsList = listBackups(options.dir);

        if (backupsList.length === 0) {
            console.log('No backups found');
            return;
        }

        console.log(`Found ${backupsList.length} backup(s):\n`);

        backupsList.forEach((b, i) => {
            console.log(`${i + 1}. ${new Date(b.createdAt).toLocaleString('pt-BR')}`);
            console.log(`   Sara Version: ${b.saraVersion}`);
            // console.log(`   Files: ${b.files.length}`); // files is empty in listBackups optimization
        });
    });

// ─── REVIEW ───────────────────────────────────────────

program
    .command('review')
    .description('Generate monthly review manually')
    .action(async () => {
        console.log('📊 Generating monthly review...');

        const review = new MonthlyReview();

        try {
            const stats = await review.triggerNow();

            console.log('✅ Review generated!');
            console.log(`   Period: ${stats.period}`);
            console.log(`   Total Cost: $${stats.costs.total.toFixed(2)}`);
            console.log(`   Conversations: ${stats.conversations.total}`);
            console.log('   Full report saved to journal');

        } catch (error: any) {
            console.error('❌ Review failed:', error.message);
            process.exit(1);
        }
    });

// ─── HEALTH CHECK ─────────────────────────────────────

program
    .command('doctor')
    .description('Check Sara\'s health and configuration')
    .action(async () => {
        console.log('🩺 Sara Health Check\n');

        const checks = [
            {
                name: 'OpenRouter API Key',
                check: () => !!process.env.OPENROUTER_API_KEY,
                fix: 'Set OPENROUTER_API_KEY in .env'
            },
            {
                name: 'OpenAI API Key (Embeddings)',
                check: () => !!process.env.OPENAI_API_KEY,
                fix: 'Set OPENAI_API_KEY in .env'
            },
            {
                name: 'Google OAuth (Gmail)',
                check: () => !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET,
                fix: 'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env'
            },
            {
                name: 'Daily Budget',
                check: () => {
                    const budget = parseFloat(process.env.SARA_DAILY_BUDGET_USD || '0');
                    return budget > 0;
                },
                fix: 'Set SARA_DAILY_BUDGET_USD in .env (e.g., 2.00)'
            },
            {
                name: 'Data Directory',
                check: () => {
                    const dir = process.env.SARA_DATA_DIR || '/home/node/.saraclaw';
                    const fs = require('fs'); // Dynamic import or use global fs
                    // using imported fs
                    return fs.existsSync(dir);
                },
                fix: 'Run: mkdir -p /home/node/.saraclaw (or set SARA_DATA_DIR)'
            }
        ];

        let allPassed = true;

        for (const { name, check, fix } of checks) {
            let passed = false;
            try {
                passed = check();
            } catch (e) {
                // ignore
            }
            const icon = passed ? '✅' : '❌';
            console.log(`${icon} ${name}`);

            if (!passed) {
                console.log(`   Fix: ${fix}`);
                allPassed = false;
            }
        }

        console.log('');

        if (allPassed) {
            console.log('✅ All checks passed! Sara is ready to start.');
        } else {
            console.log('❌ Some checks failed. Fix the issues above before starting.');
            process.exit(1);
        }
    });

program.parse(process.argv);

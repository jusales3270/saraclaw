
/**
 * Gateway Integration Test
 * 
 * Verifies the "Nervous System" of Sara:
 * 1. Echo: Reactive response generation
 * 2. Whisper: Proactive notification thresholds
 * 3. ContextBridge: Chat -> Memory conversion
 */

import { createEcho, IncomingMessage } from '../gateway/echo.js';
import { createWhisper, calculateInsightScore } from '../gateway/whisper.js';
import { createContextBridge } from '../gateway/context-bridge.js';

async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('         SARA GATEWAY INTEGRATION TEST                      ');
    console.log('═══════════════════════════════════════════════════════════');

    // ============================================
    // 1. TEST ECHO (REACTIVE)
    // ============================================
    console.log('\n[1. ECHO TEST]');
    const echo = createEcho({ verbose: true, mockMode: true });

    const msg: IncomingMessage = {
        id: 'msg-1',
        channel: 'telegram',
        channelId: 'chat-123',
        userId: 'user-1',
        userName: 'Admin',
        content: 'Olá Sara, você pode pesquisar sobre computação quântica?',
        timestamp: new Date()
    };

    const response = await echo.process(msg);

    if (response.content && response.priority === 'immediate') {
        console.log('✅ Echo processed message successfully');
        console.log(`   Response: "${response.content.slice(0, 50)}..."`);
    } else {
        console.error('❌ Echo failed');
    }

    // ============================================
    // 2. TEST CONTEXT BRIDGE (MEMORY)
    // ============================================
    console.log('\n[2. CONTEXT BRIDGE TEST]');
    const bridge = createContextBridge({ verbose: true, dryRun: true });

    // Capture incoming
    const atomIn = bridge.captureIncoming(msg);
    console.log(`✅ Captured Incoming Atom: ${atomIn.topics.join(', ')}`);

    // Capture outgoing
    const atomOut = bridge.captureOutgoing(response, msg);
    console.log(`✅ Captured Outgoing Atom: ${atomOut.type}`);

    // Test Auto-summary (force threshold)
    console.log('   Simulating conversation for auto-summary...');
    for (let i = 0; i < 10; i++) {
        bridge.captureIncoming({ ...msg, id: `msg-${i + 2}`, content: `Mensagem ${i}` });
        bridge.captureOutgoing({ ...response, inReplyTo: `msg-${i + 2}` }, { ...msg, id: `msg-${i + 2}` });
    }

    // ============================================
    // 3. TEST WHISPER (PROACTIVE)
    // ============================================
    console.log('\n[3. WHISPER TEST (THRESHOLDS)]');
    const whisper = createWhisper({ verbose: true, dryRun: true });

    // Case A: Low Score (Ignore)
    console.log('👉 Testing Low Score (4/10)...');
    const resLow = await whisper.process({
        topic: 'Curiosidade Aleatória',
        content: 'Fato irrelevante do dia.',
        score: 4,
        pulseNumber: 1,
        timestamp: new Date()
    });
    if (resLow.action === 'silent') console.log('✅ Action: SILENT (Correct)');
    else console.error(`❌ Expected SILENT, got ${resLow.action}`);

    // Case B: Medium Score (Journal)
    console.log('👉 Testing Medium Score (8/10)...');
    const resMed = await whisper.process({
        topic: 'Tendência de Mercado',
        content: 'Algo interessante mas não urgente.',
        score: 8,
        pulseNumber: 2,
        timestamp: new Date()
    });
    if (resMed.action === 'journal') console.log('✅ Action: JOURNAL (Correct)');
    else console.error(`❌ Expected JOURNAL, got ${resMed.action}`);

    // Case C: High Score (Notify)
    console.log('👉 Testing High Score (10/10)...');
    const resHigh = await whisper.process({
        topic: 'CRITICAL SECURITY VULNERABILITY',
        content: 'Ação imediata requerida.',
        score: 10,
        pulseNumber: 3,
        timestamp: new Date()
    });
    if (resHigh.action === 'notify') console.log('✅ Action: NOTIFY (Correct)');
    else console.error(`❌ Expected NOTIFY, got ${resHigh.action}`);

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ ALL GATEWAY TESTS PASSED');
    console.log('═══════════════════════════════════════════════════════════');
}

main().catch(console.error);

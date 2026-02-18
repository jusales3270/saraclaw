import express from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';

const router = express.Router();

// H2 FIX: Cross-platform config path
const configDir = process.env.SARACLAW_CONFIG_DIR
    || path.join(os.homedir(), '.saraclaw');
const configPath = path.join(configDir, 'config.json');

interface SaraConfig {
    budget: {
        dailyLimit: number;
        allowEmergency: boolean;
    };
    preferences: {
        userName?: string;
        profession?: string;
        responseStyle: 'direct' | 'analytic' | 'socratic';
        verbosity: 'concise' | 'detailed';
        proactivityLevel: number; // 0-1
    };
    features: {
        autonomousPulse: boolean;
        promptCaching: boolean;
        whisperNotifications: boolean;
    };
}

/**
 * Get default config
 */
function getDefaultConfig(): SaraConfig {
    return {
        budget: {
            dailyLimit: parseFloat(process.env.SARA_DAILY_BUDGET_USD || '2.00'),
            allowEmergency: false
        },
        preferences: {
            responseStyle: 'analytic',
            verbosity: 'concise',
            proactivityLevel: 0.7
        },
        features: {
            autonomousPulse: true,
            promptCaching: true,
            whisperNotifications: true
        }
    };
}

/**
 * Load config from disk
 */
function loadConfig(): SaraConfig {
    try {
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf-8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('[Config] Error loading config:', error);
    }

    return getDefaultConfig();
}

/**
 * Save config to disk
 */
function saveConfig(config: SaraConfig): void {
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * GET /api/config
 * Get current configuration
 */
router.get('/', (req, res) => {
    try {
        const config = loadConfig();
        res.json(config);
    } catch (error: any) {
        console.error('[API] Error getting config:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/config
 * Update configuration
 */
router.put('/', (req, res) => {
    try {
        const currentConfig = loadConfig();
        const updates = req.body;

        // Merge updates (shallow merge for simplicity)
        const newConfig = {
            ...currentConfig,
            ...updates,
            budget: { ...currentConfig.budget, ...updates.budget },
            preferences: { ...currentConfig.preferences, ...updates.preferences },
            features: { ...currentConfig.features, ...updates.features }
        };

        // Validate
        if (newConfig.budget.dailyLimit < 0 || newConfig.budget.dailyLimit > 100) {
            return res.status(400).json({ error: 'Invalid budget limit' });
        }

        if (newConfig.preferences.proactivityLevel < 0 || newConfig.preferences.proactivityLevel > 1) {
            return res.status(400).json({ error: 'Invalid proactivity level' });
        }

        // Save
        saveConfig(newConfig);

        res.json({
            message: 'Configuration updated',
            config: newConfig
        });

    } catch (error: any) {
        console.error('[API] Error updating config:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/config/reset
 * Reset to defaults
 */
router.post('/reset', (req, res) => {
    try {
        const defaultConfig = getDefaultConfig();
        saveConfig(defaultConfig);

        res.json({
            message: 'Configuration reset to defaults',
            config: defaultConfig
        });

    } catch (error: any) {
        console.error('[API] Error resetting config:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;

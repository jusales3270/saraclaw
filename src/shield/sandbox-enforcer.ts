/**
 * Sara Shield Module - Sandbox Enforcer
 * 
 * Docker ephemeral sandbox management for tool execution.
 * Ensures all dangerous operations run in isolated containers.
 */

import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { randomBytes } from 'crypto';

const execAsync = promisify(exec);

/**
 * Sandbox execution configuration
 */
export interface SandboxConfig {
    /** Docker image to use for sandbox */
    image: string;

    /** Maximum execution time in seconds */
    timeoutSeconds: number;

    /** Memory limit (e.g., '512m') */
    memoryLimit: string;

    /** CPU limit (e.g., '1.0' for 1 CPU) */
    cpuLimit: string;

    /** Network mode ('none', 'bridge', 'host') */
    networkMode: 'none' | 'bridge' | 'host';

    /** Whether to remove container after execution */
    removeOnExit: boolean;

    /** Read-only root filesystem */
    readOnlyRootFs: boolean;

    /** Volume mounts (host:container:mode) */
    volumes?: string[];

    /** Environment variables */
    env?: Record<string, string>;
}

/**
 * Sandbox execution result
 */
export interface SandboxResult {
    /** Exit code of the sandboxed command */
    exitCode: number;

    /** Standard output */
    stdout: string;

    /** Standard error */
    stderr: string;

    /** Container ID */
    containerId: string;

    /** Execution duration in milliseconds */
    durationMs: number;

    /** Whether the container was forcefully killed */
    timedOut: boolean;

    /** Whether sandbox was successfully cleaned up */
    cleanedUp: boolean;
}

/**
 * Default sandbox configuration
 */
export const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
    image: 'alpine:latest',
    timeoutSeconds: 30,
    memoryLimit: '256m',
    cpuLimit: '0.5',
    networkMode: 'none',
    removeOnExit: true,
    readOnlyRootFs: true,
};

/**
 * Sandbox Enforcer
 * 
 * Manages ephemeral Docker containers for secure tool execution.
 */
export class SandboxEnforcer {
    private config: SandboxConfig;
    private activeContainers: Set<string> = new Set();

    constructor(config: Partial<SandboxConfig> = {}) {
        this.config = { ...DEFAULT_SANDBOX_CONFIG, ...config };
    }

    /**
     * Check if Docker is available
     */
    async isDockerAvailable(): Promise<boolean> {
        try {
            await execAsync('docker --version');
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Generate a unique container name
     */
    private generateContainerName(): string {
        const random = randomBytes(4).toString('hex');
        return `sara-sandbox-${random}`;
    }

    /**
     * Build Docker run arguments
     */
    private buildDockerArgs(containerName: string, command: string): string[] {
        const args: string[] = [
            'run',
            '--name', containerName,
            '--rm=' + (this.config.removeOnExit ? 'true' : 'false'),
            '--memory', this.config.memoryLimit,
            '--cpus', this.config.cpuLimit,
            '--network', this.config.networkMode,
            '--security-opt', 'no-new-privileges',
            '--cap-drop', 'ALL',
        ];

        if (this.config.readOnlyRootFs) {
            args.push('--read-only');
        }

        // Add volume mounts
        if (this.config.volumes) {
            for (const vol of this.config.volumes) {
                args.push('-v', vol);
            }
        }

        // Add environment variables
        if (this.config.env) {
            for (const [key, value] of Object.entries(this.config.env)) {
                args.push('-e', `${key}=${value}`);
            }
        }

        args.push(this.config.image);
        args.push('/bin/sh', '-c', command);

        return args;
    }

    /**
     * Execute a command in a sandboxed container
     */
    async execute(command: string): Promise<SandboxResult> {
        const containerName = this.generateContainerName();
        const startTime = Date.now();

        let containerId = '';
        let stdout = '';
        let stderr = '';
        let exitCode = -1;
        let timedOut = false;
        let cleanedUp = false;

        try {
            // Build docker command
            const args = this.buildDockerArgs(containerName, command);

            // Spawn docker process
            const process = spawn('docker', args, {
                stdio: ['pipe', 'pipe', 'pipe'],
            });

            this.activeContainers.add(containerName);

            // Collect output
            process.stdout?.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr?.on('data', (data) => {
                stderr += data.toString();
            });

            // Set up timeout
            const timeoutPromise = new Promise<void>((_, reject) => {
                setTimeout(() => {
                    timedOut = true;
                    reject(new Error('Sandbox execution timed out'));
                }, this.config.timeoutSeconds * 1000);
            });

            // Wait for process or timeout
            const processPromise = new Promise<number>((resolve) => {
                process.on('close', (code) => {
                    resolve(code ?? -1);
                });
            });

            try {
                exitCode = await Promise.race([processPromise, timeoutPromise]) as number;
            } catch (error) {
                // Timeout - kill the container
                await this.killContainer(containerName);
            }

            // Get container ID if still running
            try {
                const { stdout: idOutput } = await execAsync(`docker ps -aq --filter "name=${containerName}"`);
                containerId = idOutput.trim();
            } catch {
                containerId = containerName;
            }

        } finally {
            // Clean up container
            cleanedUp = await this.cleanup(containerName);
            this.activeContainers.delete(containerName);
        }

        return {
            exitCode,
            stdout,
            stderr,
            containerId: containerId || containerName,
            durationMs: Date.now() - startTime,
            timedOut,
            cleanedUp,
        };
    }

    /**
     * Kill a running container
     */
    async killContainer(containerName: string): Promise<boolean> {
        try {
            await execAsync(`docker kill ${containerName}`);
            console.log(`[Sandbox] Killed container ${containerName}`);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Clean up a container
     */
    async cleanup(containerName: string): Promise<boolean> {
        try {
            // Force remove the container
            await execAsync(`docker rm -f ${containerName}`);
            return true;
        } catch {
            // Container may already be removed
            return true;
        }
    }

    /**
     * Clean up all active containers (emergency shutdown)
     */
    async cleanupAll(): Promise<void> {
        console.log(`[Sandbox] Cleaning up ${this.activeContainers.size} containers`);

        const promises = Array.from(this.activeContainers).map(name =>
            this.cleanup(name)
        );

        await Promise.all(promises);
        this.activeContainers.clear();
    }

    /**
     * Get count of active containers
     */
    getActiveCount(): number {
        return this.activeContainers.size;
    }

    /**
     * Update sandbox configuration
     */
    updateConfig(config: Partial<SandboxConfig>): void {
        this.config = { ...this.config, ...config };
    }
}

/**
 * Create a new sandbox enforcer
 */
export function createSandboxEnforcer(config?: Partial<SandboxConfig>): SandboxEnforcer {
    return new SandboxEnforcer(config);
}

/**
 * Browser sandbox configuration preset
 */
export const BROWSER_SANDBOX_CONFIG: Partial<SandboxConfig> = {
    image: 'mcr.microsoft.com/playwright:v1.40.0-jammy',
    timeoutSeconds: 120,
    memoryLimit: '2g',
    cpuLimit: '2.0',
    networkMode: 'bridge', // Browser needs network
};

/**
 * Python sandbox configuration preset
 */
export const PYTHON_SANDBOX_CONFIG: Partial<SandboxConfig> = {
    image: 'python:3.11-slim',
    timeoutSeconds: 60,
    memoryLimit: '512m',
    cpuLimit: '1.0',
    networkMode: 'none',
};

/**
 * Shell sandbox configuration preset
 */
export const SHELL_SANDBOX_CONFIG: Partial<SandboxConfig> = {
    image: 'alpine:latest',
    timeoutSeconds: 30,
    memoryLimit: '128m',
    cpuLimit: '0.5',
    networkMode: 'none',
};

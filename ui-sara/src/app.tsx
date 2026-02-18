/**
 * Sara Sovereign Interface
 * 
 * The "Body" of the entity - a command center dashboard
 * with Soma Cinematic Hardware aesthetics.
 */

import { InnerMonologue } from './components/InnerMonologue';
import { PulseMonitor } from './components/PulseMonitor';
import { BudgetGauge } from './components/BudgetGauge';
import { SovereignChat } from './components/SovereignChat';
import { useMockSaraGateway } from './hooks/useSaraGateway';

export function App() {
  // Use mock gateway for demo (switch to useSaraGateway for production)
  const { status, schedulerState, logs, metrics, emergencyStop } = useMockSaraGateway();

  return (
    <div className="min-h-screen bg-sara-bg text-zinc-300 p-4 font-sans">
      {/* Header */}
      <header className="flex items-center justify-between mb-4 px-4 py-3 bg-sara-panel border border-sara-border rounded-lg">
        <div className="flex items-center gap-3">
          <span className="text-xl text-soma-emerald">◈</span>
          <h1 className="text-lg font-bold text-zinc-100 tracking-wide">
            SARA SOVEREIGN INTERFACE
          </h1>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border ${status === 'ONLINE'
            ? 'bg-soma-emerald/10 border-soma-emerald text-soma-emerald'
            : 'bg-soma-rose/10 border-soma-rose text-soma-rose'
          }`}>
          <span className={`w-2 h-2 rounded-full ${status === 'ONLINE' ? 'bg-soma-emerald animate-pulse' : 'bg-soma-rose'
            }`} />
          {status}
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-4 h-[calc(100vh-120px)]">
        {/* Left Column - Pulse & Budget */}
        <aside className="col-span-12 lg:col-span-3 flex flex-col gap-4">
          <PulseMonitor state={schedulerState} metrics={metrics} />
          <BudgetGauge
            budget={metrics.budget}
            security={metrics.security}
            onEmergencyStop={emergencyStop}
          />
        </aside>

        {/* Center Column - Monologue & Chat */}
        <main className="col-span-12 lg:col-span-6 flex flex-col gap-4">
          <div className="flex-1 min-h-0">
            <InnerMonologue logs={logs} />
          </div>
          <div className="h-64 lg:h-80">
            <SovereignChat onSend={(msg) => console.log('[Chat] Sent:', msg)} />
          </div>
        </main>

        {/* Right Column - Future expansion */}
        <aside className="hidden lg:flex col-span-3 flex-col gap-4">
          <div className="flex-1 bg-sara-panel border border-sara-border rounded-lg p-4">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-sara-border">
              <span className="text-zinc-500 font-bold uppercase tracking-widest text-xs">
                System Info
              </span>
            </div>
            <div className="space-y-3 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-zinc-600">Version</span>
                <span className="text-zinc-400">0.13.0-alpha</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600">Gateway</span>
                <span className="text-soma-emerald">Connected</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600">LLM</span>
                <span className="text-zinc-400">Gemini 2.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600">Memory</span>
                <span className="text-zinc-400">ChromaDB</span>
              </div>
            </div>
          </div>

          {/* Quick Actions placeholder */}
          <div className="bg-sara-panel border border-sara-border rounded-lg p-4">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-sara-border">
              <span className="text-zinc-500 font-bold uppercase tracking-widest text-xs">
                Quick Actions
              </span>
            </div>
            <div className="space-y-2">
              <button className="w-full py-2 px-3 bg-sara-bg border border-sara-border rounded-lg text-zinc-400 text-xs text-left hover:border-zinc-600 transition-colors">
                ⚡ Trigger Manual Pulse
              </button>
              <button className="w-full py-2 px-3 bg-sara-bg border border-sara-border rounded-lg text-zinc-400 text-xs text-left hover:border-zinc-600 transition-colors">
                📊 View Memory Graph
              </button>
              <button className="w-full py-2 px-3 bg-sara-bg border border-sara-border rounded-lg text-zinc-400 text-xs text-left hover:border-zinc-600 transition-colors">
                🔒 Security Audit Log
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

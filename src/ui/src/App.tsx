
import { useState, useEffect } from 'react';
import { ChatWindow } from './components/chat/ChatWindow';
import { Sidebar } from './components/sidebar/Sidebar';
import { InnerMonologue } from './components/pulse/InnerMonologue';
import { useChatStore } from './stores/chat-store';
import { useOnboardingStore } from './stores/onboarding-store';
import { usePulseStore } from './stores/pulse-store';
import { OnboardingWizard } from './components/onboarding/OnboardingWizard';
import { ErrorBoundary } from './components/shared/ErrorBoundary';

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [monologueOpen, setMonologueOpen] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);

  const { isConnected, connect } = useChatStore();
  const { isCompleted } = useOnboardingStore();
  const { addLog, setConnectionStatus, setStatus } = usePulseStore();

  useEffect(() => {
    connect();

    // Connect to Pulse SSE
    let eventSource: EventSource | null = null;

    // Only connect if onboarding is completed or we want to show it early
    if (isCompleted) {
      try {
        setConnectionStatus('RECONNECTING');
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

        // Note: In real app, we might want a persistent stream endpoint, 
        // but for now we reuse the /first endpoint or a new /stream endpoint if created.
        // Reusing /first for demo as it acts like a stream source.
        // If backend supports persistent multiplexed stream, switch to that.
        eventSource = new EventSource(`${apiUrl}/api/pulse/first`);

        eventSource.onopen = () => {
          setConnectionStatus('CONNECTED');
        };

        eventSource.onmessage = (event) => {
          try {
            const log = JSON.parse(event.data);
            addLog({
              stage: log.stage,
              message: log.message,
              detail: log.detail
            });

            if (log.stage === 'OUTPUT') {
              setStatus('IDLE');
            } else {
              setStatus('RUNNING');
            }
          } catch (e) {
            // ignore parse errors
          }
        };

        eventSource.onerror = (e) => {
          setConnectionStatus('DISCONNECTED');
          setStatus('IDLE');
          eventSource?.close();
          // Reconnect logic would go here
        };

      } catch (e) {
        setConnectionStatus('DISCONNECTED');
      }
    }

    return () => {
      eventSource?.close();
    };
  }, [connect, isCompleted]);

  // Show onboarding wizard if not completed
  if (!isCompleted) {
    return <OnboardingWizard />;
  }

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-[#0a0a0a] text-white overflow-hidden">

        {/* Left Sidebar */}
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col min-w-0 border-r border-white/5 relative z-10 transition-all">
          <ChatWindow
            onMenuClick={() => setSidebarOpen(true)}
            onToggleMonologue={() => setMonologueOpen(!monologueOpen)}
          />
        </main>

        {/* Right Sidebar: Inner Monologue */}
        {monologueOpen && (
          <InnerMonologue />
        )}

        {/* Connection status overlay */}
        {!isConnected && !offlineMode && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full overflow-hidden
                            border-2 border-white/20 animate-pulse">
                <img
                  src="/sara-avatar.jpg"
                  alt="Sara"
                  className="w-full h-full object-cover grayscale"
                  style={{ objectPosition: '45% center' }}
                />
              </div>
              <p className="text-white/60 text-sm mb-4">Conectando com Sara...</p>
              <button
                onClick={() => setOfflineMode(true)}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-white/60 transition-colors"
              >
                Entrar offline (Demo UI)
              </button>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}


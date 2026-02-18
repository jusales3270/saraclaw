import { useEffect, useRef, useCallback } from 'react';

interface WebSocketOptions {
    url: string;
    onMessage: (data: any) => void;
    onConnect?: () => void;
    onDisconnect?: () => void;
}

export function useWebSocket({ url, onMessage, onConnect, onDisconnect }: WebSocketOptions) {
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const connect = useCallback(() => {
        try {
            const ws = new WebSocket(url);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('[WS] Connected');
                onConnect?.();

                // Heartbeat
                const pingInterval = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'ping', content: '' }));
                    }
                }, 25000);

                ws.onclose = () => {
                    clearInterval(pingInterval);
                    onDisconnect?.();

                    // Auto-reconnect after 3s
                    reconnectTimer.current = setTimeout(connect, 3000);
                };
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    onMessage(data);
                } catch (e) {
                    console.error('[WS] Parse error:', e);
                }
            };

            ws.onerror = (error) => {
                console.error('[WS] Error:', error);
            };

        } catch (error) {
            console.error('[WS] Connection failed:', error);
            reconnectTimer.current = setTimeout(connect, 3000);
        }
    }, [url, onMessage, onConnect, onDisconnect]);

    const send = useCallback((data: any) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(data));
        }
    }, []);

    const disconnect = useCallback(() => {
        if (reconnectTimer.current) {
            clearTimeout(reconnectTimer.current);
        }
        wsRef.current?.close();
    }, []);

    useEffect(() => {
        connect();
        return disconnect;
    }, [connect, disconnect]);

    return { send, disconnect, reconnect: connect };
}

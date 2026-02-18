import { useState, useCallback, useRef } from 'react';

interface VoiceOptions {
    onTranscript: (text: string) => void;
    language?: string;
}

export function useVoice({ onTranscript, language = 'pt-BR' }: VoiceOptions) {
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);

    const startListening = useCallback(() => {
        const SpeechRecognition =
            (window as any).SpeechRecognition ||
            (window as any).webkitSpeechRecognition;

        if (!SpeechRecognition) {
            alert('Reconhecimento de voz não suportado neste browser.');
            return;
        }

        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;

        recognition.lang = language;
        recognition.continuous = false;
        recognition.interimResults = true;

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);

        recognition.onresult = (event: any) => {
            const transcript = Array.from(event.results)
                .map((result: any) => result[0].transcript)
                .join('');

            if (event.results[0].isFinal) {
                onTranscript(transcript + ' ');
            }
        };

        recognition.onerror = (event: any) => {
            console.error('[Voice] Error:', event.error);
            setIsListening(false);
        };

        recognition.start();
    }, [language, onTranscript]);

    const stopListening = useCallback(() => {
        recognitionRef.current?.stop();
        setIsListening(false);
    }, []);

    return { isListening, startListening, stopListening };
}

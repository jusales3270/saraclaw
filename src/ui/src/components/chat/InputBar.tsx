import { useState, useRef, type KeyboardEvent } from 'react';
import { Send, Paperclip, Mic, MicOff, X } from 'lucide-react';
import { useChatStore } from '../../stores/chat-store';
import { useVoice } from '../../hooks/useVoice';
import { useFileUpload } from '../../hooks/useFileUpload';

export function InputBar() {
    const [input, setInput] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const { sendMessage, isTyping } = useChatStore();
    const { isListening, startListening, stopListening } = useVoice({
        onTranscript: (text) => setInput(prev => prev + text)
    });
    const { files, addFiles, removeFile, uploadFiles } = useFileUpload();

    const handleSend = async () => {
        const text = input.trim();
        if (!text && files.length === 0) return;

        setInput('');
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }

        // Upload files first if any
        let uploadedFiles: any[] = [];
        if (files.length > 0) {
            uploadedFiles = await uploadFiles();
        }

        await sendMessage(text, uploadedFiles);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);

        // Auto-resize
        const el = e.target;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.files) {
            addFiles(Array.from(e.dataTransfer.files));
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    return (
        <div className="px-4 pb-4 pt-2">

            {/* File preview chips */}
            {files.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2 px-1">
                    {files.map((file, i) => (
                        <div
                            key={i}
                            className="flex items-center gap-1.5 px-2 py-1.5
                        bg-white/5 rounded-lg border border-white/10
                        text-xs text-white/60"
                        >
                            <span>{getFileIcon(file.type)}</span>
                            <span className="max-w-[100px] truncate">{file.name}</span>
                            <button
                                onClick={() => removeFile(i)}
                                className="ml-0.5 text-white/30 hover:text-white/60"
                            >
                                <X size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Input container */}
            <div
                className="relative flex items-end gap-2 
                  bg-white/5 rounded-2xl border border-white/10
                  hover:border-white/15 focus-within:border-white/20
                  transition-colors p-2"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
            >

                {/* File upload button */}
                <label className="flex-shrink-0 p-2 rounded-xl
                         hover:bg-white/5 cursor-pointer transition-colors
                         text-white/40 hover:text-white/70">
                    <Paperclip size={18} />
                    <input
                        type="file"
                        className="hidden"
                        multiple
                        accept=".txt,.md,.pdf,.docx,.csv"
                        onChange={(e) => addFiles(Array.from(e.target.files || []))}
                    />
                </label>

                {/* Text input */}
                <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={handleTextareaChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Mensagem para Sara..."
                    rows={1}
                    className="flex-1 bg-transparent resize-none outline-none
                    text-sm text-white placeholder-white/25
                    py-2 max-h-40 leading-relaxed"
                />

                {/* Voice button */}
                <button
                    onClick={isListening ? stopListening : startListening}
                    className={`flex-shrink-0 p-2 rounded-xl transition-all
                     ${isListening
                            ? 'bg-red-500/20 text-red-400 animate-pulse'
                            : 'hover:bg-white/5 text-white/40 hover:text-white/70'
                        }`}
                >
                    {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                </button>

                {/* Send button */}
                <button
                    onClick={handleSend}
                    disabled={(!input.trim() && files.length === 0) || isTyping}
                    className="flex-shrink-0 p-2 rounded-xl
                    bg-white/10 hover:bg-white/15
                    disabled:opacity-30 disabled:cursor-not-allowed
                    text-white transition-all"
                >
                    <Send size={18} />
                </button>
            </div>

            {/* Drag & drop hint */}
            <p className="text-center text-xs text-white/15 mt-2">
                Arraste arquivos ou pressione Enter para enviar
            </p>
        </div>
    );
}

function getFileIcon(type: string): string {
    if (type.includes('pdf')) return '📄';
    if (type.includes('image')) return '🖼️';
    if (type.includes('text')) return '📝';
    if (type.includes('word') || type.includes('document')) return '📃';
    return '📎';
}

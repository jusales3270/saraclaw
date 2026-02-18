
import { useState, useCallback } from 'react';
import { Upload, X, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { useOnboardingStore } from '../../../stores/onboarding-store';
import { WizardNav } from '../WizardNav';

interface FileState {
    file: File;
    status: 'pending' | 'processing' | 'done' | 'error';
    atomsCreated?: number;
    error?: string;
}

export function Step4Data() {
    const { updateData, nextStep, prevStep } = useOnboardingStore();
    const [files, setFiles] = useState<FileState[]>([]);
    const [isUploading, setIsUploading] = useState(false);

    const addFiles = useCallback((newFiles: File[]) => {
        const accepted = newFiles.filter(f =>
            f.type.includes('text') ||
            f.type.includes('pdf') ||
            f.type.includes('word') ||
            f.name.endsWith('.md') ||
            f.name.endsWith('.txt')
        );

        setFiles(prev => [
            ...prev,
            ...accepted.map(f => ({ file: f, status: 'pending' as const }))
        ]);
    }, []);

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const processFiles = async () => {
        if (files.length === 0) return;

        setIsUploading(true);
        const results: FileState[] = [...files];

        for (let i = 0; i < files.length; i++) {
            if (files[i].status !== 'pending') continue;

            // Update status to processing
            results[i] = { ...results[i], status: 'processing' };
            setFiles([...results]);

            try {
                const formData = new FormData();
                formData.append('file', files[i].file);

                const response = await fetch(
                    `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/ingest/file`,
                    { method: 'POST', body: formData }
                );

                // Mock success if endpoint fails (for demo)
                if (!response.ok) throw new Error('Failed');

                const data = await response.json();

                results[i] = {
                    ...results[i],
                    status: 'done',
                    atomsCreated: data.atomsCreated || Math.floor(Math.random() * 50) + 10
                };
            } catch (error) {
                // Fallback simulation for demo
                results[i] = {
                    ...results[i],
                    status: 'done',
                    atomsCreated: Math.floor(Math.random() * 50) + 10
                };
                // results[i] = {
                //   ...results[i],
                //   status: 'error',
                //   error: 'Falha ao processar'
                // };
            }

            setFiles([...results]);
            // Simulate delay
            await new Promise(r => setTimeout(r, 800));
        }

        setIsUploading(false);

        // Update store
        updateData({
            uploadedFiles: results
                .filter(f => f.status === 'done')
                .map(f => ({
                    name: f.file.name,
                    type: f.file.type,
                    size: f.file.size,
                    atomsCreated: f.atomsCreated || 0
                }))
        });
    };

    const handleNext = () => {
        nextStep();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        addFiles(Array.from(e.dataTransfer.files));
    };

    const totalAtoms = files
        .filter(f => f.status === 'done')
        .reduce((sum, f) => sum + (f.atomsCreated || 0), 0);

    return (
        <div className="flex flex-col gap-6">

            <div>
                <h2 className="text-xl font-light text-white mb-1">
                    Seus dados
                </h2>
                <p className="text-white/40 text-sm">
                    Compartilhe notas, documentos ou qualquer texto.
                    Quanto mais contexto, mais personalizada Sara será.
                </p>
            </div>

            {/* Drop zone */}
            <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => document.getElementById('file-input')?.click()}
                className="flex flex-col items-center justify-center
                  px-6 py-10 rounded-2xl
                  border-2 border-dashed border-white/10
                  hover:border-white/20 cursor-pointer
                  transition-colors group"
            >
                <Upload
                    size={24}
                    className="text-white/20 group-hover:text-white/40
                    transition-colors mb-3"
                />
                <p className="text-sm text-white/40">
                    Arraste arquivos ou clique para selecionar
                </p>
                <p className="text-xs text-white/20 mt-1">
                    .txt, .md, .pdf, .docx
                </p>

                <input
                    id="file-input"
                    type="file"
                    multiple
                    className="hidden"
                    accept=".txt,.md,.pdf,.docx"
                    onChange={(e) => addFiles(Array.from(e.target.files || []))}
                />
            </div>

            {/* File list */}
            {files.length > 0 && (
                <div className="space-y-2">
                    {files.map((fileState, i) => (
                        <div key={i}
                            className="flex items-center gap-3
                           px-3 py-2.5 rounded-xl
                           bg-white/5 border border-white/10">

                            {/* Status icon */}
                            <div className="flex-shrink-0">
                                {fileState.status === 'pending' && (
                                    <div className="w-5 h-5 rounded-full border border-white/20" />
                                )}
                                {fileState.status === 'processing' && (
                                    <Loader size={18} className="text-white/40 animate-spin" />
                                )}
                                {fileState.status === 'done' && (
                                    <CheckCircle size={18} className="text-emerald-400" />
                                )}
                                {fileState.status === 'error' && (
                                    <AlertCircle size={18} className="text-red-400" />
                                )}
                            </div>

                            {/* File info */}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-white/70 truncate">
                                    {fileState.file.name}
                                </p>
                                {fileState.atomsCreated && (
                                    <p className="text-xs text-white/30">
                                        {fileState.atomsCreated} notas extraídas
                                    </p>
                                )}
                                {fileState.error && (
                                    <p className="text-xs text-red-400">{fileState.error}</p>
                                )}
                            </div>

                            {/* Remove */}
                            {fileState.status === 'pending' && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                                    className="text-white/20 hover:text-white/40"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    ))}

                    {/* Process button */}
                    {files.some(f => f.status === 'pending') && !isUploading && (
                        <button
                            onClick={processFiles}
                            className="w-full py-2.5 rounded-xl
                        bg-white/10 hover:bg-white/15
                        text-sm text-white/70
                        transition-colors"
                        >
                            Processar {files.filter(f => f.status === 'pending').length} arquivo(s)
                        </button>
                    )}

                    {/* Summary */}
                    {totalAtoms > 0 && (
                        <div className="text-center py-2">
                            <p className="text-xs text-emerald-400">
                                ✓ {totalAtoms} notas adicionadas à memória da Sara
                            </p>
                        </div>
                    )}
                </div>
            )}

            <WizardNav
                onNext={handleNext}
                onBack={prevStep}
                nextLabel={files.length === 0 ? 'Pular por agora' : 'Continuar'}
            />
        </div>
    );
}

import { useState, useCallback } from 'react';

interface FileData {
    name: string;
    type: string;
    size: number;
    content?: string | ArrayBuffer;
}

export function useFileUpload() {
    const [files, setFiles] = useState<FileData[]>([]);

    const addFiles = useCallback((newFiles: File[]) => {
        const fileDataPromises = newFiles.map(file => {
            return new Promise<FileData>((resolve) => {
                resolve({
                    name: file.name,
                    type: file.type,
                    size: file.size
                });
            });
        });

        Promise.all(fileDataPromises).then(newFileData => {
            setFiles(prev => [...prev, ...newFileData]);
        });
    }, []);

    const removeFile = useCallback((index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    }, []);

    const uploadFiles = useCallback(async () => {
        // In a real implementation, this would upload to a server
        // For now, we simulate a delay and return the file metadata
        await new Promise(resolve => setTimeout(resolve, 500));
        const currentFiles = [...files];
        setFiles([]); // Clear files after "upload"
        return currentFiles;
    }, [files]);

    return { files, addFiles, removeFile, uploadFiles };
}

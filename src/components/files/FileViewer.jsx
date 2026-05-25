import { useEffect, useMemo, useState } from 'react';
import {
    Button,
    Modal,
    ModalBody,
    ModalContent,
    ModalHeader,
    Spinner,
    Tooltip,
} from '@heroui/react';
import { RiCloseLine, RiDownload2Line } from 'react-icons/ri';
import ky from 'ky';
import toast from 'react-hot-toast';

const TEXT_PREVIEW_LIMIT = 20000;

function FileViewer({
    isOpen,
    onOpenChange,
    name,
    type,
    url,
    isDownloading,
    onDownloadingChange,
}) {
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);
    const [previewText, setPreviewText] = useState('');

    const filename = useMemo(() => {
        if (!url) return '';
        return url.split('/').pop() || '';
    }, [url]);

    const previewUrl = useMemo(() => {
        if (!filename) return null;
        return `/api/files?filename=${encodeURIComponent(filename)}`;
    }, [filename]);

    const normalizedType = String(type || '').toLowerCase();
    const isImage =
        normalizedType.includes('image') ||
        normalizedType.includes('png') ||
        normalizedType.includes('jpg') ||
        normalizedType.includes('jpeg') ||
        normalizedType.includes('gif');
    const isPdf = normalizedType.includes('pdf');
    const isVideo = normalizedType.includes('video');
    const isAudio = normalizedType.includes('audio') || normalizedType.includes('music');
    const isText =
        normalizedType.includes('text') ||
        normalizedType.includes('json') ||
        normalizedType.includes('xml') ||
        normalizedType.includes('csv') ||
        normalizedType.includes('markdown');
    const supportsPreview = isImage || isPdf || isVideo || isAudio || isText;

    const handleClose = () => onOpenChange(false);

    const handleDownload = async () => {
        if (!onDownloadingChange) return;
        onDownloadingChange(true);
        try {
            if (!filename) throw new Error('File URL is invalid.');

            const response = await ky
                .get(`/api/files?filename=${encodeURIComponent(filename)}`, {
                    timeout: 30000,
                })
                .blob();

            const blobUrl = URL.createObjectURL(response);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = name || filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        } catch (error) {
            console.error('Error downloading file:', error);
            toast.error('No se pudo descargar el archivo');
        } finally {
            onDownloadingChange(false);
        }
    };

    useEffect(() => {
        if (!isOpen) {
            setPreviewText('');
            setIsPreviewLoading(false);
            return;
        }
        if (!isText || !previewUrl) return;

        let isActive = true;
        const controller = new AbortController();

        setIsPreviewLoading(true);
        fetch(previewUrl, { signal: controller.signal })
            .then((response) => response.text())
            .then((text) => {
                if (!isActive) return;
                setPreviewText(text.slice(0, TEXT_PREVIEW_LIMIT));
            })
            .catch((error) => {
                if (!isActive || error.name === 'AbortError') return;
                console.error('Error loading text preview:', error);
                toast.error('No se pudo cargar la vista previa');
            })
            .finally(() => {
                if (isActive) setIsPreviewLoading(false);
            });

        return () => {
            isActive = false;
            controller.abort();
        };
    }, [isOpen, isText, previewUrl]);

    return (
        <Modal
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            size="full"
            hideCloseButton
            classNames={{ base: 'bg-black/90 text-white' }}
        >
            <ModalContent>
                <ModalHeader className="flex items-center justify-between gap-4 border-b border-white/10">
                    <div className="min-w-0">
                        <p className="truncate text-base font-semibold">{name || 'Archivo'}</p>
                        <p className="text-xs text-white/60">{type || 'Tipo desconocido'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            color="primary"
                            onPress={handleDownload}
                            isLoading={isDownloading}
                            startContent={<RiDownload2Line />}
                        >
                            Descargar
                        </Button>
                        <Tooltip content="Cerrar">
                            <Button size="sm" variant="flat" isIconOnly onPress={handleClose}>
                                <RiCloseLine className="text-lg" />
                            </Button>
                        </Tooltip>
                    </div>
                </ModalHeader>
                <ModalBody className="p-6">
                    <div className="flex min-h-[70vh] items-center justify-center">
                        {!supportsPreview && (
                            <div className="max-w-md text-center">
                                <p className="text-lg font-semibold">Vista previa no disponible</p>
                                <p className="mt-2 text-sm text-white/70">
                                    Este archivo no tiene vista previa. Descárgalo para abrirlo en
                                    tu equipo.
                                </p>
                            </div>
                        )}
                        {supportsPreview && isImage && previewUrl && (
                            <img
                                src={previewUrl}
                                alt={name}
                                className="max-h-[78vh] max-w-full rounded-lg"
                            />
                        )}
                        {supportsPreview && isPdf && previewUrl && (
                            <iframe
                                title={name}
                                src={previewUrl}
                                className="h-[78vh] w-full rounded-lg border border-white/10 bg-black"
                            />
                        )}
                        {supportsPreview && isVideo && previewUrl && (
                            <video controls className="h-[78vh] w-full rounded-lg bg-black">
                                <source src={previewUrl} type={type || 'video/mp4'} />
                            </video>
                        )}
                        {supportsPreview && isAudio && previewUrl && (
                            <div className="w-full max-w-2xl rounded-lg bg-white/10 p-6">
                                <audio controls className="w-full">
                                    <source src={previewUrl} type={type || 'audio/mpeg'} />
                                </audio>
                            </div>
                        )}
                        {supportsPreview && isText && (
                            <div className="h-[78vh] w-full max-w-4xl overflow-auto rounded-lg border border-white/10 bg-black/60 p-5">
                                {isPreviewLoading && (
                                    <div className="flex items-center gap-2 text-sm text-white/70">
                                        <Spinner size="sm" />
                                        Cargando vista previa...
                                    </div>
                                )}
                                {!isPreviewLoading && previewText && (
                                    <pre className="whitespace-pre-wrap text-xs text-white/80">
                                        {previewText}
                                    </pre>
                                )}
                            </div>
                        )}
                    </div>
                </ModalBody>
            </ModalContent>
        </Modal>
    );
}

export default FileViewer;

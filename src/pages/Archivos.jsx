import { useCallback, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Button,
    Chip,
    Input,
    Modal,
    ModalBody,
    ModalContent,
    ModalFooter,
    ModalHeader,
    Spinner,
    Tooltip,
} from '@heroui/react';
import { useDropzone } from 'react-dropzone';
import {
    RiDeleteBinLine,
    RiDownload2Line,
    RiEdit2Line,
    RiEyeLine,
    RiFile2Line,
    RiFileExcel2Line,
    RiFileImageLine,
    RiFileMusicLine,
    RiFilePdf2Line,
    RiFileTextLine,
    RiFileVideoLine,
    RiUploadCloud2Line,
    RiUploadLine,
} from 'react-icons/ri';
import ky from 'ky';
import toast from 'react-hot-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AppLayout from '../components/layout/AppLayout.jsx';
import PageLayout from '../components/layout/PageLayout.jsx';
import useCurrentWorkspace from '../hooks/useCurrentWorkspace.js';
import { useUser } from '../hooks/react-query/user/useUser.js';
import { supabaseClient } from '../lib/supabase.js';
import {
    useAttachments,
    useDeleteAttachment,
    useRenameAttachment,
} from '../hooks/react-query/attachments/useAttachments.js';
import FileViewer from '../components/files/FileViewer.jsx';

function getFilenameFromUrl(url) {
    if (!url) return '';
    return url.split('/').pop() || '';
}

function getFileIcon(type) {
    const iconClassName = 'text-base';
    const normalizedType = String(type || '').toLowerCase();

    if (normalizedType.includes('pdf')) {
        return <RiFilePdf2Line className={`${iconClassName} text-danger`} />;
    }
    if (normalizedType.includes('excel') || normalizedType.includes('spreadsheet')) {
        return <RiFileExcel2Line className={`${iconClassName} text-success`} />;
    }
    if (normalizedType.includes('image')) {
        return <RiFileImageLine className={`${iconClassName} text-primary`} />;
    }
    if (normalizedType.includes('video')) {
        return <RiFileVideoLine className={`${iconClassName} text-secondary`} />;
    }
    if (normalizedType.includes('audio')) {
        return <RiFileMusicLine className={`${iconClassName} text-warning`} />;
    }
    if (normalizedType.includes('text') || normalizedType.includes('json')) {
        return <RiFileTextLine className={`${iconClassName} text-default-500`} />;
    }

    return <RiFile2Line className={`${iconClassName} text-default-500`} />;
}

function isImageType(type) {
    const normalizedType = String(type || '').toLowerCase();
    return (
        normalizedType.includes('image') ||
        normalizedType.includes('png') ||
        normalizedType.includes('jpg') ||
        normalizedType.includes('jpeg') ||
        normalizedType.includes('gif') ||
        normalizedType.includes('webp')
    );
}

function formatSize(size) {
    if (!size || Number.isNaN(Number(size))) return '—';
    const bytes = Number(size);
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function ArchivosPage() {
    const { data: user } = useUser();
    const [currentWorkspace] = useCurrentWorkspace();
    const condoId = currentWorkspace?.condo_id || currentWorkspace?.workspace_id;
    const queryClient = useQueryClient();
    const fileInputRef = useRef(null);

    const [downloadInProgressId, setDownloadInProgressId] = useState(null);
    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerFile, setViewerFile] = useState(null);
    const [renameModalOpen, setRenameModalOpen] = useState(false);
    const [renameValue, setRenameValue] = useState('');
    const [fileToRename, setFileToRename] = useState(null);
    const [fileToDelete, setFileToDelete] = useState(null);
    const [fileToReplace, setFileToReplace] = useState(null);

    const { data: files = [], isPending } = useAttachments(condoId);
    const { mutateAsync: renameFile, isPending: isRenaming } = useRenameAttachment(condoId);
    const { mutateAsync: deleteFile, isPending: isDeleting } = useDeleteAttachment();

    const { data: currentMember } = useQuery({
        queryKey: ['condoMember', condoId, user?.id],
        queryFn: async () => {
            const { data, error } = await supabaseClient
                .from('condo_members')
                .select('role')
                .eq('condo_id', condoId)
                .eq('user_id', user?.id)
                .maybeSingle();
            if (error) throw new Error('Failed to fetch user role');
            return data;
        },
        enabled: !!condoId && !!user?.id,
        staleTime: 1000 * 60 * 5,
    });

    const canManageFiles = currentMember?.role === 'admin' || currentMember?.role === 'owner';

    const uploadMutation = useMutation({
        mutationFn: async (acceptedFiles) => {
            for (const file of acceptedFiles) {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('condo_id', condoId);
                await ky.post('/api/files', { body: formData, timeout: 30000 });
            }
        },
        onSuccess: async () => {
            toast.success('Archivo(s) subido(s)');
            await queryClient.invalidateQueries({ queryKey: ['files', condoId] });
        },
        onError: (error) => {
            const message = error?.message || 'No se pudo subir el archivo';
            toast.error(message);
        },
    });

    const onDrop = useCallback(
        (acceptedFiles) => {
            if (!canManageFiles) return;
            if (!condoId) {
                toast.error('No se encontró el condominio');
                return;
            }
            if (!acceptedFiles.length) return;
            uploadMutation.mutate(acceptedFiles);
        },
        [canManageFiles, condoId, uploadMutation],
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        multiple: true,
        maxSize: 25 * 1024 * 1024,
        onDropRejected: () => {
            toast.error('Archivo inválido o demasiado grande (máximo 25MB)');
        },
    });

    const sortedFiles = useMemo(() => {
        return [...files].sort((a, b) => {
            const dateA = new Date(a.updated_at || a.created_at || 0);
            const dateB = new Date(b.updated_at || b.created_at || 0);
            return dateB - dateA;
        });
    }, [files]);

    const handlePreview = (file) => {
        setViewerFile(file);
        setViewerOpen(true);
    };

    const handleDownload = async (file) => {
        const filename = getFilenameFromUrl(file?.url);
        if (!filename) {
            toast.error('URL de archivo inválida');
            return;
        }

        setDownloadInProgressId(file.id);
        try {
            const blob = await ky
                .get(`/api/files?filename=${encodeURIComponent(filename)}`, {
                    timeout: 30000,
                })
                .blob();

            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = file?.name || filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        } catch (error) {
            console.error('Error downloading file:', error);
            toast.error('No se pudo descargar el archivo');
        } finally {
            setDownloadInProgressId(null);
        }
    };

    const handleOpenRename = (file) => {
        setFileToRename(file);
        setRenameValue(file?.name || '');
        setRenameModalOpen(true);
    };

    const handleRename = async () => {
        if (!fileToRename?.id || !renameValue.trim()) {
            toast.error('Nombre inválido');
            return;
        }

        try {
            await renameFile({
                attachmentId: fileToRename.id,
                condoId,
                name: renameValue.trim(),
            });
            toast.success('Archivo actualizado');
            setRenameModalOpen(false);
            setFileToRename(null);
            setRenameValue('');
        } catch (error) {
            toast.error(error?.message || 'No se pudo actualizar el nombre');
        }
    };

    const handleDelete = async () => {
        if (!fileToDelete) return;
        try {
            await deleteFile({ attachmentId: fileToDelete.id, url: fileToDelete.url, condoId });
            toast.success('Archivo eliminado');
            setFileToDelete(null);
        } catch (error) {
            toast.error(error?.message || 'No se pudo eliminar el archivo');
        }
    };

    const handleOpenReplace = (file) => {
        setFileToReplace(file);
        fileInputRef.current?.click();
    };

    const handleReplace = async (newFile) => {
        if (!fileToReplace || !newFile) return;

        try {
            const formData = new FormData();
            formData.append('file', newFile);
            formData.append('condo_id', condoId);
            await ky.post('/api/files', { body: formData, timeout: 30000 });

            await deleteFile({ attachmentId: fileToReplace.id, url: fileToReplace.url, condoId });
            toast.success('Archivo reemplazado');
        } catch (error) {
            toast.error(error?.message || 'No se pudo reemplazar el archivo');
        } finally {
            setFileToReplace(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <AppLayout>
            <PageLayout
                title="Archivos"
                description={
                    canManageFiles
                        ? 'Sube, actualiza y gestiona archivos de la comunidad'
                        : 'Consulta y descarga archivos compartidos'
                }
                maxW="4xl"
            >
                <div className="flex flex-col gap-4">
                    {canManageFiles && (
                        <div
                            {...getRootProps()}
                            className={`rounded-xl border-2 border-dashed p-6 transition-colors cursor-pointer ${
                                isDragActive
                                    ? 'border-primary bg-primary-50/20'
                                    : 'border-default-200 bg-content1 hover:bg-content2'
                            }`}
                        >
                            <input {...getInputProps()} />
                            <div className="flex items-center gap-3">
                                <RiUploadCloud2Line className="text-2xl text-primary" />
                                <div className="flex-1">
                                    <p className="font-medium">
                                        {isDragActive
                                            ? 'Suelta los archivos aquí'
                                            : 'Arrastra archivos o haz clic para subir'}
                                    </p>
                                    <p className="text-sm text-default-500">
                                        Máximo 25MB por archivo
                                    </p>
                                </div>
                                <Button
                                    color="primary"
                                    startContent={<RiUploadLine />}
                                    isLoading={uploadMutation.isPending}
                                >
                                    Subir
                                </Button>
                            </div>
                        </div>
                    )}
                    {isPending && (
                        <div className="min-h-44 rounded-xl border border-default-200 bg-content1 flex items-center justify-center">
                            <Spinner label="Cargando archivos..." />
                        </div>
                    )}
                    {!isPending && sortedFiles.length === 0 && (
                        <div className="min-h-44 rounded-xl border border-default-200 bg-content1 flex items-center justify-center text-default-500">
                            No hay archivos disponibles.
                        </div>
                    )}
                    {!isPending && sortedFiles.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {sortedFiles.map((item) => {
                                const filename = getFilenameFromUrl(item?.url);
                                const previewUrl = filename
                                    ? `/api/files?filename=${encodeURIComponent(filename)}`
                                    : null;

                                return (
                                    <div
                                        key={item.id}
                                        className="group rounded-xl border border-default-200 bg-content1 overflow-hidden cursor-pointer transition-all hover:border-primary-200 hover:shadow-sm"
                                        onClick={() => handlePreview(item)}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter' || event.key === ' ') {
                                                event.preventDefault();
                                                handlePreview(item);
                                            }
                                        }}
                                    >
                                        <div className="w-full aspect-[16/10] bg-content2 group-hover:bg-content3 transition-colors flex items-center justify-center overflow-hidden">
                                            {previewUrl && isImageType(item.type) ? (
                                                <img
                                                    src={previewUrl}
                                                    alt={item.name}
                                                    className="h-full w-full object-cover"
                                                />
                                            ) : (
                                                <div className="flex flex-col items-center gap-2 text-default-500">
                                                    <span className="text-4xl">
                                                        {getFileIcon(item.type)}
                                                    </span>
                                                    <span className="text-xs">
                                                        {item.type || 'Archivo'}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="p-3 flex flex-col gap-2">
                                            <p
                                                className="text-sm font-medium line-clamp-2"
                                                title={item.name}
                                            >
                                                {item.name}
                                            </p>
                                            <div className="flex items-center justify-between gap-2">
                                                <Chip size="sm" variant="flat">
                                                    {formatSize(item.size)}
                                                </Chip>
                                                <span className="text-xs text-default-500">
                                                    {new Date(
                                                        item.updated_at || item.created_at,
                                                    ).toLocaleDateString('es-MX')}
                                                </span>
                                            </div>
                                            {canManageFiles && (
                                                <div
                                                    className="flex items-center gap-1 pt-1"
                                                    onClick={(event) => event.stopPropagation()}
                                                >
                                                    <Tooltip content="Ver archivo">
                                                        <Button
                                                            isIconOnly
                                                            variant="light"
                                                            size="sm"
                                                            onPress={() => handlePreview(item)}
                                                        >
                                                            <RiEyeLine />
                                                        </Button>
                                                    </Tooltip>
                                                    <Tooltip content="Descargar">
                                                        <Button
                                                            isIconOnly
                                                            variant="light"
                                                            size="sm"
                                                            onPress={() => handleDownload(item)}
                                                            isLoading={
                                                                downloadInProgressId === item.id
                                                            }
                                                        >
                                                            <RiDownload2Line />
                                                        </Button>
                                                    </Tooltip>
                                                    <Tooltip content="Renombrar">
                                                        <Button
                                                            isIconOnly
                                                            variant="light"
                                                            size="sm"
                                                            onPress={() => handleOpenRename(item)}
                                                        >
                                                            <RiEdit2Line />
                                                        </Button>
                                                    </Tooltip>
                                                    <Tooltip content="Reemplazar">
                                                        <Button
                                                            isIconOnly
                                                            variant="light"
                                                            size="sm"
                                                            onPress={() => handleOpenReplace(item)}
                                                        >
                                                            <RiUploadLine />
                                                        </Button>
                                                    </Tooltip>
                                                    <Tooltip content="Eliminar">
                                                        <Button
                                                            isIconOnly
                                                            variant="light"
                                                            color="danger"
                                                            size="sm"
                                                            onPress={() => setFileToDelete(item)}
                                                        >
                                                            <RiDeleteBinLine />
                                                        </Button>
                                                    </Tooltip>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </PageLayout>

            <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(event) => {
                    const nextFile = event.target.files?.[0] || null;
                    if (nextFile) handleReplace(nextFile);
                }}
            />

            <Modal isOpen={renameModalOpen} onOpenChange={setRenameModalOpen}>
                <ModalContent>
                    <ModalHeader>Renombrar archivo</ModalHeader>
                    <ModalBody>
                        <Input
                            autoFocus
                            label="Nombre"
                            value={renameValue}
                            onChange={(event) => setRenameValue(event.target.value)}
                        />
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="light" onPress={() => setRenameModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button color="primary" onPress={handleRename} isLoading={isRenaming}>
                            Guardar
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            <Modal isOpen={!!fileToDelete} onOpenChange={() => setFileToDelete(null)}>
                <ModalContent>
                    <ModalHeader>Eliminar archivo</ModalHeader>
                    <ModalBody>
                        ¿Seguro que quieres eliminar <strong>{fileToDelete?.name}</strong>?
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="light" onPress={() => setFileToDelete(null)}>
                            Cancelar
                        </Button>
                        <Button color="danger" onPress={handleDelete} isLoading={isDeleting}>
                            Eliminar
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            <FileViewer
                isOpen={viewerOpen}
                onOpenChange={setViewerOpen}
                name={viewerFile?.name}
                type={viewerFile?.type}
                url={viewerFile?.url}
                isDownloading={downloadInProgressId === viewerFile?.id}
                onDownloadingChange={(isDownloading) => {
                    if (isDownloading) {
                        setDownloadInProgressId(viewerFile?.id || null);
                    } else {
                        setDownloadInProgressId(null);
                    }
                }}
            />
        </AppLayout>
    );
}

export default ArchivosPage;

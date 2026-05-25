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
    Table,
    TableBody,
    TableCell,
    TableColumn,
    TableHeader,
    TableRow,
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
        return [...files].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    }, [files]);

    const columns = useMemo(
        () => [
            { key: 'name', label: 'Archivo' },
            { key: 'type', label: 'Tipo' },
            { key: 'size', label: 'Tamaño' },
            { key: 'updated_at', label: 'Actualizado' },
            { key: 'actions', label: 'Acciones' },
        ],
        [],
    );

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

                    {!canManageFiles && (
                        <Alert
                            color="default"
                            description="Tu rol solo permite ver y descargar archivos."
                        />
                    )}

                    <div className="rounded-xl border border-default-200 bg-content1">
                        <Table aria-label="Tabla de archivos">
                            <TableHeader columns={columns}>
                                {(column) => <TableColumn key={column.key}>{column.label}</TableColumn>}
                            </TableHeader>
                            <TableBody
                                isLoading={isPending}
                                loadingContent={<Spinner label="Cargando archivos..." />}
                                emptyContent="No hay archivos disponibles."
                                items={sortedFiles}
                            >
                                {(item) => (
                                    <TableRow key={item.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {getFileIcon(item.type)}
                                                <span className="max-w-[280px] truncate">
                                                    {item.name}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Chip size="sm" variant="flat">
                                                {item.type || 'Desconocido'}
                                            </Chip>
                                        </TableCell>
                                        <TableCell>{formatSize(item.size)}</TableCell>
                                        <TableCell>
                                            {item.updated_at
                                                ? new Date(item.updated_at).toLocaleString('es-MX')
                                                : '—'}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
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
                                                        isLoading={downloadInProgressId === item.id}
                                                    >
                                                        <RiDownload2Line />
                                                    </Button>
                                                </Tooltip>
                                                {canManageFiles && (
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
                                                )}
                                                {canManageFiles && (
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
                                                )}
                                                {canManageFiles && (
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
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
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

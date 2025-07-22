import {
    Card,
    CardHeader,
    CardBody,
    CardFooter,
    Button,
    Chip,
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    useDisclosure,
    Image,
    Divider,
    Spinner,
    Skeleton,
} from '@heroui/react';
import { RiShutDownLine, RiEqualizer3Fill, RiLoginCircleLine } from 'react-icons/ri';

function IntegrationCard({
    id,
    icon,
    name,
    description,
    status,
    isLoading,
    isPending,
    onConnect,
    onDisconnect,
    onReset,
    hasConfigOptions,
    onConfigure,
    isCompact,
}) {
    const BTN_ICON_SIZE = '1rem';

    // Modal for disconnect confirmation
    const {
        isOpen: isDisconnectModalOpen,
        onOpen: onDisconnectModalOpen,
        onClose: onDisconnectModalClose,
    } = useDisclosure();

    // Handle connect action
    const handleConnect = () => {
        onConnect();
    };

    // Handle disconnect action
    const handleDisconnect = () => {
        onDisconnectModalOpen();
    };

    // Handle configure action
    const handleConfigure = () => {
        onConfigure();
    };

    // Handle error action
    const handleError = () => {
        onReset();
    };

    // Determine status chip color
    const getStatusChipColor = () => {
        switch (status) {
            case 'active':
                return 'success';
            case 'error':
                return 'danger';
            case 'soon':
                return 'primary';
            default:
                return 'default';
        }
    };

    const getActions = () => {
        switch (status) {
            case 'active':
                return (
                    <>
                        {hasConfigOptions && (
                            <Button
                                size="sm"
                                variant="light"
                                onPress={handleConfigure}
                                startContent={<RiEqualizer3Fill fontSize={BTN_ICON_SIZE} />}
                            >
                                Configure
                            </Button>
                        )}
                        <Button
                            size="sm"
                            variant="light"
                            color="danger"
                            onPress={handleDisconnect}
                            startContent={<RiShutDownLine fontSize={BTN_ICON_SIZE} />}
                            isDisabled={isLoading}
                        >
                            Disconnect
                        </Button>
                    </>
                );
            case 'error':
                return (
                    <Button
                        size="sm"
                        variant="flat"
                        onPress={handleError}
                        startContent={<RiShutDownLine fontSize={BTN_ICON_SIZE} />}
                        isDisabled={isLoading}
                    >
                        Reconnect
                    </Button>
                );
            case 'soon':
                return <></>;
            default:
                return (
                    <Button
                        variant="flat"
                        size="sm"
                        onPress={handleConnect}
                        startContent={<RiLoginCircleLine fontSize={BTN_ICON_SIZE} />}
                        isLoading={isLoading}
                    >
                        Connect
                    </Button>
                );
        }
    };

    return (
        <>
            <Card shadow="sm" className="w-full p-1">
                <CardHeader className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="text-2xl">
                            {id === 'github' ? (
                                icon
                            ) : (
                                <Image alt="logo" src={`/integrations/${id}.png`} width={32} />
                            )}
                        </div>
                        <h3 className="text-lg font-semibold">{name}</h3>
                    </div>
                    {isLoading ? (
                        <Spinner size="sm" color="default" variant="wave" aria-label="loading" />
                    ) : (
                        <>
                            {status !== 'inactive' && (
                                <Skeleton isLoaded={!isPending}>
                                    <Chip variant="flat" color={getStatusChipColor()} size="sm">
                                        {status?.toLocaleString()}
                                    </Chip>
                                </Skeleton>
                            )}
                            {isCompact && (
                                <div className="flex items-center gap-2">{getActions()}</div>
                            )}
                        </>
                    )}
                </CardHeader>
                {!isCompact && (
                    <CardBody className="py-3">
                        <Skeleton isLoaded={!isPending}>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 ">
                                {description}
                            </p>
                        </Skeleton>
                    </CardBody>
                )}
                {status !== 'soon' && !isCompact && (
                    <>
                        <Divider />
                        <CardFooter className="flex justify-end gap-2 pt-4">
                            {getActions()}
                        </CardFooter>
                    </>
                )}
            </Card>
            {/* Disconnect Confirmation Dialog */}
            <Modal isOpen={isDisconnectModalOpen} onClose={onDisconnectModalClose}>
                <ModalContent>
                    <ModalHeader>Disconnect integration</ModalHeader>
                    <ModalBody>
                        <p>Are you sure you want to disconnect from {name}?</p>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="light" onPress={onDisconnectModalClose}>
                            Cancel
                        </Button>
                        <Button
                            color="danger"
                            onPress={() => {
                                if (onDisconnect) {
                                    onDisconnect();
                                }
                                onDisconnectModalClose();
                            }}
                        >
                            Disconnect
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </>
    );
}

export default IntegrationCard;

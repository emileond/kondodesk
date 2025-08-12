import { Button, Image } from '@heroui/react';
import { useTheme } from '@heroui/use-theme';

function EmptyState({
    title = 'No items',
    description = 'Create a new item',
    img,
    primaryAction,
    customElements,
    onClick,
}) {
    const { theme } = useTheme();

    const imageSrc = `/empty-states/${theme.includes('dark') ? 'dark' : 'light'}/${img || 'empty'}.svg`;

    const handleOnClick = () => {
        if (onClick) {
            onClick();
        }
    };
    return (
        <div className="h-full p-6 flex flex-col items-center justify-center gap-3">
            <Image src={imageSrc} width={260} height={260} alt="Empty state illustration" />
            <div className="text-center space-y-2">
                <h2 className="text-xl font-semibold">{title}</h2>
                <p className="text-default-500">{description}</p>
            </div>
            <div className="flex gap-3">
                {customElements}
                {primaryAction && (
                    <Button onPress={handleOnClick} color="primary" variant="flat">
                        {primaryAction}
                    </Button>
                )}
            </div>
        </div>
    );
}

export default EmptyState;

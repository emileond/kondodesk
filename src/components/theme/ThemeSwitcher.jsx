import { Card, CardBody, CardHeader } from '@heroui/react';
import { useTheme } from '@heroui/use-theme';
import { RiPaintBrushLine, RiCheckLine } from 'react-icons/ri';
import { useMemo } from 'react';

// A small, reusable component to display a preview of each theme
const ThemePreviewCard = ({ themeInfo, isSelected, onSelect }) => {
    // Defines the styles for the preview cards
    const previewStyles = {
        light: {
            bg: 'bg-white',
            primary: 'bg-[#735587]',
            secondary: 'bg-[#5bc0be]',
            default400: 'bg-[#b4afa8]',
            default300: 'bg-[#d7d3d0]',
            border: isSelected ? 'border-primary' : 'border-default-200',
        },
        latte: {
            bg: 'bg-[#fdfaf9]',
            primary: 'bg-[#725cad]',
            secondary: 'bg-[#ef7d8e]',
            default400: 'bg-[#a8a29e]',
            default300: 'bg-[#d6d3d1]',
            border: isSelected ? 'border-primary' : 'border-default-200',
        },
        nord: {
            bg: 'bg-[#f2f4f8]',
            primary: 'bg-[#725cad]',
            secondary: 'bg-[#90b1ca]',
            default400: 'bg-[#94a3b8]',
            default300: 'bg-[#cbd5e1]',
            border: isSelected ? 'border-primary' : 'border-default-200',
        },
        dark: {
            bg: 'bg-[#030712]',
            primary: 'bg-[#725cad]',
            secondary: 'bg-[#5bc0be]',
            default400: 'bg-[#1f2937]', // 600 for dark themes
            default300: 'bg-[#374151]', // 500 for dark themes
            border: isSelected ? 'border-rose-500' : 'border-slate-700',
        },
        'synth-dark': {
            bg: 'bg-[#09002f]',
            primary: 'bg-[#795ace]',
            secondary: 'bg-[#5bc0be]',
            default400: 'bg-[#475569]',
            default300: 'bg-[#334155]',
            border: isSelected ? 'border-rose-500' : 'border-slate-700',
        },
        'sunset-dark': {
            bg: 'bg-[#182026]',
            primary: 'bg-[#ef7d8e]',
            secondary: 'bg-[#725cad]',
            default400: 'bg-[#454c5c]',
            default300: 'bg-[#2f3540]',
            border: isSelected ? 'border-rose-500' : 'border-slate-700',
        },
    };

    const styles = previewStyles[themeInfo.key];

    return (
        <div
            className="flex flex-col items-center cursor-pointer"
            onClick={() => onSelect(themeInfo.key)}
        >
            {/* The visual preview card */}
            <div
                className={`relative w-32 h-20 rounded-lg border-2 p-2 transition-all ${styles.border} ${styles.bg}`}
            >
                <div className="flex items-center gap-1">
                    <div className={`w-4 h-4 rounded-full ${styles.secondary}`}></div>
                    <div className={`w-full h-2 rounded-sm ${styles.primary}`}></div>
                </div>
                <div className={`w-10/12 h-2 mt-2 rounded-sm ${styles.default400}`}></div>
                <div className={`w-8/12 h-2 mt-1 rounded-sm ${styles.default300}`}></div>

                {/* Checkmark for the selected theme */}
                {isSelected && (
                    <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                        <RiCheckLine size={14} />
                    </div>
                )}
            </div>
            <p className="text-center text-sm mt-2">{themeInfo.label}</p>
        </div>
    );
};

// The main ThemeSwitcher component
export default function ThemeSwitcher({ isOnboarding }) {
    const { theme, setTheme } = useTheme();

    const themeOptions = useMemo(
        () => [
            { key: 'light', label: 'Classic Light' },
            { key: 'latte', label: 'Latte' },
            { key: 'nord', label: 'Nord' },
            { key: 'dark', label: 'Classic Dark' },
            { key: 'synth-dark', label: 'Synthwave' },
            { key: 'sunset-dark', label: 'Sunset' },
        ],
        [],
    );

    return (
        <Card shadow="none">
            <CardHeader>
                {!isOnboarding && (
                    <div>
                        <div className="flex items-center gap-1 mb-2">
                            <RiPaintBrushLine fontSize="1.2rem" />
                            <p className="text-lg font-medium">Theme</p>
                        </div>
                        <p className="text-sm text-default-500">
                            Customize the look and feel of the app
                        </p>
                    </div>
                )}
            </CardHeader>
            <CardBody className="p-4 max-w-lg">
                {/* The gallery of theme previews */}
                <div className="flex justify-center gap-4 flex-wrap">
                    {themeOptions.map((opt) => (
                        <ThemePreviewCard
                            key={opt.key}
                            themeInfo={opt}
                            isSelected={theme === opt.key}
                            onSelect={setTheme}
                        />
                    ))}
                </div>
            </CardBody>
        </Card>
    );
}

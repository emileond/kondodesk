import { Popover, PopoverTrigger, PopoverContent, Button } from '@heroui/react';
import { BlockPicker } from 'react-color';
import { useState } from 'react';

const ColorPicker = ({ value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);

    const handleColorChange = (color) => {
        if (onChange) {
            onChange(color.hex);
        }
        setIsOpen(false); // Close the popover after selection
    };

    return (
        <Popover placement="bottom" isOpen={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger>
                <Button
                    isIconOnly
                    size="sm"
                    className="w-8 h-8 rounded-full border-2 border-default-200"
                    style={{ backgroundColor: value || '#cccccc' }}
                    onPress={() => setIsOpen(true)}
                />
            </PopoverTrigger>
            <PopoverContent className="p-0">
                <BlockPicker
                    color={value}
                    onChangeComplete={handleColorChange}
                    colors={[
                        '#bab8e9',
                        '#ade2df',
                        '#facecf',
                        '#99C7FB',
                        '#D7F8FE',
                        '#d9f99d',
                        '#FBDBA7',
                        '#FAA0BF',
                        '#E4E4E7',
                    ]}
                />
            </PopoverContent>
        </Popover>
    );
};

export default ColorPicker;

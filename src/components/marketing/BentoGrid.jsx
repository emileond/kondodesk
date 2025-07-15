import { cn } from '../../lib/utils.js';
import { Card, CardBody, CardHeader } from '@heroui/react';

const BentoGrid = ({ children, className, ...props }) => {
    return (
        <div
            className={cn('grid w-full auto-rows-[22rem] grid-cols-3 gap-4', className)}
            {...props}
        >
            {children}
        </div>
    );
};

const BentoCard = ({ name, className, background, Icon, description, href, cta, ...props }) => (
    <Card key={name} className={cn('group col-span-3', className)} {...props}>
        <CardBody className="w-full h-2/3 p-2">
            <div className="bg-primary-50 flex items-center justify-center rounded-3xl w-full h-full">
                <div className="bg-primary-200 rounded-full p-6">
                    {Icon && (
                        <Icon className="w-16 h-16 shadow-primary-600 shadow-lg p-3 bg-primary-50 rounded-3xl text-primary" />
                    )}
                </div>
            </div>
        </CardBody>

        <CardHeader className="flex flex-col h-1/3   justify-center items-start">
            <h3 className="mt-2 text-lg font-semibold text-default-700">{name}</h3>
            <p className="max-w-lg text-sm font-medium text-default-500">{description}</p>
        </CardHeader>

        <div className="pointer-events-none absolute inset-0 transform-gpu transition-all duration-300 group-hover:bg-primary/[.1]" />
    </Card>
);

export { BentoCard, BentoGrid };

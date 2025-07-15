import { cn } from '../../lib/utils.js';

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
    <div
        key={name}
        className={cn(
            'group relative col-span-3 flex flex-col justify-end overflow-hidden rounded-xl',
            // light styles
            'bg-background [box-shadow:0_0_0_1px_rgba(0,0,0,.03),0_2px_4px_rgba(0,0,0,.05),0_12px_24px_rgba(0,0,0,.05)]',
            // dark styles
            'transform-gpu dark:bg-background dark:[border:1px_solid_rgba(255,255,255,.1)] dark:[box-shadow:0_-20px_80px_-20px_#ffffff1f_inset]',
            className,
        )}
        {...props}
    >
        {/* Background Layer (z-0) */}
        <div className="absolute inset-0 z-0 h-full w-full">{background}</div>

        {/* NEW: Gradient Overlay (z-5) */}
        {/* This sits on top of the background and below the text for readability. */}
        <div className="pointer-events-none absolute inset-0 z-5 bg-gradient-to-t from-content2/90 from-30% to-content1/20" />

        {/* Content Layer (z-10) */}
        <div className="pointer-events-none z-10 flex transform-gpu flex-col gap-1 p-6 transition-all duration-300 group-hover:-translate-y-5">
            <Icon className="h-8 w-8 origin-left transform-gpu text-default-600 transition-all duration-300 ease-in-out group-hover:scale-75" />
            <h3 className="text-xl font-semibold text-default-700">{name}</h3>
            <p className="max-w-lg font-medium text-default-500 opacity-0 transition-all duration-300 group-hover:opacity-100">
                {description}
            </p>
        </div>

        <div className="pointer-events-none absolute inset-0 transform-gpu transition-all duration-300 group-hover:bg-primary/[.1] " />
    </div>
);

export { BentoCard, BentoGrid };

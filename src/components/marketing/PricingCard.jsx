import { Button, Card, CardBody, CardFooter, CardHeader, Chip, Divider } from '@heroui/react';
import { RiCheckFill, RiFireFill } from 'react-icons/ri';
import { Link } from 'react-router-dom';

function PricingCard({
    name = 'Free',
    price = 0,
    yearlyPrice = 0,
    isYearly = true, // Only for subscriptions
    features,
    highlight = false,
    isLTD = false, // The new prop to toggle style
    checkoutUrl, // The pre-constructed checkout URL
}) {
    // Determine the price and period text based on the card type
    let displayPrice;
    let periodText;

    if (isLTD) {
        displayPrice = price; // For LTD, price is the one-time price
        periodText = '/ one-time payment';
    } else {
        displayPrice = isYearly ? Math.round(yearlyPrice / 12) : price;
        periodText = '/ month';
    }

    // Conditional styling for LTD and highlighted plans
    const cardClasses = `grow basis-[200px] max-w-[320px]  flex flex-col ${
        highlight && !isLTD ? 'border-2 border-primary-400/60 ' : ''
    } ${
        isLTD || highlight
            ? 'bg-linear-to-br from-content1 to-primary-50/50 border-2 border-primary-400/60 shadow-lg shadow-primary/20'
            : ''
    }`;

    const buttonVariant = isLTD || highlight ? 'shadow' : 'flat';

    return (
        <Card shadow="md" className={cardClasses}>
            <CardHeader className="flex items-center justify-between gap-3 p-6">
                <h4 className="text-lg font-medium">{name}</h4>
                {isLTD && (
                    <Chip
                        size="sm"
                        color="secondary"
                        variant="flat"
                        className="bg-[#fef2f3] text-[#e44f6a]"
                        startContent={<RiFireFill fontSize="0.9rem" className="mr-1" />}
                    >
                        Lifetime deal
                    </Chip>
                )}
            </CardHeader>
            <Divider />
            <CardBody className="p-6 grow">
                <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">${displayPrice}</span>
                    <span className="text-default-500">{periodText}</span>
                </div>
                {!isLTD && (
                    <p className="text-sm text-default-500 mt-1">
                        Billed {isYearly ? 'yearly' : 'monthly'}
                    </p>
                )}
                <ul className="mt-6 space-y-3">
                    {features?.map((feature, index) => (
                        <li key={index} className="flex items-center gap-3">
                            <RiCheckFill className="text-success text-xl" />
                            <span className="text-sm text-default-600">{feature}</span>
                        </li>
                    ))}
                </ul>
            </CardBody>
            <CardFooter className="py-3 px-6">
                <Button
                    as={Link}
                    to={checkoutUrl}
                    color="primary"
                    variant={buttonVariant}
                    fullWidth
                    size="lg"
                    className="font-medium"
                >
                    {isLTD ? 'Get Lifetime Access' : `Get started`}
                </Button>
            </CardFooter>
        </Card>
    );
}

export default PricingCard;

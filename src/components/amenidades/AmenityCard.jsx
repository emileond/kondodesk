import { Card, CardBody, CardHeader, Button } from '@heroui/react';
import { Link } from 'react-router-dom';
import { RiMoneyDollarCircleLine, RiTimerLine } from 'react-icons/ri';
import useCurrentWorkspace from '../../hooks/useCurrentWorkspace';
import { useAmenityRules } from '../../hooks/react-query/amenities/useAmenities';

function titleCase(str) {
    return str
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

function formatCurrency(amount, currencyCode = 'MXN') {
    try {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: currencyCode,
            maximumFractionDigits: 0,
        }).format(Number(amount || 0));
    } catch {
        // Fallback: prefix with $ if formatter fails
        return `$${Number(amount || 0).toFixed(0)}`;
    }
}

function formatDuration(mins) {
    if (!mins || isNaN(mins)) return null;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0 && m === 0) return `${h} hrs`;
    if (h > 0) return `${h} h ${m} min`;
    return `${m} min`;
}

function AmenityCard({ amenity }) {
    const [currentWorkspace] = useCurrentWorkspace();
    const slug = amenity.name.toLowerCase();
    const display = titleCase(amenity.name);
    const img = amenity.img;

    // Fetch rules to compute a representative slot duration (min across rules)
    const { data: rules = [] } = useAmenityRules(currentWorkspace, { amenity_id: amenity.id });
    const minSlot = rules
        .map((r) => Number(r.slot_duration_minutes))
        .filter((n) => Number.isFinite(n) && n > 0)
        .sort((a, b) => a - b)[0];

    const durationLabel = formatDuration(minSlot);

    const currencyCode = currentWorkspace?.currency || currentWorkspace?.curreny || 'MXN';
    const showCost = amenity.requires_payment;
    const costLabel = showCost && Number.isFinite(Number(amenity.cost))
        ? formatCurrency(amenity.cost, currencyCode)
        : showCost
        ? 'Pago requerido'
        : null;

    return (
        <Card
            radius="lg"
            className="bg-content1 border border-default-100 hover:border-primary-200 transition-colors"
        >
            {img && (
                <div className="h-36 w-full overflow-hidden rounded-t-large">
                    <img
                        src={`${img}/w=400`}
                        alt={display}
                        className="h-full w-full object-cover"
                    />
                </div>
            )}
            <CardHeader className="flex flex-col items-start gap-1">
                <h3 className="text-lg font-semibold">{display}</h3>
                <p className="text-small text-default-500">
                    Reserva el {display.toLowerCase()} de tu workspace
                </p>
                {(costLabel || durationLabel) && (
                    <div className="mt-1 flex items-center gap-3 text-small text-default-600">
                        {costLabel && (
                            <span className="inline-flex items-center gap-1">
                                <RiMoneyDollarCircleLine className="text-success" />
                                <span>{costLabel}</span>
                            </span>
                        )}
                        {durationLabel && (
                            <span className="inline-flex items-center gap-1">
                                <RiTimerLine className="text-primary" />
                                <span>{durationLabel}</span>
                            </span>
                        )}
                    </div>
                )}
            </CardHeader>
            <CardBody className="pt-0">
                <div className="flex w-full justify-end">
                    <Button
                        as={Link}
                        to={`/amenidades/${encodeURIComponent(slug)}`}
                        color="primary"
                        size="md"
                        className="font-medium"
                        fullWidth
                    >
                        Reservar
                    </Button>
                </div>
            </CardBody>
        </Card>
    );
}

export default AmenityCard;

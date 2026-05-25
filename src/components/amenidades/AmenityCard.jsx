import { Button, Chip } from '@heroui/react';
import { Link } from 'react-router-dom';
import {
    RiMoneyDollarCircleLine,
    RiTimeLine,
    RiArrowRightLine,
} from 'react-icons/ri';
import useCurrentWorkspace from '../../hooks/useCurrentWorkspace';
import { useAmenityRules } from '../../hooks/react-query/amenities/useAmenities';
import { getAmenityIcon } from '../../utils/amenityIcon.jsx';

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

function parseTimeToMinutes(timeStr = '00:00') {
    const [h, m] = String(timeStr).split(':');
    return parseInt(h || '0', 10) * 60 + parseInt(m || '0', 10);
}

function formatMinutesToTime(total) {
    const h24 = Math.floor(total / 60) % 24;
    const m = total % 60;
    const dt = new Date(2000, 0, 1, h24, m, 0, 0);
    return new Intl.DateTimeFormat('es-MX', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    }).format(dt);
}

function AmenityCard({ amenity }) {
    const [currentWorkspace] = useCurrentWorkspace();
    const slug = amenity.name.toLowerCase();
    const display = titleCase(amenity.name);
    const img = amenity.img;
    const { data: rules = [] } = useAmenityRules(currentWorkspace, { amenity_id: amenity.id });
    const minSlot = rules
        .map((r) => Number(r.slot_duration_minutes))
        .filter((n) => Number.isFinite(n) && n > 0)
        .sort((a, b) => a - b)[0];

    const durationLabel = formatDuration(minSlot);
    const isExclusive = Number(amenity?.max_capacity) === 1;

    const rangeLabel = isExclusive
        ? (() => {
              const openMins = rules
                  .map((r) => parseTimeToMinutes(String(r.open_time).slice(0, 5)))
                  .filter((n) => Number.isFinite(n));
              const closeMins = rules
                  .map((r) => parseTimeToMinutes(String(r.close_time).slice(0, 5)))
                  .filter((n) => Number.isFinite(n));
              if (!openMins.length || !closeMins.length) return null;
              const open = Math.min(...openMins);
              const close = Math.max(...closeMins);
              return `${formatMinutesToTime(open)} – ${formatMinutesToTime(close)}`;
          })()
        : null;

    const timeLabel = rangeLabel || durationLabel;

    const currencyCode = currentWorkspace?.currency || currentWorkspace?.curreny || 'MXN';
    const numericCost = Number(amenity.cost);
    const hasCost = Number.isFinite(numericCost) && numericCost > 0;
    const costLabel = hasCost ? formatCurrency(numericCost, currencyCode) : 'Sin costo';

    return (
        <div className="rounded-xl border border-default-200 bg-content1 overflow-hidden hover:border-primary-300 hover:shadow-sm transition-all flex flex-col">
            {/* Cover image */}
            {img && (
                <div className="h-36 w-full overflow-hidden">
                    <img
                        src={`${img}/w=400`}
                        alt={display}
                        className="h-full w-full object-cover"
                    />
                </div>
            )}

            {/* Amenity name header — matches modal style */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-default-100">
                <div className="flex items-center justify-center w-8 h-8 rounded-full border border-default-300 shrink-0">
                    {getAmenityIcon(amenity.icon, 'text-default-500 text-base')}
                </div>
                <div className="text-base font-semibold text-default-800 truncate">{display}</div>
            </div>

            {/* Cost / duration meta rows */}
            {(costLabel || timeLabel) && (
                <div className="divide-y divide-default-100">
                    {costLabel && (
                        <div className="flex items-center justify-between px-4 py-2.5">
                            <div className="flex items-center gap-2 text-default-500 text-sm">
                                <RiMoneyDollarCircleLine className="text-success-500 text-base shrink-0" />
                                <span className="text-xs text-default-500">Costo</span>
                            </div>
                            <Chip
                                color="default"
                                variant="flat"
                                size="sm"
                                className="font-semibold"
                            >
                                {costLabel}
                            </Chip>
                        </div>
                    )}
                    {timeLabel && (
                        <div className="flex items-center justify-between px-4 py-2.5">
                            <div className="flex items-center gap-2 text-default-500 text-sm">
                                <RiTimeLine className="text-primary-500 text-base shrink-0" />
                                <span className="text-xs text-default-500">
                                    {isExclusive ? 'Horario' : 'Duración'}
                                </span>
                            </div>
                            <span className="text-sm font-semibold text-default-700">
                                {timeLabel}
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* CTA */}
            <div className="px-4 py-3 border-t border-default-100 mt-auto">
                <Button
                    as={Link}
                    to={`/amenidades/${encodeURIComponent(slug)}`}
                    color="primary"
                    size="md"
                    className="font-medium w-full"
                    endContent={<RiArrowRightLine />}
                    fullWidth
                >
                    Reservar
                </Button>
            </div>
        </div>
    );
}

export default AmenityCard;

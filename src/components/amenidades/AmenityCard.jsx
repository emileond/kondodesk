import { Card, CardBody, CardHeader, Button } from '@heroui/react';
import { Link } from 'react-router-dom';

function titleCase(str) {
    return str
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

const images = {
    gym: '/amenities/gym.jpg',
    'cancha padel': '/amenities/padel.jpg',
    terraza: '/amenities/terrace.jpg',
};

function AmenityCard({ amenity }) {
    const slug = amenity.toLowerCase();
    const display = titleCase(amenity);
    const img = images[slug];

    return (
        <Card
            radius="lg"
            className="bg-content1 border border-default-100 hover:border-primary-200 transition-colors"
        >
            {img && (
                <div className="h-36 w-full overflow-hidden rounded-t-large">
                    <img src={img} alt={display} className="h-full w-full object-cover" />
                </div>
            )}
            <CardHeader className="flex flex-col items-start gap-1">
                <h3 className="text-lg font-semibold">{display}</h3>
                <p className="text-small text-default-500">
                    Reserva el {display.toLowerCase()} de tu workspace
                </p>
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

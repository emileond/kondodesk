import { RiBuildingLine } from 'react-icons/ri';
import {
    MdSportsTennis,
    MdFitnessCenter,
    MdSportsSoccer,
    MdSportsBasketball,
    MdGolfCourse,
    MdRestaurant,
    MdWork,
} from 'react-icons/md';

const ICON_MAP = {
    tennis:     MdSportsTennis,
    gym:        MdFitnessCenter,
    cowork:     MdWork,
    soccer:     MdSportsSoccer,
    basketball: MdSportsBasketball,
    golf:       MdGolfCourse,
    restaurant: MdRestaurant,
};

/**
 * Renders the icon element for an amenity icon key.
 * Returns a JSX element directly to avoid creating components during render.
 * Falls back to RiBuildingLine for unknown or missing keys.
 *
 * @param {string|null|undefined} iconKey - value from amenity.icon column
 * @param {string} [className] - className forwarded to the icon element
 * @returns {JSX.Element}
 */
export function getAmenityIcon(iconKey, className) {
    const Icon = ICON_MAP[String(iconKey || '').toLowerCase()] ?? RiBuildingLine;
    return <Icon className={className} />;
}

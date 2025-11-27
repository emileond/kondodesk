import { useState } from 'react';
import {
    Navbar,
    NavbarBrand,
    NavbarContent,
    NavbarItem,
    NavbarMenuToggle,
    NavbarMenu,
    NavbarMenuItem,
    Link,
} from '@heroui/react';
import Logo from '../Logo.jsx';
import { navItems } from './navItems.jsx';
import { Link as RouterLink } from 'react-router-dom';
import UserMenu from './UserMenu.jsx';

export default function Appbar() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <Navbar
            onMenuOpenChange={setIsMenuOpen}
            className="border-b border-default-200 bg-content1"
        >
            <NavbarContent>
                <NavbarMenuToggle
                    aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
                    className="sm:hidden"
                />
                <NavbarBrand>
                    <Logo />
                </NavbarBrand>
            </NavbarContent>
            <NavbarContent justify="end">
                <NavbarItem className="hidden lg:flex">
                    <Link href="#">Login</Link>
                </NavbarItem>
                <NavbarItem>
                    <UserMenu avatarOnly />
                </NavbarItem>
            </NavbarContent>
            <NavbarMenu>
                {navItems.map((item, index) => (
                    <NavbarMenuItem key={`${item}-${index}`}>
                        <Link
                            as={RouterLink}
                            color="foreground"
                            className="w-full"
                            to={item?.path}
                            size="lg"
                        >
                            {item?.name}
                        </Link>
                    </NavbarMenuItem>
                ))}
            </NavbarMenu>
        </Navbar>
    );
}

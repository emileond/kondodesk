import React, { useState } from 'react';
import {
    Button,
    Link,
    Navbar,
    NavbarBrand,
    NavbarContent,
    NavbarItem,
    NavbarMenuToggle,
    NavbarMenu,
    NavbarMenuItem,
} from '@heroui/react';
import { Link as RRLink } from 'react-router-dom';
import ThemeSwitcher from '../theme/ThemeSwitcher';
import { useUser } from '../../hooks/react-query/user/useUser';
import Logo from '../Logo';
import { useScroll, useMotionValueEvent } from 'framer-motion';

export default function NavBar() {
    const { data: user } = useUser();
    const [scrolled, setScrolled] = useState(false);
    const { scrollY } = useScroll();

    useMotionValueEvent(scrollY, 'change', (latest) => {
        if (latest > 50) {
            // Adjust this threshold as needed
            setScrolled(true);
        } else {
            setScrolled(false);
        }
    });

    const menuItems = [
        { name: 'Features', href: '#features' },
        { name: 'Pricing', href: '#pricing' },
        { name: 'Faq', href: '#faq' },
        { name: 'Blog', href: '/blog' },
    ];

    return (
        <div className="fixed top-0 z-50 w-full flex items-center justify-center">
            <Navbar
                className={`w-full h-full p-0 transition-all ease-in-out duration-250 bg-content2/70 border border-content3 ${scrolled ? 'max-w-5xl mt-2 rounded-2xl overflow-hidden' : 'max-w-full'}`}
            >
                <NavbarContent className="sm:hidden" justify="start">
                    <NavbarMenuToggle />
                </NavbarContent>
                <NavbarContent className="sm:hidden pr-3" justify="center">
                    <NavbarBrand>
                        <Link to="/">
                            <Logo />
                        </Link>
                    </NavbarBrand>
                </NavbarContent>
                <NavbarContent className="hidden sm:flex gap-8" justify="center">
                    <NavbarBrand>
                        <Link href="/">
                            <Logo />
                        </Link>
                    </NavbarBrand>
                    {menuItems.map((item, index) => (
                        <NavbarItem key={index}>
                            <Button
                                as={Link}
                                href={`${import.meta.env.VITE_PUBLIC_URL}${item.href}`}
                                variant="light"
                            >
                                {item.name}
                            </Button>
                        </NavbarItem>
                    ))}
                </NavbarContent>
                <NavbarContent justify="end">
                    {user ? (
                        <NavbarItem className="sm:flex">
                            <Button
                                as={RRLink}
                                color="primary"
                                to="/home"
                                variant="solid"
                                className="sm:flex"
                            >
                                Ir a la app
                            </Button>
                        </NavbarItem>
                    ) : (
                        <div className="flex gap-3">
                            <NavbarItem className="sm:flex">
                                <Button
                                    as={RRLink}
                                    color="default"
                                    to="/login"
                                    variant="light"
                                    className="sm:flex"
                                >
                                    Login
                                </Button>
                            </NavbarItem>
                            <NavbarItem className="sm:flex">
                                <Button
                                    as={RRLink}
                                    color="primary"
                                    to="/signup"
                                    variant="solid"
                                    className="hidden sm:flex"
                                >
                                    Sign Up
                                </Button>
                            </NavbarItem>
                        </div>
                    )}
                </NavbarContent>
                <NavbarMenu>
                    {menuItems.map((item, index) => (
                        <NavbarMenuItem key={`${item}-${index}`}>
                            <Link className="w-full" to={item.href} size="lg" color="foreground">
                                {item.name}
                            </Link>
                        </NavbarMenuItem>
                    ))}
                </NavbarMenu>
            </Navbar>
        </div>
    );
}

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { Button } from '@/components/ui/button';
import { Menu, X, LogOut, Map as MapIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const navLinks = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#faq', label: 'FAQ' },
];

export function Navbar(): React.ReactNode {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleLogout = async () => {
    setDropdownOpen(false);
    await logout();
    router.push('/');
  };

  const initials = user?.email?.charAt(0).toUpperCase() ?? '?';

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-colors duration-300',
        scrolled
          ? 'border-b border-border/40 bg-background/80 backdrop-blur-md'
          : 'border-b border-transparent bg-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className={cn(
            'flex items-center gap-2 font-serif text-xl tracking-wide transition-colors',
            scrolled ? 'text-foreground' : 'text-secondary-foreground',
          )}
        >
          <Image
            src="/gavai_logo.png"
            alt="GAVAI Logo"
            width={28}
            height={28}
            className="h-7 w-7"
          />
          GAVAI
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={cn(
                'text-xs font-medium uppercase tracking-widest transition-colors',
                scrolled
                  ? 'text-muted-foreground hover:text-foreground'
                  : 'text-secondary-foreground/70 hover:text-secondary-foreground',
              )}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          {isLoading ? null : isAuthenticated && user ? (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground text-sm font-medium"
              >
                {initials}
              </button>
              {dropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setDropdownOpen(false)}
                  />
                  <div className="absolute right-0 top-12 z-20 w-44 rounded-sm border border-border bg-popover p-1 shadow-md">
                    <button
                      onClick={() => {
                        router.push('/map');
                        setDropdownOpen(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent"
                    >
                      <MapIcon className="h-4 w-4" />
                      Go to Map
                    </button>
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent"
                    >
                      <LogOut className="h-4 w-4" />
                      Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Link href="/auth/login">
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  'bg-transparent text-xs font-medium uppercase tracking-wider transition-colors',
                  scrolled
                    ? 'border-foreground/20 text-foreground hover:bg-foreground/10'
                    : 'border-secondary-foreground/30 text-secondary-foreground hover:bg-secondary-foreground/10',
                )}
              >
                Sign In
              </Button>
            </Link>
          )}
        </div>

        <button
          className={cn(
            'md:hidden',
            scrolled ? 'text-foreground' : 'text-secondary-foreground',
          )}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
      </div>

      {mobileOpen && (
        <div
          className={cn(
            'border-t md:hidden',
            scrolled
              ? 'border-border/40 bg-background'
              : 'border-secondary-foreground/10 bg-secondary/90 backdrop-blur-md',
          )}
        >
          <div className="space-y-1 px-4 py-4">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'block py-2 text-xs font-medium uppercase tracking-widest',
                  scrolled
                    ? 'text-muted-foreground hover:text-foreground'
                    : 'text-secondary-foreground/70 hover:text-secondary-foreground',
                )}
              >
                {link.label}
              </a>
            ))}
            <hr
              className={cn(
                'my-2',
                scrolled
                  ? 'border-border/40'
                  : 'border-secondary-foreground/20',
              )}
            />
            {isLoading ? null : isAuthenticated ? (
              <>
                <span
                  className={cn(
                    'block py-2 text-xs',
                    scrolled
                      ? 'text-muted-foreground'
                      : 'text-secondary-foreground/70',
                  )}
                >
                  {user?.email}
                </span>
                <button
                  onClick={() => {
                    router.push('/map');
                    setMobileOpen(false);
                  }}
                  className={cn(
                    'block w-full text-left py-2 text-xs hover:text-foreground',
                    scrolled
                      ? 'text-muted-foreground'
                      : 'text-secondary-foreground/70',
                  )}
                >
                  Go to Map
                </button>
                <button
                  onClick={handleLogout}
                  className={cn(
                    'block w-full text-left py-2 text-xs hover:text-foreground',
                    scrolled
                      ? 'text-muted-foreground'
                      : 'text-secondary-foreground/70',
                  )}
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                href="/auth/login"
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'block py-2 text-xs font-medium uppercase tracking-wider',
                  scrolled ? 'text-foreground' : 'text-secondary-foreground',
                )}
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

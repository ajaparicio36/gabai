import Link from 'next/link';

const footerLinks = {
  product: [
    { href: '#features', label: 'Features' },
    { href: '#how-it-works', label: 'How It Works' },
    { href: '#faq', label: 'FAQ' },
  ],
  legal: [
    { href: '#', label: 'Privacy Policy' },
    { href: '#', label: 'Terms of Service' },
  ],
  social: [
    { href: '#', label: 'Facebook' },
    { href: '#', label: 'Twitter' },
    { href: '#', label: 'LinkedIn' },
  ],
};

export function Footer(): React.ReactNode {
  return (
    <footer className="border-t border-primary-foreground/10 bg-primary px-4 py-12 text-primary-foreground/80 sm:py-16">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link
              href="/"
              className="font-serif text-xl tracking-wide text-primary-foreground"
            >
              GAVAI
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-primary-foreground/60">
              AI-powered Automated Valuation Model for global real estate.
            </p>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold text-primary-foreground">
              Product
            </h3>
            <ul className="space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-primary-foreground/60 hover:text-primary-foreground transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold text-primary-foreground">
              Legal
            </h3>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-primary-foreground/60 hover:text-primary-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold text-primary-foreground">
              Connect
            </h3>
            <ul className="space-y-3">
              {footerLinks.social.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-primary-foreground/60 hover:text-primary-foreground transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-primary-foreground/10 pt-8 text-center">
          <p className="text-sm text-primary-foreground/40">
            &copy; 2026 GAVAI. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

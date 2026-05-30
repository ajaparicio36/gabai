import { Map, Crosshair, Layers, Brain, Shield, FileCheck } from 'lucide-react';

const features = [
  {
    icon: Map,
    title: 'Smart Map',
    description:
      'Interactive Google Maps with four view modes — Heatmap, Listings, Valuation, and Hazard overlays. Navigate Metro Manila with ease.',
  },
  {
    icon: Crosshair,
    title: 'Instant Valuations',
    description:
      'Click any location to get an ML-powered property estimate with confidence bands, price per sqm, and comparable analysis.',
  },
  {
    icon: Layers,
    title: 'Price Heatmap',
    description:
      'Color-coded price density polygons reveal affordable and premium areas. Spot market trends across the metro at a glance.',
  },
  {
    icon: Brain,
    title: 'Area Intelligence',
    description:
      'AI-summarized neighborhood news, growth estimates, and yield signals. Ask natural-language questions about any area.',
  },
  {
    icon: Shield,
    title: 'Risk Assessment',
    description:
      'Five-axis spider chart evaluating flood, traffic, market premium, yield signal, and fault line risk for any location.',
  },
  {
    icon: FileCheck,
    title: 'BIR Compliance',
    description:
      'Instantly check if a valuation aligns with government zonal values to avoid overpaying or audit risk.',
  },
];

export function FeaturesSection(): React.ReactNode {
  return (
    <section
      id="features"
      className="bg-background px-4 py-24 sm:py-32 scroll-mt-16"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl">
            Everything you need to value property
          </h2>
          <p className="mt-4 text-muted-foreground">
            From heatmaps to compliance checks — make informed real estate
            decisions with AI.
          </p>
        </div>
        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group rounded-sm border border-border bg-card p-6 transition-colors hover:border-secondary/30"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-sm bg-secondary/10">
                  <Icon className="h-6 w-6 text-secondary" />
                </div>
                <h3 className="font-serif text-lg font-semibold">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

import { Search, Cpu, FileText } from 'lucide-react';

const steps = [
  {
    icon: Search,
    title: 'Find a location',
    description:
      'Pan and zoom the interactive map to any area in Metro Manila. Switch between satellite and road view.',
  },
  {
    icon: Cpu,
    title: 'AI analyzes the data',
    description:
      'Our XGBoost model factors in comparable listings, zonal values, flood risk, traffic, and area intelligence.',
  },
  {
    icon: FileText,
    title: 'Get your valuation',
    description:
      'Receive a full estimate with confidence bands, BIR compliance check, risk assessment, and a downloadable report.',
  },
];

export function HowItWorksSection(): React.ReactNode {
  return (
    <section
      id="how-it-works"
      className="bg-muted/30 px-4 py-24 sm:py-32 scroll-mt-16"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl">
            How it works
          </h2>
          <p className="mt-4 text-muted-foreground">
            Three simple steps to a data-driven property valuation.
          </p>
        </div>
        <div className="relative mt-16 grid gap-12 md:grid-cols-3">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <div
                key={step.title}
                className="relative flex flex-col items-center text-center"
              >
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                  <Icon className="h-7 w-7" />
                </div>
                <div className="mt-4 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
                  {i + 1}
                </div>
                <h3 className="mt-4 font-serif text-lg font-semibold">
                  {step.title}
                </h3>
                <p className="mt-2 max-w-xs text-sm text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

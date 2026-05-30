import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const faqs = [
  {
    q: 'How accurate are the valuations?',
    a: 'Our XGBoost model achieves strong accuracy in Metro Manila where we have sufficient training data. Each estimate includes a confidence band and score. In areas with fewer comparables, accuracy may decrease — we clearly indicate this.',
  },
  {
    q: 'What areas are covered?',
    a: 'Currently we cover Metro Manila with detailed data on 100+ barangays. We aggregate property listings, BIR zonal values, flood hazard maps, traffic data, and news intelligence for every location.',
  },
  {
    q: 'What data sources are used?',
    a: 'Valuations draw from thousands of normalized property listings, official BIR zonal values, Phivolcs flood hazard data, Google Maps traffic and elevation data, and AI-summarized local news.',
  },
  {
    q: 'How is confidence calculated?',
    a: 'Confidence is based on the number of comparable properties within a 3km radius, the completeness of user-provided property details, and model prediction certainty. Each valuation shows a High/Medium/Low badge.',
  },
  {
    q: 'Can I download a report?',
    a: 'Yes. Each valuation generates a report with all comparable listings, risk scores, and a verification hash. PDF export is coming soon.',
  },
];

export function FAQSection(): React.ReactNode {
  return (
    <section
      id="faq"
      className="bg-background px-4 py-24 sm:py-32 scroll-mt-16"
    >
      <div className="mx-auto max-w-3xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl">
            Frequently asked questions
          </h2>
        </div>
        <Accordion type="single" collapsible className="mt-12">
          {faqs.map((faq, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger className="text-left text-base font-medium">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

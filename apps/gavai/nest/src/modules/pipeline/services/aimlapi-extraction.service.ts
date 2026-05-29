import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import type { ExtractedListingPayload } from '@gavai/pipeline';

const confidenceSchema = z.enum(['high', 'medium', 'low', 'missing']);

const extractedListingSchema = z
  .object({
    title: z.string().nullable(),
    description: z.string().nullable(),
    location: z
      .object({
        raw: z.string().nullable(),
        city: z.string().nullable(),
        province: z.string().nullable(),
        confidence: confidenceSchema,
        evidence: z.string().nullable(),
      })
      .strict(),
    propertyType: z
      .object({
        value: z.string().nullable(),
        confidence: confidenceSchema,
      })
      .strict(),
    price: z
      .object({
        value: z.number().nullable(),
        currency: z.literal('PHP'),
        confidence: confidenceSchema,
      })
      .strict(),
    lotArea: z
      .object({
        value: z.number().nullable(),
        unit: z.literal('sqm'),
        confidence: confidenceSchema,
      })
      .strict(),
    floorArea: z
      .object({
        value: z.number().nullable(),
        unit: z.literal('sqm'),
        confidence: confidenceSchema,
      })
      .strict(),
    issues: z.array(z.string()),
  })
  .strict();

@Injectable()
export class AimlapiExtractionService {
  private readonly logger = new Logger(AimlapiExtractionService.name);
  private readonly endpoint = 'https://api.aimlapi.com/v1/chat/completions';

  constructor(private readonly configService: ConfigService) {}

  async extractListing(
    rawText: string,
  ): Promise<ExtractedListingPayload | null> {
    const apiKey = this.configService.get<string>('AIML_API_KEY');
    if (!apiKey) {
      this.logger.warn(
        'AIML_API_KEY is missing; normalization will use deterministic fallback only',
      );
      return null;
    }

    const model = 'gpt-4o-mini';
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 1200,
        messages: [
          {
            role: 'system',
            content: [
              'You extract Philippine real estate listing fields.',
              'Return JSON only.',
              'Use only facts explicitly present in the source text.',
              'Never guess missing fields.',
              'Never default any location to Manila.',
              'If location is ambiguous or absent, set city and province to null and confidence to missing or low.',
              'Preserve explicit city and province names from the source.',
              'Include short evidence snippets for location and price when possible.',
            ].join(' '),
          },
          {
            role: 'user',
            content: `Extract this listing into the required schema:\n\n${rawText.slice(0, 12000)}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.warn(
        `AI/ML extraction failed ${response.status}: ${body.slice(0, 500)}`,
      );
      return null;
    }

    const json = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) return null;

    return this.parseExtractedJson(content);
  }

  parseExtractedJsonForTest(content: string): ExtractedListingPayload | null {
    return this.parseExtractedJson(content);
  }

  private parseExtractedJson(content: string): ExtractedListingPayload | null {
    const cleaned = content
      .replace(/^```json\s*/i, '')
      .replace(/```$/i, '')
      .trim();
    try {
      const parsed = extractedListingSchema.safeParse(JSON.parse(cleaned));
      if (!parsed.success) {
        this.logger.warn(
          `AI/ML extraction failed schema validation: ${parsed.error.message}`,
        );
        return null;
      }
      return parsed.data;
    } catch {
      this.logger.warn('AI/ML extraction returned invalid JSON');
      return null;
    }
  }
}

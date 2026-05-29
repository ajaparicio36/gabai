import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import type { ExtractedListingPayload } from '@gavai/pipeline';
import type { CrawlPageResult } from '@gavai/pipeline';

export interface ArticleContent {
  url: string;
  title: string;
  markdown: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

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

const crawlPageResultSchema = z
  .object({
    listings: z.array(
      z.object({
        url: z.string(),
        title: z.string().nullable(),
        hasPrice: z.boolean(),
        pricePreview: z.string().nullable(),
        hasArea: z.boolean(),
        areaPreview: z.string().nullable(),
      }),
    ),
    hasNextPage: z.boolean(),
    nextPageUrl: z.string().nullable(),
    confidence: z.enum(['high', 'medium', 'low']),
  })
  .strict();

// ── Tool/function schemas (OpenAI-compatible JSON Schema) ──────────────────

const EXTRACT_LISTING_TOOL = {
  type: 'function' as const,
  function: {
    name: 'extract_listing',
    description:
      'Extract structured real estate listing data from raw Philippine property listing text.',
    strict: true,
    parameters: {
      type: 'object',
      required: [
        'title',
        'description',
        'location',
        'propertyType',
        'price',
        'lotArea',
        'floorArea',
        'issues',
      ],
      additionalProperties: false,
      properties: {
        title: { type: ['string', 'null'], description: 'Listing title' },
        description: {
          type: ['string', 'null'],
          description: 'Property description',
        },
        location: {
          type: 'object',
          required: ['raw', 'city', 'province', 'confidence', 'evidence'],
          additionalProperties: false,
          properties: {
            raw: {
              type: ['string', 'null'],
              description: 'Full raw address as written',
            },
            city: {
              type: ['string', 'null'],
              description:
                'City name (e.g. Makati, Quezon City, Taguig). null if not found.',
            },
            province: {
              type: ['string', 'null'],
              description:
                'Province name (e.g. Metro Manila, Cebu). null if not found.',
            },
            confidence: {
              type: 'string',
              enum: ['high', 'medium', 'low', 'missing'],
              description: 'Confidence in location extraction',
            },
            evidence: {
              type: ['string', 'null'],
              description: 'Short text snippet where location was found',
            },
          },
        },
        propertyType: {
          type: 'object',
          required: ['value', 'confidence'],
          additionalProperties: false,
          properties: {
            value: {
              type: ['string', 'null'],
              description:
                'One of: house_and_lot, residential_lot, condo, townhouse, commercial, apartment, warehouse, office. null if unclear.',
            },
            confidence: {
              type: 'string',
              enum: ['high', 'medium', 'low', 'missing'],
            },
          },
        },
        price: {
          type: 'object',
          required: ['value', 'currency', 'confidence'],
          additionalProperties: false,
          properties: {
            value: {
              type: ['number', 'null'],
              description:
                'Asking price in PHP as a plain number (no currency symbol). e.g. 5000000 for ₱5M.',
            },
            currency: { type: 'string', enum: ['PHP'] },
            confidence: {
              type: 'string',
              enum: ['high', 'medium', 'low', 'missing'],
            },
          },
        },
        lotArea: {
          type: 'object',
          required: ['value', 'unit', 'confidence'],
          additionalProperties: false,
          properties: {
            value: {
              type: ['number', 'null'],
              description: 'Lot area in sqm. null if not stated.',
            },
            unit: { type: 'string', enum: ['sqm'] },
            confidence: {
              type: 'string',
              enum: ['high', 'medium', 'low', 'missing'],
            },
          },
        },
        floorArea: {
          type: 'object',
          required: ['value', 'unit', 'confidence'],
          additionalProperties: false,
          properties: {
            value: {
              type: ['number', 'null'],
              description: 'Floor/living area in sqm. null if not stated.',
            },
            unit: { type: 'string', enum: ['sqm'] },
            confidence: {
              type: 'string',
              enum: ['high', 'medium', 'low', 'missing'],
            },
          },
        },
        issues: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of extraction issues or ambiguities found',
        },
      },
    },
  },
};

const EXTRACT_LISTING_URLS_TOOL = {
  type: 'function' as const,
  function: {
    name: 'extract_listing_urls',
    description:
      'Extract all individual property listing URLs from a real estate directory/search-results page.',
    strict: true,
    parameters: {
      type: 'object',
      required: ['listings', 'hasNextPage', 'nextPageUrl', 'confidence'],
      additionalProperties: false,
      properties: {
        listings: {
          type: 'array',
          description:
            'All individual property listing links found on the page',
          items: {
            type: 'object',
            required: [
              'url',
              'title',
              'hasPrice',
              'pricePreview',
              'hasArea',
              'areaPreview',
            ],
            additionalProperties: false,
            properties: {
              url: {
                type: 'string',
                description: 'Full or relative URL of the listing',
              },
              title: {
                type: ['string', 'null'],
                description: 'Listing title if visible',
              },
              hasPrice: {
                type: 'boolean',
                description: 'True if a price is visible in the card/preview',
              },
              pricePreview: {
                type: ['string', 'null'],
                description: 'Raw price text if visible',
              },
              hasArea: {
                type: 'boolean',
                description:
                  'True if area (sqm) is visible in the card/preview',
              },
              areaPreview: {
                type: ['string', 'null'],
                description: 'Raw area text if visible',
              },
            },
          },
        },
        hasNextPage: {
          type: 'boolean',
          description: 'True if there is a next page of results',
        },
        nextPageUrl: {
          type: ['string', 'null'],
          description: 'URL of the next page, if any',
        },
        confidence: {
          type: 'string',
          enum: ['high', 'medium', 'low'],
          description: 'Confidence in the extraction result',
        },
      },
    },
  },
};

// ── System prompts ─────────────────────────────────────────────────────────

const EXTRACTION_SYSTEM_PROMPT = [
  'You extract Philippine real estate listing fields from listing text.',
  'Use ONLY facts explicitly present in the source text.',
  'Never guess or infer missing fields — set them to null.',
  'Never default any location to Manila or Metro Manila without evidence.',
  'If location is ambiguous or absent, set city and province to null and confidence to "missing" or "low".',
  'Preserve exact city and province names from the source (e.g. Taguig, BGC, Quezon City, Makati).',
  'For price: convert shorthand — "5M" → 5000000, "₱1.2M" → 1200000. Include PHP value only.',
  'For propertyType: normalize to one of: house_and_lot, residential_lot, condo, townhouse, commercial, apartment, warehouse, office.',
  'Include short evidence snippets for location and price.',
  'You MUST call the extract_listing function — do not reply with text.',
].join(' ');

const CRAWL_SYSTEM_PROMPT = [
  'You extract real estate listing URLs from listing directory page HTML.',
  'Extract EVERY individual property listing link on the page.',
  'Ignore navigation, footer, social media, and non-listing links.',
  'Determine if there is a next page link.',
  'You MUST call the extract_listing_urls function — do not reply with text.',
].join(' ');

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

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: 2000,
          tools: [EXTRACT_LISTING_TOOL],
          tool_choice: {
            type: 'function',
            function: { name: 'extract_listing' },
          },
          messages: [
            { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
            {
              role: 'user',
              content: `Extract this Philippine property listing:\n\n${rawText.slice(0, 12000)}`,
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
        choices?: {
          message?: {
            tool_calls?: {
              function?: { name: string; arguments: string };
            }[];
          };
        }[];
      };

      const toolCall = json.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall?.function?.arguments) {
        this.logger.warn('AI/ML extraction returned no tool call');
        return null;
      }

      return this.parseToolCallArgs(
        toolCall.function.arguments,
        extractedListingSchema,
      );
    } catch (error: unknown) {
      this.logger.warn(`AI/ML extraction error: ${(error as Error).message}`);
      return null;
    }
  }

  async extractListingUrls(
    htmlContent: string,
    sourceDomain: string,
  ): Promise<CrawlPageResult | null> {
    const apiKey = this.configService.get<string>('AIML_API_KEY');
    if (!apiKey) {
      this.logger.warn('AIML_API_KEY is missing; cannot extract listing URLs');
      return null;
    }

    const model = 'gpt-4o-mini';
    const truncated = htmlContent.slice(0, 16000);

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: 4000,
          tools: [EXTRACT_LISTING_URLS_TOOL],
          tool_choice: {
            type: 'function',
            function: { name: 'extract_listing_urls' },
          },
          messages: [
            {
              role: 'system',
              content: `${CRAWL_SYSTEM_PROMPT} You are analyzing content from ${sourceDomain}.`,
            },
            {
              role: 'user',
              content: `Extract all listing URLs from this directory page:\n\n${truncated}`,
            },
          ],
        }),
        signal: AbortSignal.timeout(45000),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        this.logger.warn(
          `AI/ML crawl extraction failed ${response.status}: ${body.slice(0, 500)}`,
        );
        return null;
      }

      const json = (await response.json()) as {
        choices?: {
          message?: {
            tool_calls?: {
              function?: { name: string; arguments: string };
            }[];
          };
        }[];
      };

      const toolCall = json.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall?.function?.arguments) {
        this.logger.warn('AI/ML crawl extraction returned no tool call');
        return null;
      }

      return this.parseToolCallArgs(
        toolCall.function.arguments,
        crawlPageResultSchema,
      );
    } catch (error: unknown) {
      this.logger.warn(
        `AI/ML crawl extraction error: ${(error as Error).message}`,
      );
      return null;
    }
  }

  async summarizeArticles(articles: ArticleContent[]): Promise<string[]> {
    const articleTexts = articles
      .map(
        (a, i) =>
          `Article ${i + 1}: "${a.title}"\nSource: ${a.url}\nContent:\n${a.markdown}`,
      )
      .join('\n\n---\n\n');

    const prompt = `You are a real estate area intelligence summarizer. Based on the following news articles about infrastructure, development, and community changes in a specific area, extract the most important facts.

RULES (follow strictly):
- ONLY use information explicitly stated in the articles below
- Do NOT add any information, speculation, or commentary not found in the articles
- Each bullet point MUST include a source reference in brackets like [1], [2], etc.
- Be specific about project names, dates, and locations when available
- Return at most 5 bullet points prefixed with "- ", one per line
- Do NOT include an introduction or conclusion
- If information appears in multiple articles, cite all relevant sources

ARTICLES:
${articleTexts}`;

    const content = await this.chatCompletion(prompt, {
      temperature: 0.2,
      maxTokens: 1024,
    });
    if (!content) return [];

    return content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('-'))
      .map((line) => line.slice(1).trim())
      .filter((line) => line.length > 0);
  }

  async chatAboutArticles(
    articles: ArticleContent[],
    message: string,
    history?: ChatMessage[],
  ): Promise<string> {
    const articleText = articles
      .map((a, i) => `[${i + 1}] ${a.title}\nURL: ${a.url}\n\n${a.markdown}`)
      .join('\n\n---\n\n');

    let prompt = `You are a knowledgeable real estate analyst assistant for the Philippines. Answer the user's question using ONLY the information contained in the following articles about this area.

RULES:
- ONLY use information from the provided articles.
- Cite your sources using [1], [2], etc. referring to the article numbers.
- If the information requested is not in the articles, say so honestly.
- Be concise and specific. Use bullet points for listings where appropriate.

ARTICLES:
${articleText}

`;

    if (history && history.length > 0) {
      prompt += `CONVERSATION HISTORY:\n`;
      for (const entry of history) {
        const prefix = entry.role === 'user' ? 'User' : 'Assistant';
        prompt += `${prefix}: ${entry.content}\n\n`;
      }
    }

    prompt += `User: ${message}`;

    const content = await this.chatCompletion(prompt, {
      temperature: 0.3,
      maxTokens: 2048,
    });
    return content ?? 'Sorry, I was unable to process your request.';
  }

  async classifyArticles(articles: ArticleContent[]): Promise<Array<{
    sentiment: 'positive' | 'neutral' | 'negative';
    category: 'infrastructure' | 'commercial' | 'residential' | 'risk';
    horizon_years: number;
  }> | null> {
    const articleTexts = articles
      .map(
        (a, i) =>
          `Article ${i + 1}: "${a.title}"\nContent:\n${a.markdown.slice(0, 3000)}`,
      )
      .join('\n\n---\n\n');

    const prompt = `You are a real estate market analyst. Based on the following news articles about infrastructure and development, classify each article.

RULES:
- For each article, output a JSON object with:
  - "sentiment": one of "positive", "neutral", or "negative" (for property value impact)
  - "category": one of "infrastructure", "commercial", "residential", or "risk"
  - "horizon_years": estimated years until the development materializes (number)
- Output ONLY a valid JSON array, nothing else
- One object per article in the same order

ARTICLES:
${articleTexts}`;

    const content = await this.chatCompletion(prompt, {
      temperature: 0.1,
      maxTokens: 2048,
    });
    if (!content) return null;

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return null;

    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      return null;
    }
  }

  parseExtractedJsonForTest(content: string): ExtractedListingPayload | null {
    // Legacy helper for tests — parse the old free-text JSON format
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

  private parseToolCallArgs<T>(
    argsJson: string,
    schema: z.ZodSchema<T>,
  ): T | null {
    try {
      const parsed = schema.safeParse(JSON.parse(argsJson));
      if (!parsed.success) {
        this.logger.warn(
          `Tool call args failed schema validation: ${parsed.error.message}`,
        );
        return null;
      }
      return parsed.data;
    } catch {
      this.logger.warn('Tool call args contained invalid JSON');
      return null;
    }
  }

  private async chatCompletion(
    prompt: string,
    options: { temperature: number; maxTokens: number },
  ): Promise<string | null> {
    const apiKey = this.configService.get<string>('AIML_API_KEY');
    if (!apiKey) {
      this.logger.warn('AIML_API_KEY is missing; cannot call chat completion');
      return null;
    }

    const model = 'openai/gpt-5-nano-2025-08-07';

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: options.temperature,
          max_tokens: options.maxTokens,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        this.logger.warn(
          `Chat completion failed ${response.status}: ${body.slice(0, 500)}`,
        );
        return null;
      }

      const json = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      return json.choices?.[0]?.message?.content?.trim() ?? null;
    } catch (error: unknown) {
      this.logger.warn(`Chat completion error: ${(error as Error).message}`);
      return null;
    }
  }
}

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

  async extractListingUrls(
    htmlContent: string,
    sourceDomain: string,
  ): Promise<CrawlPageResult | null> {
    const apiKey = this.configService.get<string>('AIML_API_KEY');
    if (!apiKey) {
      this.logger.warn('AIML_API_KEY is missing; cannot extract listing URLs');
      return null;
    }

    const model = 'openai/gpt-5-nano-2025-08-07';
    const truncated = htmlContent.slice(0, 16000);

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
        messages: [
          {
            role: 'system',
            content: [
              'You are a web scraper assistant that extracts real estate listing URLs from listing directory page HTML.',
              `You are analyzing content from ${sourceDomain}.`,
              'Return JSON only. No commentary.',
              'Extract every individual property listing link you can find on this page.',
              'Each listing should have a URL, optional title, and whether price/area info is visible in the preview.',
              'Ignore navigation links, footer links, social media links, and non-listing links.',
              'Include all listings visible on the page, not just a sample.',
              'Determine if there is a next page link. If so, include its URL.',
            ].join(' '),
          },
          {
            role: 'user',
            content: `Extract all listing URLs from this listing directory page HTML:\n\n${truncated}`,
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
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) return null;

    return this.parseCrawlPageJson(content);
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

  private parseCrawlPageJson(content: string): CrawlPageResult | null {
    const cleaned = content
      .replace(/^```json\s*/i, '')
      .replace(/```$/i, '')
      .trim();
    try {
      const parsed = crawlPageResultSchema.safeParse(JSON.parse(cleaned));
      if (!parsed.success) {
        this.logger.warn(
          `AI/ML crawl extraction failed schema validation: ${parsed.error.message}`,
        );
        return null;
      }
      return parsed.data;
    } catch {
      this.logger.warn('AI/ML crawl extraction returned invalid JSON');
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

import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ERROR_CODES } from '@gavai/platform';

export interface ArticleContent {
  url: string;
  title: string;
  markdown: string;
}

@Injectable()
export class GeminiService {
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.getOrThrow<string>('GEMINI_API_KEY');
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
- Return ONLY bullet points prefixed with "- ", one per line
- Do NOT include an introduction or conclusion
- If information appears in multiple articles, cite all relevant sources

ARTICLES:
${articleTexts}`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 1024,
            },
          }),
          signal: AbortSignal.timeout(15000),
        },
      );

      if (!response.ok) {
        throw new Error(`Gemini API returned ${response.status}`);
      }

      const data = (await response.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };

      const text =
        data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';

      if (!text) {
        return [];
      }

      return text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.startsWith('-'))
        .map((line) => line.slice(1).trim())
        .filter((line) => line.length > 0);
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        throw new InternalServerErrorException({
          code: ERROR_CODES.AREA.SUMMARIZATION_FAILED,
          message: 'Gemini summarization timed out',
        });
      }
      throw new InternalServerErrorException({
        code: ERROR_CODES.AREA.SUMMARIZATION_FAILED,
        message: `Gemini summarization failed: ${(error as Error).message}`,
      });
    }
  }
}

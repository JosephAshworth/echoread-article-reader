import axios from "axios";
import * as cheerio from "cheerio";
import { ApiError } from "../errors.js";

interface ArticleContent {
  text: string;
  title: string | null;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function extractFromHtml(html: string): ArticleContent {
  const $ = cheerio.load(html);
  $("script,style,nav,footer,header,aside,noscript").remove();

  const title = normalizeWhitespace($("title").first().text()) || null;
  const paragraphs = $("p")
    .map((_, element) => normalizeWhitespace($(element).text()))
    .get()
    .filter((text) => text.length > 0);

  const text = paragraphs.join("\n\n").trim();
  return { text, title };
}

export async function fetchArticleContent(url: string): Promise<ArticleContent> {
  try {
    const response = await axios.get<string>(url, {
      timeout: 15_000,
      headers: { "User-Agent": "EchoRead/1.0" },
      responseType: "text",
      maxRedirects: 5,
    });

    const { text, title } = extractFromHtml(response.data);
    if (!text) {
      throw new ApiError(422, "Could not extract readable article content from that page.");
    }

    return { text, title };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(400, "Could not fetch the article from that URL.");
  }
}

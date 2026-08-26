import sanitizeHtml from "sanitize-html";

function normalizeDocxPlaceholders(html: string) {
  return html.replace(/\{\{([\s\S]{0,160}?)\}\}/g, (match, rawInner: string) => {
    const inner = rawInner
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, "")
      .trim();

    if (/^[a-zA-Z0-9_]+$/.test(inner)) {
      return `{{${inner}}}`;
    }

    return match;
  });
}

function protectPlaceholders(html: string) {
  const placeholders: string[] = [];
  const htmlWithTokens = html.replace(
    /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
    (match: string) => {
      const token = `DOCX_PLACEHOLDER_${placeholders.length}_TOKEN`;
      placeholders.push(match.replace(/\s+/g, ""));
      return token;
    },
  );

  return { htmlWithTokens, placeholders };
}

function restorePlaceholders(html: string, placeholders: string[]) {
  return placeholders.reduce(
    (content, placeholder, index) =>
      content.replaceAll(`DOCX_PLACEHOLDER_${index}_TOKEN`, placeholder),
    html,
  );
}

function normalizeHtmlSpacing(html: string) {
  return html
    .replace(/\r\n/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/>\s+</g, "><")
    .replace(/(<br\s*\/?>\s*){3,}/gi, "<br><br>")
    .replace(/(<\/(?:p|h[1-6]|li|tr|table|ul|ol)>)\s*(<(?:p|h[1-6]|ul|ol|table))/gi, "$1\n$2")
    .trim();
}

export function sanitizeTemplateHtmlContent(html: string) {
  const normalizedPlaceholders = normalizeDocxPlaceholders(html);
  const { htmlWithTokens, placeholders } = protectPlaceholders(normalizedPlaceholders);
  const sanitized = sanitizeHtml(htmlWithTokens, {
    allowedTags: [
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "ul",
      "ol",
      "li",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "blockquote",
      "a",
      "img",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: {
      img: ["http", "https", "data"],
    },
    transformTags: {
      b: "strong",
      i: "em",
      img: sanitizeHtml.simpleTransform("img", {
        loading: "lazy",
      }),
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
    },
    disallowedTagsMode: "discard",
  });

  return normalizeHtmlSpacing(restorePlaceholders(sanitized, placeholders));
}

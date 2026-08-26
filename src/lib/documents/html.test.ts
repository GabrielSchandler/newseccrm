import { describe, expect, it } from "vitest";
import { sanitizeTemplateHtmlContent } from "./html";

describe("sanitizeTemplateHtmlContent", () => {
  it("removes data URLs from links", () => {
    const sanitized = sanitizeTemplateHtmlContent(
      '<a href="data:text/html,<script>alert(1)</script>">Abrir</a>',
    );

    expect(sanitized).not.toContain("data:text/html");
    expect(sanitized).not.toContain("<script>");
  });

  it("keeps embedded images and protects placeholders", () => {
    const sanitized = sanitizeTemplateHtmlContent(
      '<p>{{ nome_cliente }}</p><img src="data:image/png;base64,AA==" alt="Logo">',
    );

    expect(sanitized).toContain("{{nome_cliente}}");
    expect(sanitized).toContain("data:image/png;base64,AA==");
  });
});

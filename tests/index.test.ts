import { describe, expect, it } from "vitest";
import {
  findLinkByRel,
  formatLinkHeader,
  indexLinksByRel,
  paginationLinks,
  parseLinkHeader
} from "../src/index.js";

describe("parseLinkHeader", () => {
  it("parses common pagination links", () => {
    const result = parseLinkHeader(
      '<https://api.example.test/items?page=2>; rel="next"; title="Page 2", <https://api.example.test/items?page=5>; rel="last"'
    );

    expect(result.ok).toBe(true);
    expect(result.links).toHaveLength(2);
    expect(paginationLinks(result.links).next?.uri).toBe("https://api.example.test/items?page=2");
    expect(paginationLinks(result.links).last?.params.rel).toBe("last");
  });

  it("keeps relation tokens addressable", () => {
    const result = parseLinkHeader('<https://example.test/feed>; rel="alternate feed"; title="Flux été"');

    expect(result.ok).toBe(true);
    expect(indexLinksByRel(result.links).alternate?.[0]?.params.title).toBe("Flux été");
    expect(findLinkByRel(result.links, "feed")?.uri).toBe("https://example.test/feed");
  });

  it("returns diagnostics for empty input", () => {
    const result = parseLinkHeader("");

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe("empty-input");
  });

  it("returns diagnostics for non-string runtime input", () => {
    const result = parseLinkHeader(12);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual([
      { code: "expected-string", message: "Link header input must be a string.", offset: 0 }
    ]);
  });

  it("returns diagnostics for malformed parameters without throwing", () => {
    const result = parseLinkHeader("<https://example.test>; rel");

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe("expected-equals");
  });

  it("honors maxLength without reading environment variables", () => {
    const result = parseLinkHeader("<https://example.test>; rel=\"next\"", { maxLength: 10 });

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe("max-length-exceeded");
  });

  it("ignores invalid maxLength options", () => {
    const result = parseLinkHeader("<https://example.test>; rel=\"next\"", { maxLength: -1 });

    expect(result.ok).toBe(true);
    expect(result.links).toHaveLength(1);
  });

  it("diagnoses duplicate parameters without overwriting the first value", () => {
    const result = parseLinkHeader('<https://example.test>; rel="next"; rel="last"');

    expect(result.ok).toBe(false);
    expect(result.links[0]?.params.rel).toBe("next");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "duplicate-parameter" })
    );
  });
});

describe("formatLinkHeader", () => {
  it("formats and escapes quoted parameters", () => {
    const header = formatLinkHeader([
      {
        uri: "https://example.test/report.csv",
        params: {
          rel: "alternate",
          title: 'Rapport "été"'
        }
      }
    ]);

    expect(header).toBe('<https://example.test/report.csv>; rel="alternate"; title="Rapport \\"été\\""');
  });

  it("round-trips formatted links", () => {
    const header = formatLinkHeader([
      {
        uri: "https://api.example.test/items?page=1",
        params: { rel: "first prev" }
      }
    ]);

    const parsed = parseLinkHeader(header);

    expect(parsed.ok).toBe(true);
    expect(findLinkByRel(parsed.links, "prev")?.uri).toBe("https://api.example.test/items?page=1");
  });

  it("indexes relation tokens case-insensitively", () => {
    const parsed = parseLinkHeader('<https://example.test/page/2>; rel="Next Prev"');

    expect(parsed.ok).toBe(true);
    expect(indexLinksByRel(parsed.links).next?.[0]?.uri).toBe("https://example.test/page/2");
    expect(findLinkByRel(parsed.links, "PREV")?.uri).toBe("https://example.test/page/2");
  });
});

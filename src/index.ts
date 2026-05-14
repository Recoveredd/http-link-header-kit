export type LinkDiagnosticCode =
  | "expected-string"
  | "empty-input"
  | "max-length-exceeded"
  | "expected-uri"
  | "unterminated-uri"
  | "expected-parameter"
  | "expected-equals"
  | "duplicate-parameter"
  | "unterminated-quoted-string";

export interface LinkDiagnostic {
  code: LinkDiagnosticCode;
  message: string;
  offset: number;
}

export interface LinkValue {
  uri: string;
  params: Record<string, string | true>;
}

export interface ParseLinkHeaderOptions {
  maxLength?: number;
  allowEmpty?: boolean;
}

export type ParseLinkHeaderResult =
  | { ok: true; links: LinkValue[]; diagnostics: LinkDiagnostic[] }
  | { ok: false; links: LinkValue[]; diagnostics: LinkDiagnostic[] };

const DEFAULT_MAX_LENGTH = 8192;
const TOKEN_SEPARATOR = /[\s,]+/u;

export function parseLinkHeader(
  input: unknown,
  options: ParseLinkHeaderOptions = {}
): ParseLinkHeaderResult {
  if (input === null || input === undefined) {
    input = "";
  }

  if (typeof input !== "string") {
    return result([], [diagnostic("expected-string", "Link header input must be a string.", 0)]);
  }

  const source = input;
  const maxLength = normalizeMaxLength(options.maxLength);
  const links: LinkValue[] = [];
  const diagnostics: LinkDiagnostic[] = [];

  if (source.trim() === "") {
    if (!options.allowEmpty) {
      diagnostics.push(diagnostic("empty-input", "Link header is empty.", 0));
    }

    return result(links, diagnostics);
  }

  if (source.length > maxLength) {
    return result(links, [
      diagnostic(
        "max-length-exceeded",
        `Link header exceeds the configured ${maxLength} character limit.`,
        maxLength
      )
    ]);
  }

  let offset = 0;

  while (offset < source.length) {
    offset = skipWhitespaceAndCommas(source, offset);

    if (offset >= source.length) {
      break;
    }

    if (source[offset] !== "<") {
      diagnostics.push(diagnostic("expected-uri", "Expected '<' before link URI.", offset));
      offset = skipUntilNextLink(source, offset);
      continue;
    }

    const parsedUri = readUri(source, offset);
    if (!parsedUri.ok) {
      diagnostics.push(parsedUri.diagnostic);
      break;
    }

    const params: Record<string, string | true> = {};
    offset = parsedUri.next;

    while (offset < source.length) {
      offset = skipSpaces(source, offset);

      if (source[offset] === ",") {
        offset += 1;
        break;
      }

      if (source[offset] !== ";") {
        diagnostics.push(
          diagnostic("expected-parameter", "Expected ';' before link parameter.", offset)
        );
        offset = skipUntilNextLink(source, offset);
        break;
      }

      const parsedParam = readParam(source, offset + 1);
      if (!parsedParam.ok) {
        diagnostics.push(parsedParam.diagnostic);
        offset = skipUntilNextLink(source, parsedParam.next);
        break;
      }

      const name = parsedParam.name.toLowerCase();
      if (Object.hasOwn(params, name)) {
        diagnostics.push(
          diagnostic("duplicate-parameter", `Duplicate "${name}" parameter was ignored.`, parsedParam.nameOffset)
        );
      } else {
        params[name] = parsedParam.value;
      }
      offset = parsedParam.next;
    }

    links.push({ uri: parsedUri.uri, params });
  }

  return result(links, diagnostics);
}

export function formatLinkHeader(links: readonly LinkValue[]): string {
  return links
    .map((link) => {
      const params = Object.entries(link.params).map(([name, value]) => {
        if (value === true) {
          return `; ${name}`;
        }

        return `; ${name}="${escapeQuoted(value)}"`;
      });

      return `<${link.uri}>${params.join("")}`;
    })
    .join(", ");
}

export function indexLinksByRel(links: readonly LinkValue[]): Record<string, LinkValue[]> {
  const index: Record<string, LinkValue[]> = {};

  for (const link of links) {
    const rel = link.params.rel;
    if (typeof rel !== "string") {
      continue;
    }

    for (const token of rel.split(TOKEN_SEPARATOR)) {
      if (token === "") {
        continue;
      }

      const normalized = token.toLowerCase();
      index[normalized] = [...(index[normalized] ?? []), link];
    }
  }

  return index;
}

export function findLinkByRel(links: readonly LinkValue[], rel: string): LinkValue | undefined {
  return indexLinksByRel(links)[rel.toLowerCase()]?.[0];
}

export interface PaginationLinks {
  first?: LinkValue;
  prev?: LinkValue;
  next?: LinkValue;
  last?: LinkValue;
}

export function paginationLinks(links: readonly LinkValue[]): PaginationLinks {
  const pagination: PaginationLinks = {};
  const first = findLinkByRel(links, "first");
  const prev = findLinkByRel(links, "prev");
  const next = findLinkByRel(links, "next");
  const last = findLinkByRel(links, "last");

  if (first !== undefined) pagination.first = first;
  if (prev !== undefined) pagination.prev = prev;
  if (next !== undefined) pagination.next = next;
  if (last !== undefined) pagination.last = last;

  return pagination;
}

function readUri(
  source: string,
  offset: number
): { ok: true; uri: string; next: number } | { ok: false; diagnostic: LinkDiagnostic } {
  const end = source.indexOf(">", offset + 1);

  if (end === -1) {
    return {
      ok: false,
      diagnostic: diagnostic("unterminated-uri", "Link URI is missing a closing '>'.", offset)
    };
  }

  const uri = source.slice(offset + 1, end).trim();
  if (uri === "") {
    return {
      ok: false,
      diagnostic: diagnostic("expected-uri", "Link URI cannot be empty.", offset + 1)
    };
  }

  return { ok: true, uri, next: end + 1 };
}

function readParam(
  source: string,
  offset: number
):
  | { ok: true; name: string; nameOffset: number; value: string | true; next: number }
  | { ok: false; diagnostic: LinkDiagnostic; next: number } {
  let cursor = skipSpaces(source, offset);
  const nameStart = cursor;

  while (cursor < source.length && !/[=;,\s]/u.test(source[cursor] ?? "")) {
    cursor += 1;
  }

  const name = source.slice(nameStart, cursor);
  if (name === "") {
    return {
      ok: false,
      diagnostic: diagnostic("expected-parameter", "Expected a parameter name.", nameStart),
      next: cursor
    };
  }

  cursor = skipSpaces(source, cursor);

  if (source[cursor] !== "=") {
    return {
      ok: false,
      diagnostic: diagnostic("expected-equals", "Expected '=' after parameter name.", cursor),
      next: cursor
    };
  }

  cursor = skipSpaces(source, cursor + 1);

  if (source[cursor] === '"') {
    return readQuotedParam(source, name, nameStart, cursor);
  }

  const valueStart = cursor;
  while (cursor < source.length && source[cursor] !== ";" && source[cursor] !== ",") {
    cursor += 1;
  }

  return {
    ok: true,
    name,
    nameOffset: nameStart,
    value: source.slice(valueStart, cursor).trim(),
    next: cursor
  };
}

function readQuotedParam(
  source: string,
  name: string,
  nameOffset: number,
  offset: number
):
  | { ok: true; name: string; nameOffset: number; value: string; next: number }
  | { ok: false; diagnostic: LinkDiagnostic; next: number } {
  let cursor = offset + 1;
  let value = "";

  while (cursor < source.length) {
    const char = source[cursor];

    if (char === "\\") {
      const next = source[cursor + 1];
      if (next !== undefined) {
        value += next;
        cursor += 2;
        continue;
      }
    }

    if (char === '"') {
      return { ok: true, name, nameOffset, value, next: cursor + 1 };
    }

    value += char;
    cursor += 1;
  }

  return {
    ok: false,
    diagnostic: diagnostic(
      "unterminated-quoted-string",
      "Quoted parameter value is missing a closing quote.",
      offset
    ),
    next: cursor
  };
}

function result(links: LinkValue[], diagnostics: LinkDiagnostic[]): ParseLinkHeaderResult {
  return diagnostics.length === 0
    ? { ok: true, links, diagnostics }
    : { ok: false, links, diagnostics };
}

function skipSpaces(source: string, offset: number): number {
  let cursor = offset;
  while (cursor < source.length && /\s/u.test(source[cursor] ?? "")) {
    cursor += 1;
  }

  return cursor;
}

function skipWhitespaceAndCommas(source: string, offset: number): number {
  let cursor = offset;
  while (cursor < source.length && (/[\s,]/u.test(source[cursor] ?? ""))) {
    cursor += 1;
  }

  return cursor;
}

function skipUntilNextLink(source: string, offset: number): number {
  const next = source.indexOf(", <", offset);
  return next === -1 ? source.length : next + 1;
}

function escapeQuoted(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function normalizeMaxLength(value: number | undefined): number {
  if (value === undefined) return DEFAULT_MAX_LENGTH;
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1) return DEFAULT_MAX_LENGTH;
  return value;
}

function diagnostic(code: LinkDiagnosticCode, message: string, offset: number): LinkDiagnostic {
  return { code, message, offset };
}

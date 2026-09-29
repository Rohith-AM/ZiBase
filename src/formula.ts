const FORMULA_NUMBER_RE = /^-?\d+(\.\d+)?$/;

export function isBackticked(raw: string): boolean {
  const trimmed = raw.trim();
  return trimmed.startsWith("`") && trimmed.endsWith("`") && trimmed.length >= 2;
}

export function stripBackticks(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.slice(1, -1);
}

export function isSimpleMath(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (FORMULA_NUMBER_RE.test(trimmed)) return false;
  if (!/^[\d\s+\-*/%().]+$/.test(trimmed)) return false;
  if (!/[+\-*/%]/.test(trimmed)) return false;
  if (/^[+*/%]/.test(trimmed)) return false;
  return true;
}

export function evaluateFormula(expression: string, rowData: Record<string, string>): number | null {
  if (!expression || !expression.trim()) return null;

  let resolved = expression;
  const colNames = Object.keys(rowData).sort((a, b) => b.length - a.length);

  for (const colName of colNames) {
    const regex = new RegExp("\\b" + escapeRegex(colName) + "\\b", "gi");
    if (!regex.test(resolved)) continue;
    regex.lastIndex = 0;

    const rawVal = rowData[colName];
    const numVal = parseFloat(rawVal);
    if (Number.isNaN(numVal)) return null;

    resolved = resolved.replace(regex, numVal.toString());
  }

  try {
    return safeEval(resolved);
  } catch {
    return null;
  }
}

export function evaluateSimpleMath(expression: string): number | null {
  try {
    return safeEval(expression);
  } catch {
    return null;
  }
}

export function formatResult(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (!Number.isFinite(value)) return "∞";
  return parseFloat(value.toFixed(6)).toString();
}

interface Token {
  type: "number" | "op" | "lparen" | "rparen";
  value: number | string;
}

interface Parser {
  tokens: Token[];
  pos: number;
}

function safeEval(expression: string): number {
  const tokens = tokenize(expression);
  const parser: Parser = { tokens, pos: 0 };
  const result = parseExpr(parser);
  if (parser.pos < parser.tokens.length) {
    throw new Error("Unexpected token: " + String(parser.tokens[parser.pos].value));
  }
  return result;
}

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const s = expr.trim();

  while (i < s.length) {
    if (s[i] === " " || s[i] === "\t") {
      i++;
      continue;
    }

    if ((s[i] >= "0" && s[i] <= "9") || (s[i] === "." && i + 1 < s.length && s[i + 1] >= "0" && s[i + 1] <= "9")) {
      let num = "";
      while (i < s.length && ((s[i] >= "0" && s[i] <= "9") || s[i] === ".")) {
        num += s[i];
        i++;
      }
      tokens.push({ type: "number", value: parseFloat(num) });
      continue;
    }

    if ("+-*/%".includes(s[i])) {
      tokens.push({ type: "op", value: s[i] });
      i++;
      continue;
    }

    if (s[i] === "(") {
      tokens.push({ type: "lparen", value: "(" });
      i++;
      continue;
    }
    if (s[i] === ")") {
      tokens.push({ type: "rparen", value: ")" });
      i++;
      continue;
    }

    throw new Error("Unexpected character: " + s[i]);
  }

  return tokens;
}

function parseExpr(parser: Parser): number {
  let left = parseTerm(parser);

  while (parser.pos < parser.tokens.length) {
    const tok = parser.tokens[parser.pos];
    if (tok.type === "op" && (tok.value === "+" || tok.value === "-")) {
      parser.pos++;
      const right = parseTerm(parser);
      left = tok.value === "+" ? left + right : left - right;
    } else {
      break;
    }
  }

  return left;
}

function parseTerm(parser: Parser): number {
  let left = parseUnary(parser);

  while (parser.pos < parser.tokens.length) {
    const tok = parser.tokens[parser.pos];
    if (tok.type === "op" && (tok.value === "*" || tok.value === "/" || tok.value === "%")) {
      parser.pos++;
      const right = parseUnary(parser);
      if (tok.value === "*") left = left * right;
      else if (tok.value === "/") left = right === 0 ? Infinity : left / right;
      else left = left % right;
    } else {
      break;
    }
  }

  return left;
}

function parseUnary(parser: Parser): number {
  if (parser.pos < parser.tokens.length) {
    const tok = parser.tokens[parser.pos];
    if (tok.type === "op" && tok.value === "-") {
      parser.pos++;
      return -parseUnary(parser);
    }
    if (tok.type === "op" && tok.value === "+") {
      parser.pos++;
      return parseUnary(parser);
    }
  }
  return parsePrimary(parser);
}

function parsePrimary(parser: Parser): number {
  if (parser.pos >= parser.tokens.length) {
    throw new Error("Unexpected end of expression");
  }

  const tok = parser.tokens[parser.pos];

  if (tok.type === "number") {
    parser.pos++;
    return tok.value as number;
  }

  if (tok.type === "lparen") {
    parser.pos++;
    const result = parseExpr(parser);
    if (parser.pos >= parser.tokens.length || parser.tokens[parser.pos].type !== "rparen") {
      throw new Error("Missing closing parenthesis");
    }
    parser.pos++;
    return result;
  }

  throw new Error("Unexpected token: " + String(tok.value));
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

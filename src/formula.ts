
// ─── ZiBase Formula Engine v1.0.0 ── ZIYAL (ழியல்) ──────────────────────────
// Safe math evaluator — NO eval(). Recursive descent parser.
// Supports: +, -, *, /, %, parentheses, column references (case-insensitive)

var FORMULA_NUMBER_RE = /^-?\d+(\.\d+)?$/;

/**
 * Check if a raw cell value is wrapped in backticks → plain text mode
 */
function isBackticked(raw) {
  const trimmed = raw.trim();
  return trimmed.startsWith('`') && trimmed.endsWith('`') && trimmed.length >= 2;
}

/**
 * Strip backticks from a value
 */
function stripBackticks(raw) {
  const trimmed = raw.trim();
  return trimmed.slice(1, -1);
}

/**
 * Check if a raw value looks like simple inline math (e.g. "5*10", "100/4+2")
 * Must contain at least one operator and consist only of numbers/operators/parens/spaces
 */
function isSimpleMath(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (FORMULA_NUMBER_RE.test(trimmed)) return false; // plain number, not math
  // Must only contain digits, operators, parens, dots, spaces
  if (!/^[\d\s+\-*/%().]+$/.test(trimmed)) return false;
  // Must contain at least one operator
  if (!/[+\-*/%]/.test(trimmed)) return false;
  // Shouldn't start with an operator (except minus for negative)
  if (/^[+*/%]/.test(trimmed)) return false;
  return true;
}

/**
 * Evaluate a formula expression with column references resolved from row data.
 * @param expression  The formula expression (e.g. "Price * Qty")
 * @param rowData     Map of column name → raw cell value
 * @returns           Computed number or null on error
 */
function evaluateFormula(expression, rowData) {
  if (!expression || !expression.trim()) return null;

  // Replace column references with their numeric values (case-insensitive)
  let resolved = expression;

  // Sort column names by length (longest first) to avoid partial replacement
  // e.g., "Total Price" should be replaced before "Price"
  const colNames = Object.keys(rowData).sort((a, b) => b.length - a.length);

  for (const colName of colNames) {
    // Case-insensitive replacement of column name with its value
    const regex = new RegExp(escapeRegex(colName), 'gi');
    const rawVal = rowData[colName];
    const numVal = parseFloat(rawVal);

    if (isNaN(numVal)) {
      // If referenced column has non-numeric value, can't compute
      if (regex.test(resolved)) {
        // Check if this column name is actually used in the expression
        const testResolved = resolved.replace(regex, '0');
        if (testResolved !== resolved) {
          return null; // Non-numeric reference → can't evaluate
        }
      }
      continue;
    }

    resolved = resolved.replace(regex, numVal.toString());
  }

  // Now `resolved` should be a pure math expression
  try {
    return safeEval(resolved);
  } catch (e) {
    return null;
  }
}

/**
 * Evaluate a simple math expression (no column refs, just numbers and operators)
 */
function evaluateSimpleMath(expression) {
  try {
    return safeEval(expression);
  } catch (e) {
    return null;
  }
}

/**
 * Format a computed result for display
 */
function formatResult(value) {
  if (value === null || value === undefined || isNaN(value)) return '—';
  if (!isFinite(value)) return '∞';
  // Clean up floating point: show up to 6 decimal places, strip trailing zeros
  const str = parseFloat(value.toFixed(6)).toString();
  return str;
}

// ─── Safe Math Parser (Recursive Descent) ────────────────────────────────────
// Grammar:
//   expr     → term (('+' | '-') term)*
//   term     → unary (('*' | '/' | '%') unary)*
//   unary    → '-' unary | primary
//   primary  → NUMBER | '(' expr ')'

function safeEval(expression) {
  const tokens = tokenize(expression);
  const parser = { tokens, pos: 0 };
  const result = parseExpr(parser);

  // Ensure all tokens were consumed
  if (parser.pos < parser.tokens.length) {
    throw new Error('Unexpected token: ' + parser.tokens[parser.pos].value);
  }

  return result;
}

function tokenize(expr) {
  const tokens = [];
  let i = 0;
  const s = expr.trim();

  while (i < s.length) {
    // Skip whitespace
    if (s[i] === ' ' || s[i] === '\t') {
      i++;
      continue;
    }

    // Number (including decimals)
    if ((s[i] >= '0' && s[i] <= '9') || (s[i] === '.' && i + 1 < s.length && s[i + 1] >= '0' && s[i + 1] <= '9')) {
      let num = '';
      while (i < s.length && ((s[i] >= '0' && s[i] <= '9') || s[i] === '.')) {
        num += s[i];
        i++;
      }
      tokens.push({ type: 'number', value: parseFloat(num) });
      continue;
    }

    // Operators
    if ('+-*/%'.includes(s[i])) {
      tokens.push({ type: 'op', value: s[i] });
      i++;
      continue;
    }

    // Parentheses
    if (s[i] === '(') {
      tokens.push({ type: 'lparen', value: '(' });
      i++;
      continue;
    }
    if (s[i] === ')') {
      tokens.push({ type: 'rparen', value: ')' });
      i++;
      continue;
    }

    throw new Error('Unexpected character: ' + s[i]);
  }

  return tokens;
}

function parseExpr(parser) {
  let left = parseTerm(parser);

  while (parser.pos < parser.tokens.length) {
    const tok = parser.tokens[parser.pos];
    if (tok.type === 'op' && (tok.value === '+' || tok.value === '-')) {
      parser.pos++;
      const right = parseTerm(parser);
      left = tok.value === '+' ? left + right : left - right;
    } else {
      break;
    }
  }

  return left;
}

function parseTerm(parser) {
  let left = parseUnary(parser);

  while (parser.pos < parser.tokens.length) {
    const tok = parser.tokens[parser.pos];
    if (tok.type === 'op' && (tok.value === '*' || tok.value === '/' || tok.value === '%')) {
      parser.pos++;
      const right = parseUnary(parser);
      if (tok.value === '*') left = left * right;
      else if (tok.value === '/') left = right === 0 ? Infinity : left / right;
      else left = left % right;
    } else {
      break;
    }
  }

  return left;
}

function parseUnary(parser) {
  if (parser.pos < parser.tokens.length) {
    const tok = parser.tokens[parser.pos];
    if (tok.type === 'op' && tok.value === '-') {
      parser.pos++;
      return -parseUnary(parser);
    }
    if (tok.type === 'op' && tok.value === '+') {
      parser.pos++;
      return parseUnary(parser);
    }
  }
  return parsePrimary(parser);
}

function parsePrimary(parser) {
  if (parser.pos >= parser.tokens.length) {
    throw new Error('Unexpected end of expression');
  }

  const tok = parser.tokens[parser.pos];

  if (tok.type === 'number') {
    parser.pos++;
    return tok.value;
  }

  if (tok.type === 'lparen') {
    parser.pos++; // consume '('
    const result = parseExpr(parser);
    if (parser.pos >= parser.tokens.length || parser.tokens[parser.pos].type !== 'rparen') {
      throw new Error('Missing closing parenthesis');
    }
    parser.pos++; // consume ')'
    return result;
  }

  throw new Error('Unexpected token: ' + tok.value);
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

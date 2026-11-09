/**
 * Expression language for parameters and requirement rules.
 *
 * Small, dependency-free Pratt parser + evaluator. Deliberately tiny so that
 * every error message can be written in plain Portuguese and every formula
 * can be statically analysed for dependencies (the engine needs the
 * dependency graph before evaluating anything).
 *
 * Grammar (precedence low → high):
 *   or | and | not | comparison (< <= > >= == !=) | + - | * / | unary - | ^ (right assoc) | call / primary
 *
 * References:
 *   eps.mass            parameter "mass" of entity "eps"
 *   self.mass  /  mass  parameter of the entity that owns the formula
 *   param("req-1","x")  same as ref, for ids that contain "-"
 *   children("eps","mass")     list of that parameter over the direct children of eps
 *   descendants("eps","mass")  same over every descendant
 *   total("mass")              list over every entity that owns a leaf "mass" parameter
 *   leaves("eps","mass")       list over the leaf owners of "mass" below eps (eps itself if none)
 *   …("mass", "margin")        any of the four above with a trailing "margin" applies each
 *                              parameter's own margin (maturity preset or explicit)
 *   engine.budget_mass_total   values the engine derives (budgets, modes) — rules only
 * Lists are consumed by sum(), rss(), max(), min(), avg(), count().
 */

export type Value = number | boolean | string | Value[];

export type AstNode =
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'ref'; path: string }
  | { k: 'un'; op: '-' | 'not'; e: AstNode }
  | { k: 'bin'; op: string; l: AstNode; r: AstNode }
  | { k: 'call'; fn: string; args: AstNode[] };

export class ExprError extends Error {
  constructor(message: string, public readonly position?: number) {
    super(message);
    this.name = 'ExprError';
  }
}

/* ── Tokenizer ────────────────────────────────────────────── */

type Token =
  | { t: 'num'; v: number; pos: number }
  | { t: 'id'; v: string; pos: number }
  | { t: 'str'; v: string; pos: number }
  | { t: 'op'; v: string; pos: number }
  | { t: 'punct'; v: '(' | ')' | ','; pos: number }
  | { t: 'eof'; pos: number };

const OPERATORS = ['<=', '>=', '==', '!=', '&&', '||', '<', '>', '+', '-', '*', '/', '^', '!'];

export function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      const m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(src.slice(i));
      if (!m) throw new ExprError(`Número inválido na posição ${i}`, i);
      out.push({ t: 'num', v: Number(m[0]), pos: i });
      i += m[0].length;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*/.exec(src.slice(i));
      const v = m![0];
      i += v.length;
      const lower = v.toLowerCase();
      if (lower === 'and' || lower === 'or' || lower === 'not') out.push({ t: 'op', v: lower, pos: i - v.length });
      else out.push({ t: 'id', v, pos: i - v.length });
      continue;
    }
    if (ch === '"' || ch === "'") {
      const end = src.indexOf(ch, i + 1);
      if (end < 0) throw new ExprError(`String sem fechamento na posição ${i}`, i);
      out.push({ t: 'str', v: src.slice(i + 1, end), pos: i });
      i = end + 1;
      continue;
    }
    if (ch === '(' || ch === ')' || ch === ',') {
      out.push({ t: 'punct', v: ch, pos: i });
      i++;
      continue;
    }
    const op = OPERATORS.find((o) => src.startsWith(o, i));
    if (op) {
      out.push({ t: 'op', v: op === '&&' ? 'and' : op === '||' ? 'or' : op === '!' ? 'not' : op, pos: i });
      i += op.length;
      continue;
    }
    throw new ExprError(`Caractere inesperado "${ch}" na posição ${i}`, i);
  }
  out.push({ t: 'eof', pos: src.length });
  return out;
}

/* ── Parser ───────────────────────────────────────────────── */

const BIN_PREC: Record<string, number> = {
  or: 1, and: 2,
  '<': 4, '<=': 4, '>': 4, '>=': 4, '==': 4, '!=': 4,
  '+': 5, '-': 5,
  '*': 6, '/': 6,
  '^': 8,
};

export function parse(src: string): AstNode {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const next = () => toks[p++];
  const expect = (t: Token['t'], v?: string) => {
    const tk = next();
    if (tk.t !== t || (v !== undefined && 'v' in tk && tk.v !== v)) {
      throw new ExprError(`Esperava "${v ?? t}" na posição ${tk.pos}`, tk.pos);
    }
    return tk;
  };

  function parseExpr(minPrec: number): AstNode {
    let left = parseUnary();
    for (;;) {
      const tk = peek();
      if (tk.t !== 'op') break;
      const prec = BIN_PREC[tk.v];
      if (prec === undefined || prec < minPrec) break;
      next();
      // '^' is right-associative
      const right = parseExpr(tk.v === '^' ? prec : prec + 1);
      left = { k: 'bin', op: tk.v, l: left, r: right };
    }
    return left;
  }

  function parseUnary(): AstNode {
    const tk = peek();
    if (tk.t === 'op' && tk.v === '-') { next(); return { k: 'un', op: '-', e: parseExpr(7) }; }
    if (tk.t === 'op' && tk.v === 'not') { next(); return { k: 'un', op: 'not', e: parseExpr(3) }; }
    if (tk.t === 'op' && tk.v === '+') { next(); return parseExpr(7); }
    return parsePrimary();
  }

  function parsePrimary(): AstNode {
    const tk = next();
    if (tk.t === 'num') return { k: 'num', v: tk.v };
    if (tk.t === 'str') return { k: 'str', v: tk.v };
    if (tk.t === 'punct' && tk.v === '(') {
      const e = parseExpr(1);
      expect('punct', ')');
      return e;
    }
    if (tk.t === 'id') {
      if (peek().t === 'punct' && (peek() as { v: string }).v === '(') {
        next();
        const args: AstNode[] = [];
        if (!(peek().t === 'punct' && (peek() as { v: string }).v === ')')) {
          for (;;) {
            args.push(parseExpr(1));
            const sep = peek();
            if (sep.t === 'punct' && sep.v === ',') { next(); continue; }
            break;
          }
        }
        expect('punct', ')');
        return { k: 'call', fn: tk.v.toLowerCase(), args };
      }
      return { k: 'ref', path: tk.v };
    }
    throw new ExprError(`Expressão incompleta na posição ${tk.pos}`, tk.pos);
  }

  const ast = parseExpr(1);
  const end = peek();
  if (end.t !== 'eof') throw new ExprError(`Sobrou "${'v' in end ? end.v : ''}" na posição ${end.pos}`, end.pos);
  return ast;
}

/* ── Static analysis ──────────────────────────────────────── */

/** What the evaluator needs from the model to resolve structural functions. */
export interface ModelShape {
  /** Direct children (by parentId) of an entity. */
  children(entityId: string): string[];
  /** Every descendant (by parentId) of an entity. */
  descendants(entityId: string): string[];
  /** Every entity id in the model. */
  allEntities(): string[];
  /** True when the entity declares a parameter with this id. */
  hasParam(entityId: string, paramId: string): boolean;
}

export interface RefContext {
  shape: ModelShape;
  /** Entity that owns the formula being analysed ("self"). */
  selfEntityId: string;
}

function literalArgs(node: Extract<AstNode, { k: 'call' }>): string[] | null {
  const out: string[] = [];
  for (const a of node.args) {
    if (a.k !== 'str') return null;
    out.push(a.v);
  }
  return out;
}

/** Resolve a `ref` path to a parameter key ("entity.param"). */
export function resolveRefPath(path: string, selfEntityId: string): string {
  const parts = path.split('.');
  if (parts.length === 1) return `${selfEntityId}.${parts[0]}`;
  if (parts[0] === 'self') return `${selfEntityId}.${parts.slice(1).join('.')}`;
  return path;
}

/** Owners of a leaf parameter: entities with the param whose descendants don't have it. */
export function leafOwners(shape: ModelShape, candidates: string[], paramId: string): string[] {
  return candidates.filter(
    (id) => shape.hasParam(id, paramId) && !shape.descendants(id).some((d) => shape.hasParam(d, paramId)),
  );
}

/** Expand a structural function call into the parameter keys it reads. */
export function structuralKeys(
  node: Extract<AstNode, { k: 'call' }>,
  ctx: RefContext,
): string[] | null {
  return structuralCall(node, ctx)?.keys ?? null;
}

const STRUCTURAL = new Set(['param', 'children', 'descendants', 'leaves', 'total']);

/** Same as structuralKeys, also saying whether the call asked for margined values. */
export function structuralCall(
  node: Extract<AstNode, { k: 'call' }>,
  ctx: RefContext,
): { keys: string[]; margin: boolean } | null {
  if (!STRUCTURAL.has(node.fn)) return null;
  let args = literalArgs(node);
  let margin = false;
  if (args && args.length > 0 && args[args.length - 1].toLowerCase() === 'margin' && node.fn !== 'param') {
    margin = true;
    args = args.slice(0, -1);
  }
  const keys = expandStructural(node.fn, args, ctx);
  return keys ? { keys, margin } : null;
}

function expandStructural(fn: string, args: string[] | null, ctx: RefContext): string[] | null {
  const { shape } = ctx;
  switch (fn) {
    case 'param':
      if (!args || args.length !== 2) throw new ExprError('param() precisa de dois textos: param("entidade", "parametro")');
      return [`${args[0]}.${args[1]}`];
    case 'children':
      if (!args || args.length !== 2) throw new ExprError('children() precisa de dois textos: children("entidade", "parametro")');
      return shape.children(args[0]).filter((c) => shape.hasParam(c, args[1])).map((c) => `${c}.${args[1]}`);
    case 'descendants':
      if (!args || args.length !== 2) throw new ExprError('descendants() precisa de dois textos: descendants("entidade", "parametro")');
      return shape.descendants(args[0]).filter((c) => shape.hasParam(c, args[1])).map((c) => `${c}.${args[1]}`);
    case 'leaves': {
      if (!args || args.length !== 2) throw new ExprError('leaves() precisa de dois textos: leaves("entidade", "parametro")');
      const below = leafOwners(shape, shape.descendants(args[0]), args[1]);
      const owners = below.length > 0 ? below : (shape.hasParam(args[0], args[1]) ? [args[0]] : []);
      return owners.map((c) => `${c}.${args[1]}`);
    }
    case 'total':
      if (!args || args.length !== 1) throw new ExprError('total() precisa de um texto: total("parametro")');
      return leafOwners(shape, shape.allEntities(), args[0]).map((c) => `${c}.${args[0]}`);
    default:
      return null;
  }
}

/** Parameter keys an expression reads. */
export function collectDependencies(ast: AstNode, ctx: RefContext): string[] {
  const deps = new Set<string>();
  const walk = (n: AstNode) => {
    switch (n.k) {
      case 'ref': deps.add(resolveRefPath(n.path, ctx.selfEntityId)); break;
      case 'un': walk(n.e); break;
      case 'bin': walk(n.l); walk(n.r); break;
      case 'call': {
        const keys = structuralKeys(n, ctx);
        if (keys) keys.forEach((k) => deps.add(k));
        else n.args.forEach(walk);
        break;
      }
      default: break;
    }
  };
  walk(ast);
  return [...deps];
}

/* ── Evaluator ────────────────────────────────────────────── */

export interface EvalContext extends RefContext {
  /** Numeric value of a parameter key; undefined when unknown/not computed. */
  lookup(key: string): number | undefined;
  /** Value with the parameter's own margin applied (for "…, margin" calls). */
  lookupMargined?(key: string): number | undefined;
}

const ECSS_MARGIN: Record<string, number> = { cots: 0.05, modified: 0.1, new: 0.2 };

function num(v: Value, what: string): number {
  if (typeof v !== 'number') throw new ExprError(`${what} precisa ser um número`);
  return v;
}

function flatten(values: Value[]): number[] {
  const out: number[] = [];
  for (const v of values) {
    if (Array.isArray(v)) out.push(...flatten(v));
    else if (typeof v === 'number') out.push(v);
    else throw new ExprError('Listas só podem conter números');
  }
  return out;
}

export function evaluate(ast: AstNode, ctx: EvalContext): Value {
  const ev = (n: AstNode): Value => {
    switch (n.k) {
      case 'num': return n.v;
      case 'str': return n.v;
      case 'ref': {
        const key = resolveRefPath(n.path, ctx.selfEntityId);
        const v = ctx.lookup(key);
        if (v === undefined) throw new ExprError(`Parâmetro "${key}" não existe ou não pôde ser calculado`);
        return v;
      }
      case 'un': {
        const v = ev(n.e);
        if (n.op === '-') return -num(v, 'Sinal negativo');
        if (typeof v !== 'boolean') throw new ExprError('"not" precisa de verdadeiro/falso');
        return !v;
      }
      case 'bin': {
        if (n.op === 'and' || n.op === 'or') {
          const l = ev(n.l);
          if (typeof l !== 'boolean') throw new ExprError(`"${n.op}" precisa de verdadeiro/falso`);
          if (n.op === 'and' && !l) return false;
          if (n.op === 'or' && l) return true;
          const r = ev(n.r);
          if (typeof r !== 'boolean') throw new ExprError(`"${n.op}" precisa de verdadeiro/falso`);
          return r;
        }
        const l = ev(n.l);
        const r = ev(n.r);
        switch (n.op) {
          case '+': return num(l, 'Soma') + num(r, 'Soma');
          case '-': return num(l, 'Subtração') - num(r, 'Subtração');
          case '*': return num(l, 'Multiplicação') * num(r, 'Multiplicação');
          case '/': {
            const d = num(r, 'Divisão');
            if (d === 0) throw new ExprError('Divisão por zero');
            return num(l, 'Divisão') / d;
          }
          case '^': return Math.pow(num(l, 'Potência'), num(r, 'Potência'));
          case '<': return num(l, 'Comparação') < num(r, 'Comparação');
          case '<=': return num(l, 'Comparação') <= num(r, 'Comparação');
          case '>': return num(l, 'Comparação') > num(r, 'Comparação');
          case '>=': return num(l, 'Comparação') >= num(r, 'Comparação');
          case '==': return l === r;
          case '!=': return l !== r;
          default: throw new ExprError(`Operador desconhecido "${n.op}"`);
        }
      }
      case 'call': return callFn(n, ctx, ev);
      default: throw new ExprError('Nó desconhecido');
    }
  };
  return ev(ast);
}

function callFn(
  n: Extract<AstNode, { k: 'call' }>,
  ctx: EvalContext,
  ev: (x: AstNode) => Value,
): Value {
  const structural = structuralCall(n, ctx);
  if (structural) {
    const values = structural.keys.map((k) => {
      const v = structural.margin && ctx.lookupMargined ? ctx.lookupMargined(k) : ctx.lookup(k);
      if (v === undefined) throw new ExprError(`Parâmetro "${k}" não pôde ser calculado`);
      return v;
    });
    // param("e","p") names exactly one parameter → scalar; the others are lists.
    return n.fn === 'param' ? values[0] : values;
  }
  const args = n.args.map(ev);
  const nums = () => flatten(args);
  switch (n.fn) {
    case 'sum': return nums().reduce((a, b) => a + b, 0);
    case 'rss': return Math.sqrt(nums().reduce((a, b) => a + b * b, 0));
    case 'max': { const xs = nums(); if (xs.length === 0) throw new ExprError('max() de lista vazia'); return Math.max(...xs); }
    case 'min': { const xs = nums(); if (xs.length === 0) throw new ExprError('min() de lista vazia'); return Math.min(...xs); }
    case 'avg': { const xs = nums(); if (xs.length === 0) throw new ExprError('avg() de lista vazia'); return xs.reduce((a, b) => a + b, 0) / xs.length; }
    case 'count': return nums().length;
    case 'abs': return Math.abs(num(args[0], 'abs()'));
    case 'sqrt': return Math.sqrt(num(args[0], 'sqrt()'));
    case 'pow': return Math.pow(num(args[0], 'pow()'), num(args[1], 'pow()'));
    case 'log10': return Math.log10(num(args[0], 'log10()'));
    case 'ln': return Math.log(num(args[0], 'ln()'));
    case 'exp': return Math.exp(num(args[0], 'exp()'));
    case 'floor': return Math.floor(num(args[0], 'floor()'));
    case 'ceil': return Math.ceil(num(args[0], 'ceil()'));
    case 'round': {
      const d = args.length > 1 ? num(args[1], 'round()') : 0;
      const f = Math.pow(10, d);
      return Math.round(num(args[0], 'round()') * f) / f;
    }
    case 'db': return 10 * Math.log10(num(args[0], 'db()'));
    case 'fromdb': return Math.pow(10, num(args[0], 'fromdb()') / 10);
    // Angles in degrees, as they appear in orbit values (engine.orbit_beta_deg).
    case 'cosd': return Math.cos((num(args[0], 'cosd()') * Math.PI) / 180);
    case 'sind': return Math.sin((num(args[0], 'sind()') * Math.PI) / 180);
    case 'withmargin': return num(args[0], 'withMargin()') * (1 + num(args[1], 'withMargin()'));
    case 'ecssmargin': {
      const maturity = String(args[1] ?? '').toLowerCase();
      const m = ECSS_MARGIN[maturity];
      if (m === undefined) throw new ExprError('ecssMargin(): maturidade deve ser "cots", "modified" ou "new"');
      return num(args[0], 'ecssMargin()') * (1 + m);
    }
    case 'if': {
      if (typeof args[0] !== 'boolean') throw new ExprError('if() precisa de verdadeiro/falso na primeira posição');
      return args[0] ? args[1] : args[2];
    }
    case 'clamp': return Math.min(Math.max(num(args[0], 'clamp()'), num(args[1], 'clamp()')), num(args[2], 'clamp()'));
    default: throw new ExprError(`Função desconhecida "${n.fn}"`);
  }
}

export const ECSS_MATURITY_MARGIN = ECSS_MARGIN;

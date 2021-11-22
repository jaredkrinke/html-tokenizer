import { Tokenizer } from './tokenizer.ts';

/**
 * A list of tags which are self-closing in HTML.
 */
 const SELF_CLOSING_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'command',
  'embed',
  'hr',
  'img',
  'input',
  'keygen',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

/**
 * A list of tags which are automatically closed
 * when closing tags for their parents are encountered.
 */
const CLOSED_BY_PARENTS = new Set([
  'p',
  'li',
  'dd',
  'rb',
  'rt',
  'rtc',
  'rp',
  'optgroup',
  'option',
  'tbody',
  'tfoot',
  'tr',
  'td',
  'th',
]);

/**
 * Tags which are closed when a start tag
 * of another type ocurrs.
 */
const CLOSED_BY_SIBLINGS: { [tag: string]: Set<string> | undefined } = {
  p: new Set([
    'address',
    'article',
    'aside',
    'blockquote',
    'div',
    'dl',
    'fieldset',
    'footer',
    'form',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'header',
    'hgroup',
    'hr',
    'main',
    'nav',
    'ol',
    'p',
    'pre',
    'section',
    'table',
    'ul',
  ]),
  li: new Set(['li']),
  dt: new Set(['dt', 'dd']),
  dd: new Set(['dt', 'dd']),
  rb: new Set(['rb', 'rt', 'rtc', 'rp']),
  rt: new Set(['rb', 'rt', 'rtc', 'rp']),
  rtc: new Set(['rb', 'rtc', 'rp']),
  rp: new Set(['rb', 'rt', 'rtc', 'rp']),
  optgroup: new Set(['optgroup']),
  option: new Set(['option', 'optgroup']),
  thead: new Set(['tbody', 'tfoot']),
  tbody: new Set(['tbody', 'tfoot']),
  tfoot: new Set(['tbody']),
  tr: new Set(['tr']),
  td: new Set(['td', 'th']),
  th: new Set(['td', 'th']),
};

/**
 * Determine whether a tag is a self-closing tag.
 */
function isSelfClosing(tag: string): boolean {
  return SELF_CLOSING_TAGS.has(tag);
}

/**
 * Determine whether a tag is closed by another tag
 */
function isClosedBy(tag: string, otherTag: string): boolean {
  return CLOSED_BY_SIBLINGS[tag]?.has(otherTag) ?? false;
}

/** Determine whether a tag is auto-closed by its parent. */
function isClosedByParent(tag: string): boolean {
  return CLOSED_BY_PARENTS.has(tag);
}

/**
 * Mutable FILO stack object.
 */
 class Stack<T> {

  private items: T[];

  constructor() {
    this.items = [];
  }

  push(t: T): void {
    this.items.push(t);
  }

  pop(): T | undefined {
    return this.items.pop();
  }

  peek(n = 0): T | undefined {
    const idx = this.items.length + -1 + -n;
    return this.items[idx];
  }

  size(): number {
    return this.items.length;
  }

  *drain(): IterableIterator<T> {
    for (let i=this.items.length; i>0; i--) {
      yield this.items[i-1];
    }
    this.items.length = 0;
  }
}

/**
 * A token emitted during a parsing run.
 */
export type ParseToken
  = OpenParseToken
  | TextParseToken
  | CommentParseToken
  | CloseParseToken;

/**
 * Opening tag.
 */
export interface OpenParseToken {
  type: 'open';
  /** Name of tag. */
  name: string;
  /** Set of attributes. */
  attributes: Attributes;
  /** Whether this tag is self-closing. */
  selfClosing: boolean;
}

/**
 * Text token.
 */
export interface TextParseToken {
  type: 'text';
  /** The text content. */
  text: string;
}

/**
 * Comment.
 */
export interface CommentParseToken {
  type: 'comment';
  /** The comment content. */
  text: string;
}

/**
 * Closing tag.
 */
export interface CloseParseToken {
  type: 'close';
  /** Name of the tag. */
  name: string;
  /** Whether tag was self closing. */
  selfClosing: boolean;
}

/**
 * A set of attributes.
 */
export interface Attributes {
  [attrName: string]: string;
}

interface PendingTag {
  name: string;
  attributes: Attributes;
}

/**
 * An object capable of parsing HTML.
 */
export class Parser {

  private readonly tokenizer: Tokenizer;

  /**
   * Static method to parse HTML without instantiating a Parser instance.
   * @param html HTML string to parse.
   * @param opts Optional parser configuration options.
   */
  static parse(html: string) {
    const parser = new Parser();
    return parser.parse(html);
  }

  /**
   * Static factory to create a parser.
   * @param opts Parser options.
   */
  static from() {
    return new Parser();
  }

  private constructor() {
    this.tokenizer = Tokenizer.from();
    Object.freeze(this);
  }

  /**
   * Parse an HTML string. Returns an iterator, thus allowing parse
   * tokens to be consumed via for/of or other iteration mechanisms.
   * @param html HTML string to parse.
   */
  *parse(html: string): IterableIterator<ParseToken> {
    const tkzr = this.tokenizer;
    const stack = new Stack<PendingTag>();
    let pendingTag: PendingTag | undefined = undefined;

    for (const tkn of tkzr.tokenize(html)) {
      if (tkn.type === 'opening-tag') {
        pendingTag = { name: tkn.name, attributes: {} };
      } else if (tkn.type === 'closing-tag') {
        const current = stack.peek();
        const parent = stack.peek(1);
        if (current) {
          if (current.name === tkn.name) {
            stack.pop();
            yield { type: 'close', name: current.name, selfClosing: false };
          } else {
            if (parent && parent.name === tkn.name && isClosedByParent(current.name)) {
              stack.pop();
              yield { type: 'close', name: current.name, selfClosing: false };
              stack.pop();
              yield { type: 'close', name: parent.name, selfClosing: false };
            }
          }
        }
      } else if (tkn.type === 'opening-tag-end') {
        if (pendingTag) {
          const mightBeClosed = stack.peek();
          const isSelfClose = tkn.token === '/>' || isSelfClosing(tkn.name);
          if (mightBeClosed && isClosedBy(mightBeClosed.name, pendingTag.name)) {
            stack.pop();
            yield { type: 'close', name: mightBeClosed.name, selfClosing: false };
          }
          yield { type: 'open', name: pendingTag.name, attributes: pendingTag.attributes, selfClosing: isSelfClose };
          if (isSelfClose) {
            yield { type: 'close', name: pendingTag.name, selfClosing: true };
          } else {
            stack.push(pendingTag);
          }
        } else {
          yield { type: 'text', text: tkn.token };
        }
      } else if (tkn.type === 'text') {
        yield tkn;
      } else if (tkn.type === 'comment') {
        yield tkn;
      } else if (tkn.type === 'attribute') {
        if (pendingTag) {
          pendingTag.attributes[tkn.name] = tkn.value;
        }
      }
    }
    for (const next of stack.drain()) {
      yield { type: 'close', name: next.name, selfClosing: false };
    }
  }
}

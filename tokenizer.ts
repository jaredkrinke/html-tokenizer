// deno-lint-ignore-file no-cond-assign

// Chunker
function chunker(regex: RegExp) {
   return (str: string, pos: number) => {
     regex.lastIndex = pos;
     const match = regex.exec(str);
     if (!match || match.index !== pos) {
       return undefined;
     } else {
       return {
         length: match[1].length,
         match,
       };
     }
   };
}

const chunks = {
  /**
   * Opening tag chunker function.
   */
  getOpeningTag: chunker(/(<(([a-z0-9-]+:)?[a-z0-9-]+))/ig),

  /**
    * Text node chunker function.
    */
  getText: chunker(/([^<]+)/g),
  
  /**
    * Closing tag chunker function.
    */
  getClosingTag: chunker(/(<\/(([a-z0-9-]+:)?[a-z0-9-]+)>)/ig),
  
  /**
    * Comment open chunker function.
    */
  getCommentOpen: chunker(/(<!--)/g),
  
  /**
    * Comment content chunker function.
    */
  getComment: chunker(/(([\s\S]*?)-->)/g),
  
  /**
    * Script content chunker function.
    */
  getScript: chunker(/(([\s\S]*?)<\/script>)/g),
  
  /**
    * End tag chunker function.
    */
  getTagEnd: chunker(/(\s*(\/?>))/g),
  
  /**
    * Attribute name chunker function.
    */
  getAttributeName: chunker(/(\s+(([a-z0-9\-_]+:)?[a-z0-9\-_]+)(\s*=\s*)?)/ig),
};
 
// Attribute reader
const PATTERN = /(\s*([^>\s]*))/g;
const QUOTES = new Set('"\'');

/**
 * Extract an attribute from a chunk of text.
 */
export default function readAttribute(str: string, pos: number) {
  const quote = str.charAt(pos);
  const pos1 = pos + 1;
  if (QUOTES.has(quote)) {
    const nextQuote = str.indexOf(quote, pos1);
    if (nextQuote === -1) {
      return { length: str.length - pos, value: str.substring(pos1) };
    } else {
      return { length: (nextQuote - pos) + 1, value: str.substring(pos1, nextQuote) };
    }
  } else {
    PATTERN.lastIndex = pos;
    const match = PATTERN.exec(str) || [];
    return { length: match[1].length, value: match[2] };
  }
}

/**
 * A token emitted during a tokenizing run.
 */
export type Token
  = StartToken
  | OpeningTagToken
  | AttributeToken
  | OpeningTagEndToken
  | TextToken
  | CommentToken
  | ClosingTagToken
  | DoneToken;

/**
 * Start of tokenizing run.
 */
export interface StartToken {
  type: 'start';
}

/**
 * Beginning of opening tag.
 */
export interface OpeningTagToken {
  type: 'opening-tag';
  name: string;
}

/**
 * Attribute.
 */
export interface AttributeToken {
  type: 'attribute';
  name: string;
  value: string;
}

/**
 * End of opening tag.
 */
export interface OpeningTagEndToken {
  type: 'opening-tag-end';
  name: string;
  token: '>' | '/>';
}

/**
 * Text node chunk.
 */
export interface TextToken {
  type: 'text';
  text: string;
}

/**
 * Comment.
 */
export interface CommentToken {
  type: 'comment';
  text: string;
}

/**
 * Closing tag.
 */
export interface ClosingTagToken {
  type: 'closing-tag';
  name: string;
}

/**
 * End of tokenizing run.
 */
export interface DoneToken {
  type: 'done';
}

type State
  = 'inTag'
  | 'inComment'
  | 'inText'
  | 'inScript';

/**
 * A low-level tokenizer utility used by the HTML parser.
 */
export class Tokenizer {

  /**
   * Static method to tokenize HTML without instantiating a Tokenizer instance.
   * @param html HTML string to tokenize.
   * @param opts Optional tokenizer configuration options.
   */
  static tokenize(html: string) {
    const tokenizer = new Tokenizer();
    return tokenizer.tokenize(html);
  }

  /**
   * Static factory to create a tokenizer.
   * @param opts Tokenizer options.
   */
  static from() {
    return new Tokenizer();
  }

  private constructor() {
    Object.freeze(this);
  }

  /**
   * Tokenize an HTML string. Returns an iterator, thus allowing
   * tokens to be consumed via for/of or other iteration mechanisms.
   * @param html HTML string to tokenize.
   */
  *tokenize(html: string): IterableIterator<Token> {
    let currentText;
    for (const tkn of this._tokenize(html)) {
      if (tkn.type === 'text') {
        const text = tkn.text;
        if (currentText === undefined) {
          currentText = text;
        } else {
          currentText += text;
        }
      } else {
        if (currentText) {
          yield { type: 'text', text: currentText };
          currentText = undefined;
        }
        yield tkn;
      }
    }
  }

  private *_tokenize(html: string): IterableIterator<Token> {
    yield { type: 'start' };
    let pos = 0;
    let state: State = 'inText';
    let currentTag = '';
    let next;
    while (pos < html.length) {
      if (state === 'inText') {
        const isBracket = html.charAt(pos) === '<'; // cheap pre-emptive check
        if (isBracket && (next = chunks.getOpeningTag(html, pos))) {
          pos += next.length;
          currentTag = next.match[2];
          yield { type: 'opening-tag', name: currentTag };
          state = 'inTag';
        } else if (isBracket && (next = chunks.getClosingTag(html, pos))) {
          pos += next.length;
          yield { type: 'closing-tag', name: next.match[2] };
        } else if (isBracket && (next = chunks.getCommentOpen(html, pos))) {
          pos += next.length;
          state = 'inComment';
        } else if (next = chunks.getText(html, pos)) {
          pos += next.length;
          yield { type: 'text', text: next.match[1] };
        } else {
          const text = html.substring(pos, pos + 1);
          pos += 1;
          yield { type: 'text', text };
        }
      } else if (state === 'inComment') {
        if (next = chunks.getComment(html, pos)) {
          pos += next.length;
          yield { type: 'comment', text: next.match[2] };
          state = 'inText';
        } else {
          yield { type: 'comment', text: html.substring(pos) };
          break;
        }
      } else if (state === 'inScript') {
        if (next = chunks.getScript(html, pos)) {
          pos += next.length;
          yield { type: 'text', text: next.match[2] };
          yield { type: 'closing-tag', name: 'script' };
          state = 'inText';
        } else {
          yield { type: 'text', text: html.substring(pos) };
          break;
        }
      } else if (state === 'inTag') {
        if (next = chunks.getAttributeName(html, pos)) {
          pos += next.length;
          const name = next.match[2];
          const hasVal = next.match[4];
          if (hasVal) {
            const read = readAttribute(html, pos);
            pos += read.length;
            yield { type: 'attribute', name, value: read.value };
          } else {
            yield { type: 'attribute', name, value: '' };
          }
        } else if (next = chunks.getTagEnd(html, pos)) {
          pos += next.length;
          const token = next.match[2] as '>' | '/>';
          yield { type: 'opening-tag-end', name: currentTag, token };
          state = currentTag === 'script' ? 'inScript' : 'inText';
        } else {
          state = 'inText';
        }
      } else {
        break;
      }
    }
    yield { type: 'done' };
  }
}

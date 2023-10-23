import { SourceLocation } from './source-location';

/** Simplified variant of the Codemirror StringStream.
 *
 * https://codemirror.net/docs/ref/#language.StringStream
 *
 * Designed to be passed to the advance() function of a StreamParser.
 */
export interface StringStream {
  /** Matches a string or a regexp (which must start with ^ to only
   * match the start of the string) and advances the current position
   * if found. Returns a non-empty matched string, or null.
   */
  eat(match: string | RegExp): string | null;

  /** Same as eat(), but doesn't advance the current position. */
  peek(match: string | RegExp): string | null;

  /** Eats to the end of the line and returns the matched string,
   * possibly the empty string if at eol().
   */
  eatToEol(): string;

  /** True if at the start of a line. */
  sol(): boolean;

  /** True if at the end of a line. */
  eol(): boolean;

  /** Returns the SourceLocation covered since the streamstring
   * was initialized (which, in the stream parser, always happens
   * immediately before advance() is called).
   */
  matchedLocation(): SourceLocation;
}

export interface ExtendedStringStream extends StringStream {
  currentColumn(): number;
}

export function makeStream(
  baseString: string,
  lineNumber: number,
  startingColumn: number,
): ExtendedStringStream {
  let str = baseString.slice(startingColumn - 1);
  let currentColumn = startingColumn;

  function match(match: string | RegExp, advance: boolean) {
    if (typeof match === 'string') {
      if (str.startsWith(match)) {
        if (advance) {
          str = str.slice(match.length);
          currentColumn += match.length;
        }
        return match;
      }
      return null;
    }
    const found = str.match(match);
    if (!found || found[0] === '') {
      return null;
    }
    if (found.index !== 0) {
      throw new Error(`Misconfigured parser, regexp ${match} does not match only start of line`);
    }
    if (advance) {
      str = str.slice(found[0].length);
      currentColumn += found[0].length;
    }
    return found[0];
  }

  return {
    eat: (m) => match(m, true),
    peek: (m) => match(m, false),
    eatToEol: () => {
      const result = str;
      currentColumn += result.length;
      str = '';
      return result;
    },
    sol: () => currentColumn === 1,
    eol: () => str === '',
    currentColumn: () => currentColumn,
    matchedLocation: () => ({
      start: { line: lineNumber, column: startingColumn },
      end: { line: lineNumber, column: currentColumn },
    }),
  };
}

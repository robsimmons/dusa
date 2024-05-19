import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { StreamLanguage, syntaxHighlighting } from '@codemirror/language';
import { Diagnostic, linter } from '@codemirror/lint';
import { EditorState, RangeSet, StateEffect, StateField } from '@codemirror/state';
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  keymap,
  lineNumbers,
  tooltips,
} from '@codemirror/view';
import { classHighlighter } from '@lezer/highlight';

import { ParserState, dusaTokenizer } from '../language/dusa-tokenizer.js';
import { StringStream } from '../parsing/string-stream.js';
import { Issue, parseWithStreamParser } from '../parsing/parser.js';
import { SourcePosition } from '../client.js';
import { parseTokens } from '../language/dusa-parser.js';
import { ParsedDeclaration, visitPropsInProgram, visitTermsinProgram } from '../language/syntax.js';
import { check } from '../language/check.js';

const bogusPosition = {
  start: { line: 1, column: 1 },
  end: { line: 1, column: 2 },
};
/** Create a Codemirror-compliant parser from our stream parser.
 * The token method is given a Codemirror-style StringStream,
 * and we have to use that to implement the StringStream interface
 * that our parser expects. Because we're not using the syntax
 * tree, we can feed bogus SourceLocation information to matchedLocation.
 */
const parser = StreamLanguage.define<{ state: ParserState }>({
  name: 'Dusa',
  startState: () => ({ state: dusaTokenizer.startState }),
  token: (stream, cell) => {
    const stream2: StringStream = {
      eat(pattern) {
        const result = stream.match(pattern);
        if (!result) return null;
        if (result === true) {
          if (typeof pattern === 'string') return pattern;
          return 'bogus';
        }
        return result[0];
      },
      peek(pattern) {
        const fragment = stream.string.slice(stream.pos);
        if (typeof pattern === 'string') {
          return fragment.startsWith(pattern) ? pattern : null;
        }
        return fragment.match(pattern)?.[0] || null;
      },
      eatToEol() {
        const pos = stream.pos;
        stream.skipToEnd();
        return stream.string.slice(pos);
      },
      sol: () => stream.sol(),
      eol: () => stream.eol(),
      matchedLocation: () => bogusPosition,
    };

    const result = dusaTokenizer.advance(stream2, cell.state);
    cell.state = result.state;
    return result.tag || null;
  },
  blankLine: (cell) => {
    const stream: StringStream = {
      eat: () => null,
      peek: () => null,
      eatToEol: () => '',
      sol: () => true,
      eol: () => true,
      matchedLocation: () => bogusPosition,
    };
    const result = dusaTokenizer.advance(stream, cell.state);
    cell.state = result.state;
  },
  copyState: ({ state }) => ({ state }),
  indent: () => null,
  languageData: {},
  tokenTable: {},
});

function position(state: EditorState, pos: SourcePosition) {
  return state.doc.line(pos.line).from + pos.column - 1;
}

function issueToDiagnostic(view: EditorView, issues: Issue[]): readonly Diagnostic[] {
  return issues
    .map((issue): Diagnostic | null => {
      if (!issue.loc) return null;
      return {
        from: position(view.state, issue.loc.start),
        to: position(view.state, issue.loc.end),
        severity: issue.severity,
        message: issue.msg,
      };
    })
    .filter((issue): issue is Diagnostic => issue !== null);
}

function dusaLinter(view: EditorView): readonly Diagnostic[] {
  const contents = view.state.doc.toString();
  const tokens = parseWithStreamParser(dusaTokenizer, contents);
  if (tokens.issues.length > 0) {
    return issueToDiagnostic(view, tokens.issues);
  }
  const parsed = parseTokens(tokens.document);
  const parsedIssues = parsed.filter((decl): decl is Issue => decl.type === 'Issue');
  const parsedDecls = parsed.filter((decl): decl is ParsedDeclaration => decl.type !== 'Issue');
  if (parsedIssues.length > 0) {
    return issueToDiagnostic(view, parsedIssues);
  }
  const { errors } = check(parsedDecls);
  return issueToDiagnostic(view, errors);
}

/** highlightPredicates is based on simplifying the Linter infrastructure */
const highlightPredicatesUpdateEffect = StateEffect.define<[number, number][]>();
const highlightPredicatesState = StateField.define<DecorationSet>({
  create() {
    return RangeSet.empty;
  },
  update(value, transaction) {
    if (transaction.docChanged) {
      value = value.map(transaction.changes);
    }

    for (const effect of transaction.effects) {
      if (effect.is(highlightPredicatesUpdateEffect)) {
        return RangeSet.of(
          effect.value.map(([from, to]) => ({
            from,
            to,
            value: Decoration.mark({ inclusive: true, class: 'tok-predicate' }),
          })),
          true,
        );
      }
    }
    return value;
  },
  provide(field) {
    return EditorView.decorations.from(field);
  },
});
const highlightPredicatesPlugin = ViewPlugin.define((view: EditorView) => {
  const delay = 750;
  let timeout: null | ReturnType<typeof setTimeout> = setTimeout(() => run(), delay);
  let nextUpdateCanHappenOnlyAfter = Date.now() + delay;
  function run() {
    const now = Date.now();
    // Debounce logic, part 1
    if (now < nextUpdateCanHappenOnlyAfter - 5) {
      timeout = setTimeout(run, nextUpdateCanHappenOnlyAfter - now);
    } else {
      timeout = null;
      const contents = view.state.doc.toString();
      const tokens = parseWithStreamParser(dusaTokenizer, contents);
      if (tokens.issues.length > 0) return;
      const parsed = parseTokens(tokens.document);
      const ranges: [number, number][] = [];
      const preds = new Set<string>();
      for (const prop of visitPropsInProgram(parsed)) {
        const start = position(view.state, prop.loc.start);
        ranges.push([start, start + prop.name.length]);
        preds.add(prop.name);
      }
      for (const term of visitTermsinProgram(parsed)) {
        if (term.type === 'const' && preds.has(term.name)) {
          const start = position(view.state, term.loc.start);
          ranges.push([start, start + term.name.length]);
        }
      }
      view.dispatch({ effects: [highlightPredicatesUpdateEffect.of(ranges)] });
    }
  }

  return {
    update(update: ViewUpdate) {
      if (update.docChanged) {
        // Debounce logic, part 2
        nextUpdateCanHappenOnlyAfter = Date.now() + delay;
        if (timeout === null) {
          timeout = setTimeout(run, delay);
        }
      }
    },
    destroy() {
      if (timeout !== null) {
        clearTimeout(timeout);
      }
    },
  };
});

export const codemirrorExtensions = [
  parser,
  syntaxHighlighting(classHighlighter),
  lineNumbers(),
  history(),
  EditorView.lineWrapping,
  linter(dusaLinter),
  tooltips({ parent: document.body }),
  highlightPredicatesPlugin,
  highlightPredicatesState,
  keymap.of([...defaultKeymap, ...historyKeymap]),
];

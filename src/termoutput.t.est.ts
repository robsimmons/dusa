import { test, expect } from 'vitest';
import { dataToTerm, termToData, termToString } from './termoutput.js';

test('termToString', () => {
  expect(termToString(dataToTerm(termToData(null)))).toBe('()');
  expect(termToString(dataToTerm(termToData(-12)))).toBe('-12');
  expect(termToString(dataToTerm(termToData(12n)))).toBe('12');
  expect(termToString(dataToTerm(termToData(false)))).toBe('bool#false');
  expect(termToString(dataToTerm(termToData('hello world')))).toBe('"hello world"');
  expect(
    termToString(
      dataToTerm(termToData({ name: 's', args: [{ name: 's', args: [{ name: 'z' }] }] })),
    ),
  ).toBe('s (s z)');
  expect(termToString(dataToTerm(termToData({ name: 'const', args: [] })))).toBe('const');
});

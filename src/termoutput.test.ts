import { test, expect } from 'vitest';
import { dataToTerm, termToData, termToString } from './termoutput.js';
import { HashCons } from './datastructures/data.js';

const data = new HashCons();

test('termToString', () => {
  expect(termToString(dataToTerm(data, termToData(data, null)))).toBe('()');
  expect(termToString(dataToTerm(data, termToData(data, -12)))).toBe('-12');
  expect(termToString(dataToTerm(data, termToData(data, 12n)))).toBe('12');
  expect(termToString(dataToTerm(data, termToData(data, false)))).toBe('bool#false');
  expect(termToString(dataToTerm(data, termToData(data, 'hello world')))).toBe('"hello world"');
  expect(
    termToString(
      dataToTerm(
        data,
        termToData(data, { name: 's', args: [{ name: 's', args: [{ name: 'z' }] }] }),
      ),
    ),
  ).toBe('s (s z)');
  expect(termToString(dataToTerm(data, termToData(data, { name: 'const', args: [] })))).toBe(
    'const',
  );
});

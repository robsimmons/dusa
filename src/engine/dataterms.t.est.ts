import { hide } from '../datastructures/data.js';
import { Substitution, match } from './dataterm-old.js';
import { test, expect } from 'vitest';

test('Match patterns with data', () => {
  // Type mismatch
  expect(match({}, { type: 'string', value: 'hi ' }, hide({ type: 'int', value: 2n }))).toBeNull();
  expect(match({}, { type: 'int', value: 2 }, hide({ type: 'string', value: 'there' }))).toBeNull();
  expect(
    match({}, { type: 'string', value: 'hi ' }, hide({ type: 'const', name: 'p', args: [] })),
  ).toBeNull();
  expect(
    match({}, { type: 'const', name: 'p', args: [] }, hide({ type: 'string', value: 'hi ' })),
  ).toBeNull();

  // Value mismatch
  expect(
    match({}, { type: 'string', value: '1' }, hide({ type: 'string', value: '2' })),
  ).toBeNull();
  expect(match({}, { type: 'int', value: 1 }, hide({ type: 'int', value: 2n }))).toBeNull();
  expect(
    match({}, { type: 'const', name: 'a', args: [] }, hide({ type: 'const', name: 'b', args: [] })),
  ).toBeNull();

  // Arity mismatch
  expect(
    match(
      {},
      { type: 'const', name: 'a', args: [] },
      hide({ type: 'const', name: 'a', args: [hide({ type: 'int', value: 2n })] }),
    ),
  ).toBeNull();
  expect(
    match(
      {},
      {
        type: 'const',
        name: 'a',
        args: [{ type: 'const', name: 'b', args: [{ type: 'int', value: 2 }] }],
      },
      hide({ type: 'const', name: 'a', args: [hide({ type: 'const', name: 'b', args: [] })] }),
    ),
  ).toBeNull();

  // Successful matches
  expect(match({}, { type: 'string', value: 'HI' }, hide({ type: 'string', value: 'HI' }))).toEqual(
    {},
  );
  expect(match({}, { type: 'int', value: 9 }, hide({ type: 'int', value: 9n }))).toEqual({});
  expect(
    match({}, { type: 'const', name: 'a', args: [] }, hide({ type: 'const', name: 'a', args: [] })),
  ).toEqual({});
  expect(
    match(
      {},
      { type: 'const', name: 'a', args: [{ type: 'const', name: 'b', args: [] }] },
      hide({ type: 'const', name: 'a', args: [hide({ type: 'const', name: 'b', args: [] })] }),
    ),
  ).toEqual({});

  // Matches with variables
  const empty: Substitution = {};
  expect(match(empty, { type: 'var', name: 'X' }, hide({ type: 'string', value: 'HI' }))).toEqual({
    X: hide({ type: 'string', value: 'HI' }),
  });
  expect(match(empty, { type: 'var', name: 'X' }, hide({ type: 'int', value: 4n }))).toEqual({
    X: hide({ type: 'int', value: 4n }),
  });
  expect(empty).toEqual({});

  const nonEmpty: Substitution = { X: hide({ type: 'int', value: 4n }) };
  expect(match(nonEmpty, { type: 'var', name: 'X' }, hide({ type: 'int', value: 9n }))).toBeNull();
  expect(match(nonEmpty, { type: 'var', name: 'X' }, hide({ type: 'int', value: 4n }))).toEqual(
    nonEmpty,
  );
  expect(
    match(nonEmpty, { type: 'var', name: 'Y' }, hide({ type: 'string', value: '??' })),
  ).toEqual({
    X: hide({ type: 'int', value: 4n }),
    Y: hide({ type: 'string', value: '??' }),
  });
});

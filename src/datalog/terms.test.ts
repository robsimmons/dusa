import { Substitution, match } from './terms';

test('Match patterns with data', () => {
  // Type mismatch
  expect(match({}, { type: 'string', value: 'hi ' }, { type: 'int', value: 2 })).toBeNull();
  expect(match({}, { type: 'int', value: 2 }, { type: 'string', value: 'there' })).toBeNull();
  expect(
    match({}, { type: 'string', value: 'hi ' }, { type: 'const', name: 'p', args: [] }),
  ).toBeNull();
  expect(
    match({}, { type: 'const', name: 'p', args: [] }, { type: 'string', value: 'hi ' }),
  ).toBeNull();

  // Value mismatch
  expect(match({}, { type: 'string', value: '1' }, { type: 'string', value: '2' })).toBeNull();
  expect(match({}, { type: 'int', value: 1 }, { type: 'int', value: 2 })).toBeNull();
  expect(
    match({}, { type: 'const', name: 'a', args: [] }, { type: 'const', name: 'b', args: [] }),
  ).toBeNull();

  // Arity mismatch
  expect(
    match(
      {},
      { type: 'const', name: 'a', args: [] },
      { type: 'const', name: 'a', args: [{ type: 'int', value: 2 }] },
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
      { type: 'const', name: 'a', args: [{ type: 'const', name: 'b', args: [] }] },
    ),
  ).toBeNull();

  // Successful matches
  expect(match({}, { type: 'string', value: 'HI' }, { type: 'string', value: 'HI' })).toEqual({});
  expect(match({}, { type: 'int', value: 9 }, { type: 'int', value: 9 })).toEqual({});
  expect(
    match({}, { type: 'const', name: 'a', args: [] }, { type: 'const', name: 'a', args: [] }),
  ).toEqual({});
  expect(
    match(
      {},
      { type: 'const', name: 'a', args: [{ type: 'const', name: 'b', args: [] }] },
      { type: 'const', name: 'a', args: [{ type: 'const', name: 'b', args: [] }] },
    ),
  ).toEqual({});

  // Matches with variables
  const empty: Substitution = {};
  expect(match(empty, { type: 'var', name: 'X' }, { type: 'string', value: 'HI' })).toEqual({
    X: { type: 'string', value: 'HI' },
  });
  expect(match(empty, { type: 'var', name: 'X' }, { type: 'int', value: 4 })).toEqual({
    X: { type: 'int', value: 4 },
  });
  expect(empty).toEqual({});

  const nonEmpty: Substitution = { X: { type: 'int', value: 4 } };
  expect(match(nonEmpty, { type: 'var', name: 'X' }, { type: 'int', value: 9 })).toBeNull();
  expect(match(nonEmpty, { type: 'var', name: 'X' }, { type: 'int', value: 4 })).toEqual(nonEmpty);
  expect(match(nonEmpty, { type: 'var', name: 'Y' }, { type: 'string', value: '??' })).toEqual({
    X: { type: 'int', value: 4 },
    Y: { type: 'string', value: '??' },
  });
});

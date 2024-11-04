import { Conclusion, Pattern } from '../bytecode.js';
import { AttributeMap } from '../datastructures/attributemap.js';
import { Data, DataSet, HashCons } from '../datastructures/data.js';
import { Database } from '../datastructures/database.js';
import { apply, match } from './dataterm.js';

type Intermediate = { type: 'intermediate'; name: string; args: Data[] };
type NewFact = { type: 'fact'; name: string; args: Data[] };
type AgendaMember = Intermediate | NewFact;

type Lst<T> = null | { data: T; next: Lst<T> };
function lstArr<T>(xs: Lst<T>): T[] {
  const result: T[] = [];
  for (let node = xs; node !== null; node = node.next) {
    result.push(node.data);
  }
  return result;
}

/**
 * The *database* D covers all stored state.
 * The least upper bound (in the lattice of choice sets) of the *chart* C and the database
 * *D* represents all immediate consequences of the facts in the database.
 *
 * Every premise in the chart corresponds to a fact in the agenda or an attribute in
 * the deferredAgenda.
 */
export interface SearchState {
  database: Database;
  chart: AttributeMap<{ values: DataSet; open: boolean }>;
  agenda: Lst<AgendaMember>;
  deferredAgenda: AttributeMap<true>;
  demands: DataSet;
}

export interface InternalProgram {
  predUnary: {
    [pred: string]: {
      args: Pattern[];
      conclusion: Conclusion;
    }[];
  };
  predBinary: {
    [pred: string]: {
      inName: string;
      inVars: { shared: number; passed: number };
      conclusion: Conclusion;
    }[];
  };
  forbids: { [inName: string]: true };
  intermediates: {
    [inName: string]: {
      premise: { name: string; shared: number; introduced: number };
      conclusion: Conclusion;
    }[];
  };
  data: HashCons;
}

/** Returns true if a constraint violation is discovered */
export function learnImmediateConsequences(
  prog: InternalProgram,
  state: SearchState,
  popped: AgendaMember,
): boolean {
  if (popped.type === 'fact') {
    for (const { args, conclusion } of prog.predUnary[popped.name] ?? []) {
      const subst: Data[] = [];
      if (popped.args.every((arg, i) => match(prog.data, subst, args[i], arg))) {
        if (assertConclusion(prog, state, subst, conclusion)) {
          return true;
        }
      }
    }
    for (const { inName, inVars, conclusion } of prog.predBinary[popped.name] ?? []) {
      const shared = popped.args.slice(0, inVars.shared);
      const introduced = popped.args.slice(inVars.shared);
      for (const passed of state.database.visit(inName, shared, inVars.passed)) {
        if (assertConclusion(prog, state, [...shared, ...passed, ...introduced], conclusion)) {
          return true;
        }
      }
    }
  } else {
    if (prog.forbids[popped.name]) return true;
    for (const { premise, conclusion } of prog.intermediates[popped.name] ?? []) {
      const shared = popped.args.slice(0, premise.shared);
      const passed = popped.args.slice(premise.shared);
      for (const introduced of state.database.visit(premise.name, shared, premise.introduced)) {
        if (assertConclusion(prog, state, [...shared, ...passed, ...introduced], conclusion)) {
          return true;
        }
      }
    }
  }
  return false;
}

const empty = DataSet.empty();
const noConstraint = { values: empty, open: true };
const datalogConstraint = { values: DataSet.singleton(HashCons.TRIVIAL), open: false };
/** Returns true if a constraint violation is discovered */
export function assertConclusion(
  prog: InternalProgram,
  state: SearchState,
  subst: Data[],
  conclusion: Conclusion,
): boolean {
  let args: Data[];
  if (conclusion.type === 'intermediate') {
    args = conclusion.vars.map((ref) => subst[ref]);
  } else {
    args = conclusion.args.map((arg) => apply(prog.data, subst, arg));
  }
  const committed = state.database.get(conclusion.name, args);

  switch (conclusion.type) {
    case 'open': {
      if (committed && committed.type === 'just') return false;
      const deferred = { ...(state.chart.get(conclusion.name, args) ?? noConstraint) };
      if (!deferred.open) return false;

      const committedNoneOf = committed?.value ?? empty;
      for (const value of conclusion.args.map((value) => apply(prog.data, subst, value))) {
        if (!committedNoneOf.has(value)) {
          deferred.values = deferred.values.add(value);
        }
      }

      const [chart, previousDeferred] = state.chart.set(conclusion.name, args, deferred);
      state.chart = chart;
      if (!previousDeferred) {
        state.deferredAgenda = state.deferredAgenda.set(conclusion.name, args, true)[0];
      }
      return false;
    }

    case 'closed': {
      let values = conclusion.args.map((value) => apply(prog.data, subst, value));
      if (committed && committed.type === 'just') {
        return !values.some((value) => value === committed.value);
      }
      if (committed) {
        const committedNoneOf = committed.value;
        values = values.filter((value) => !committedNoneOf.has(value));
      }

      const deferred = { ...(state.chart.get(conclusion.name, args) ?? noConstraint) };
      if (!deferred.open) {
        // This attribute is definitely on the deferred agenda
        let intersection = empty;
        let count = 0;
        let last: null | Data = null;
        for (const value of values) {
          if (deferred.values.has(value)) {
            intersection = intersection.add(value);
            count += 1;
            last = value;
          }
        }
        deferred.values = intersection;

        if (count === 0) {
          // No overlap between the previously derived constraints and these ones
          return true;
        }

        const [chart] = state.chart.set(conclusion.name, args, deferred);
        state.chart = chart;
        if (count === 1) {
          // We can remove this from the deferred agenda!
          state.deferredAgenda = state.deferredAgenda.remove(conclusion.name, args)![0];
          state.agenda = {
            data: { type: 'fact', name: conclusion.name, args: [...args, last!] },
            next: state.agenda,
          };
        }

        return false;
      } else {
        // This attribute may or may not be on the deferred agenda
        deferred.open = false;
        deferred.values = empty;
        for (const value of values) {
          deferred.values = deferred.values.add(value);
        }

        const [chart, previousDeferred] = state.chart.set(conclusion.name, args, deferred);
        state.chart = chart;
        if (!previousDeferred) {
          state.deferredAgenda = state.deferredAgenda.set(conclusion.name, args, true)[0];
        }
        return false;
      }
    }

    case 'datalog': {
      if (committed) return false;
      if (state.chart.get(conclusion.name, args)) return false;
      state.chart = state.chart.set(conclusion.name, args, datalogConstraint)[0];
      state.agenda = {
        data: { type: 'fact', name: conclusion.name, args },
        next: state.agenda,
      };
    }

    case 'intermediate': {
      if (committed) return false;
      if (state.chart.get(conclusion.name, args)) return false;
      state.chart = state.chart.set(conclusion.name, args, datalogConstraint)[0];
      state.agenda = {
        data: { type: 'fact', name: conclusion.name, args },
        next: state.agenda,
      };
    }
  }
}

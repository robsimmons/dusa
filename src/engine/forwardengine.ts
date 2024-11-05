import { Conclusion, Pattern } from '../bytecode.js';
import { AttributeMap } from '../datastructures/attributemap.js';
import { Data, DataSet, HashCons } from '../datastructures/data.js';
import { Constraint, Database } from '../datastructures/database.js';
import { apply, match } from './dataterm.js';

type Intermediate = { type: 'intermediate'; name: string; args: Data[] };
type NewFact = { type: 'fact'; name: string; args: Data[] };
type AgendaMember = Intermediate | NewFact;

type Lst<T> = null | { data: T; next: Lst<T> };

/**
 * The semi-naive, tuple-at-a-time forward-chaining algorithm for
 * finite-choice logic programming can be described in terms of a database D
 * (a map from attributes to constraints) and a chart C containing the
 * immediate consequences of D. The chart can be interpreted as a (non-empty)
 * choice set or as a map from attributes to (non-empty) sets of pairwise
 * incompatible constraints, and it is always the case that `{D[a]} <= C[a]`.
 *
 * The database D is represented by `state.explored`.
 * For all attributes `a`:
 *  - If `D[a] = noneOf {}`, then `!state.explored`.
 *  - Otherwise, `state.explored[a] = D[a]`.
 *
 * The chart C is represented by the combination of `state.explored` and `state.frontier`.
 * For all attributes `a`:
 *  - If `{D[a]} = C[a]`, then `!state.explored`.
 *  - Otherwise, `{D[a]} < C[a]` by invariant and `{D[a]} \/ state.frontier[a] = C[a]`.
 *
 * The agenda A contains exactly the attributes where `{D[a]} < C[a]`.
 * For all `a ∈ A`:
 *  - If `C[a] = { just v }`, then `a` is in `state.agenda`.
 *  - Otherwise, `a` is in `state.deferred`.
 */
export interface SearchState {
  explored: Database;
  frontier: AttributeMap<{ values: DataSet; open: boolean }>;
  agenda: Lst<AgendaMember>;
  deferred: AttributeMap<true>;
  demands: AttributeMap<true>;
}

export interface InternalProgram {
  seeds: string[];
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
  intermediates: {
    [inName: string]: {
      premise: { name: string; shared: number; introduced: number };
      conclusion: Conclusion;
    }[];
  };
  demands: string[];
  forbids: { [inName: string]: true };
  data: HashCons;
}

const empty = DataSet.empty();
const noConstraint: Constraint = { type: 'noneOf', noneOf: empty };
const noChoices = { values: empty, open: true };
const datalogChoice = { values: DataSet.singleton(HashCons.TRIVIAL), open: false };

export function createSearchState(prog: InternalProgram): SearchState {
  return {
    explored: Database.empty(),
    frontier: prog.seeds.reduce<AttributeMap<{ values: DataSet; open: boolean }>>(
      (frontier, seed) => frontier.set(seed, [], datalogChoice)[0],
      AttributeMap.empty(),
    ),
    agenda: prog.seeds.reduce<Lst<AgendaMember>>(
      (agenda, seed) => ({ data: { type: 'fact', name: seed, args: [] }, next: agenda }),
      null,
    ),
    deferred: AttributeMap.empty(),
    demands: prog.demands.reduce<AttributeMap<true>>(
      (demands, pred) => demands.set(pred, [], true)[0],
      AttributeMap.empty(),
    ),
  };
}

type Conflict =
  | {
      type: 'incompatible';
      name: string;
      args: Data[];
      old: Data;
      new: Data[];
    }
  | { type: 'forbid'; name: string };

/** Return Conflict or imperatively update `state` */
export function learnImmediateConsequences(
  prog: InternalProgram,
  state: SearchState,
  attribute: AgendaMember,
): null | Conflict {
  // The popped agenda member is an attribute `a` where `C[a] = { just value }`
  // In two steps, set `D[a] = { just value }`.

  // Step 1: remove `a` from `state.frontier`.
  const [frontier, leaf] = state.frontier.remove(attribute.name, attribute.args)!;
  state.frontier = frontier;
  if (!leaf || leaf.open) throw new Error('learnImmediateConsequences invariant');
  const value = leaf.values.getSingleton()!;
  const factArgs = [...attribute.args, value]; // The full fact is the args + the value

  // Step 2: add `a` to `state.explored`.
  const [explored] = state.explored.set(attribute.name, attribute.args, {
    type: 'just',
    just: value,
  });
  state.explored = explored;

  // Now we've (probably) broken our central invariant: the chart C might no longer
  // contain all the immediate consequences of the database D.
  //
  // The rest of the function restores this invariant by adding all immediate
  // consequences of the `D` combined with `p(a) is value` into the chart.
  if (attribute.type === 'fact') {
    for (const { args, conclusion } of prog.predUnary[attribute.name] ?? []) {
      const subst: Data[] = [];
      if (args.every((arg, i) => match(prog.data, subst, arg, factArgs[i]))) {
        const conflict = assertConclusion(prog, state, subst, conclusion);
        if (conflict) return conflict;
      }
    }
    for (const { inName, inVars, conclusion } of prog.predBinary[attribute.name] ?? []) {
      const shared = factArgs.slice(0, inVars.shared);
      const introduced = factArgs.slice(inVars.shared);
      for (const passed of state.explored.visit(inName, shared, inVars.passed)) {
        const conflict = assertConclusion(
          prog,
          state,
          [...shared, ...passed, ...introduced],
          conclusion,
        );
        if (conflict) return conflict;
      }
    }
  } else {
    if (prog.forbids[attribute.name]) return { type: 'forbid', name: attribute.name };
    state.demands = state.demands.remove(attribute.name, [])![0];
    for (const { premise, conclusion } of prog.intermediates[attribute.name] ?? []) {
      const shared = factArgs.slice(0, premise.shared);
      const passed = factArgs.slice(premise.shared);
      for (const introduced of state.explored.visit(premise.name, shared, premise.introduced)) {
        const conflict = assertConclusion(
          prog,
          state,
          [...shared, ...passed, ...introduced],
          conclusion,
        );
        if (conflict) return conflict;
      }
    }
  }

  return null;
}

/** Return Conflict or imperatively update `state` to assert the conclusion */
export function assertConclusion(
  prog: InternalProgram,
  state: SearchState,
  subst: Data[],
  conclusion: Conclusion,
): null | Conflict {
  let args: Data[];
  if (conclusion.type === 'intermediate') {
    args = conclusion.vars.map((ref) => subst[ref]);
  } else {
    args = conclusion.args.map((arg) => apply(prog.data, subst, arg));
  }
  const exploredValue = state.explored.get(conclusion.name, args) ?? noConstraint;

  switch (conclusion.type) {
    /**** ASSERT OPEN CONCLUSION: `a is? { t1, ..., tn }` ****/
    case 'open': {
      // An open rule has no effect if `D[a] = just v`
      if (exploredValue.type === 'just') return null;

      // An open rule also has no effect if `D[a] = noneOf X` but `C[a]` is closed
      // (that is, if `C[a] = { just v1, just v2, ..., just vn }`)
      const frontierChoices = state.frontier.get(conclusion.name, args) ?? noChoices;
      if (!frontierChoices.open) return null;

      // We now know:
      //  - `D[a] = noneOf X`
      //  - `C[a] = { just v1, just v2, ..., just vn, noneOf Y }`
      //  - `Y = { v1, v2, ..., vn } ∪ X`
      //  - `state.frontier[a] = { open: true, values: { v1, v2, ... vn } }`
      //
      // We need to update `state.frontier[a].values` with all the open rule's conclusions.
      const choices = conclusion.choices.map((choice) => apply(prog.data, subst, choice));
      let newFrontierChoices = frontierChoices.values;
      for (const choice of choices) {
        if (!exploredValue.noneOf.has(choice)) {
          newFrontierChoices = newFrontierChoices.add(choice);
        }
      }
      const [frontier, isAlreadyInFrontier] = state.frontier.set(conclusion.name, args, {
        open: true,
        values: newFrontierChoices,
      });
      state.frontier = frontier;

      // Finally, add a to the agenda if it wasn't there already.
      if (!isAlreadyInFrontier) {
        state.deferred = state.deferred.set(conclusion.name, args, true)[0];
      }
      return null;
    }

    /**** ASSERT CLOSED CONCLUSION: `a is { t1, ..., tn }` ****/
    case 'closed': {
      let choices = conclusion.choices.map((choice) => apply(prog.data, subst, choice));

      // If `D[a] = just v`, signal failure if `v` is not among the choices in the conclusion
      if (exploredValue.type === 'just') {
        if (choices.some((choice) => choice === exploredValue.just)) return null;
        return {
          type: 'incompatible',
          name: conclusion.name,
          args,
          old: exploredValue.just,
          new: choices,
        };
      }

      // Filter choices that are inconsistent with D[a].
      choices = choices.filter((choice) => !exploredValue.noneOf.has(choice));
      if (choices.length === 0)
        return {
          type: 'incompatible',
          name: conclusion.name,
          args,
          old: exploredValue.noneOf.example()!,
          new: choices,
        };

      const frontierChoices = state.frontier.get(conclusion.name, args) ?? noChoices;
      if (frontierChoices.open) {
        // `C[a] = { just v1, just v2, ..., just vn, noneOf X }`
        // We will completely ignore the existing value of `C[a]`
        const [frontier, isAlreadyInFrontier] = state.frontier.set(conclusion.name, args, {
          open: false,
          values: choices.reduce((set, choice) => set.add(choice), empty),
        });
        state.frontier = frontier;

        // Unless `a` was, and remains, on the deferred agenda, we have to fix the agenda
        if (!isAlreadyInFrontier) {
          if (choices.length === 1) {
            state.agenda = {
              data: { type: 'fact', name: conclusion.name, args },
              next: state.agenda,
            };
          } else {
            state.deferred = state.deferred.set(conclusion.name, args, true)[0];
          }
        } else if (choices.length === 1) {
          state.deferred = state.deferred.remove(conclusion.name, args)![0];
          state.agenda = {
            data: { type: 'fact', name: conclusion.name, args },
            next: state.agenda,
          };
        }
        return null;
      } else {
        // C[a] = { just v1, just v2, ..., just vn }
        // We will intersect these options with choices
        let uniqueFrontierChoice = frontierChoices.values.getSingleton();

        // If `C[a] = { just v }`, signal failure if `v` is not among the choices in the conclusion
        if (uniqueFrontierChoice) {
          if (choices.some((choice) => choice === uniqueFrontierChoice)) return null;
          return {
            type: 'incompatible',
            name: conclusion.name,
            args,
            old: uniqueFrontierChoice,
            new: choices,
          };
        }

        // At this point, we know that `a` is on the deferred agenda
        let intersection = choices.reduce<DataSet>(
          (intersection, choice) =>
            frontierChoices.values.has(choice) ? intersection.add(choice) : intersection,
          empty,
        );

        // If C[a] = {}, signal failure
        if (intersection.isEmpty()) {
          return {
            type: 'incompatible',
            name: conclusion.name,
            args,
            old: frontierChoices.values.example()!,
            new: choices,
          };
        }

        // Update the frontier
        state.frontier = state.frontier.set(conclusion.name, args, {
          open: false,
          values: intersection,
        })[0];

        // If `a` can be moved from the deferred agenda to the active agenda, do so!
        uniqueFrontierChoice = intersection.getSingleton();
        if (uniqueFrontierChoice) {
          // We can remove this from the deferred agenda!
          state.deferred = state.deferred.remove(conclusion.name, args)![0];
          state.agenda = {
            data: { type: 'fact', name: conclusion.name, args },
            next: state.agenda,
          };
        }

        return null;
      }
    }

    /**** ASSERT DATALOG CONCLUSION ****/
    case 'datalog': {
      if (exploredValue.type === 'just') return null;
      if (state.frontier.get(conclusion.name, args)) return null;
      state.frontier = state.frontier.set(conclusion.name, args, datalogChoice)[0];
      state.agenda = {
        data: { type: 'fact', name: conclusion.name, args },
        next: state.agenda,
      };
      return null;
    }

    /**** ASSERT INTERMEDIATE CONCLUSION ****/
    case 'intermediate': {
      if (exploredValue.type === 'just') return null;
      if (state.frontier.get(conclusion.name, args)) return null;
      state.frontier = state.frontier.set(conclusion.name, args, datalogChoice)[0];
      state.agenda = {
        data: { type: 'intermediate', name: conclusion.name, args },
        next: state.agenda,
      };
      return null;
    }
  }
}

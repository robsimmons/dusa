import {
  compareTerm,
  compareTerms,
  Dusa as DusaClient,
  DusaRuntimeError,
  termToString,
  compile,
  compileBig,
  DusaCompileError,
} from './client.js';

export default class Dusa extends DusaClient {
  static termToString = termToString;
  static compareTerm = compareTerm;
  static compareTerms = compareTerms;
  static compile = compile;
  static compileBig = compileBig;
  static DusaCompileError = DusaCompileError;
  static DusaRuntimeError = DusaRuntimeError;
}

import {
  compareTerm,
  compareTerms,
  Dusa as DusaClient,
  DusaError,
  DusaRuntimeError,
  termToString,
} from './client.js';

export default class Dusa extends DusaClient {
  static termToString = termToString;
  static compareTerm = compareTerm;
  static compareTerms = compareTerms;
  static DusaError = DusaError;
  static DusaRuntimeError = DusaRuntimeError;
}

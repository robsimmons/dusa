// package:
// file: busa.proto

import * as jspb from 'google-protobuf';

export class Pattern extends jspb.Message {
  hasEnum(): boolean;
  clearEnum(): void;
  getEnum(): Pattern.PatternEnumMap[keyof Pattern.PatternEnumMap];
  setEnum(value: Pattern.PatternEnumMap[keyof Pattern.PatternEnumMap]): void;

  hasBool(): boolean;
  clearBool(): void;
  getBool(): boolean;
  setBool(value: boolean): void;

  hasVar(): boolean;
  clearVar(): void;
  getVar(): number;
  setVar(value: number): void;

  hasInt(): boolean;
  clearInt(): void;
  getInt(): number;
  setInt(value: number): void;

  hasString(): boolean;
  clearString(): void;
  getString(): string;
  setString(value: string): void;

  hasStructure(): boolean;
  clearStructure(): void;
  getStructure(): Pattern.Structure | undefined;
  setStructure(value?: Pattern.Structure): void;

  getIsCase(): Pattern.IsCase;
  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): Pattern.AsObject;
  static toObject(includeInstance: boolean, msg: Pattern): Pattern.AsObject;
  static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
  static extensionsBinary: { [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message> };
  static serializeBinaryToWriter(message: Pattern, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): Pattern;
  static deserializeBinaryFromReader(message: Pattern, reader: jspb.BinaryReader): Pattern;
}

export namespace Pattern {
  export type AsObject = {
    pb_enum: Pattern.PatternEnumMap[keyof Pattern.PatternEnumMap];
    bool: boolean;
    pb_var: number;
    pb_int: number;
    string: string;
    structure?: Pattern.Structure.AsObject;
  };

  export class Structure extends jspb.Message {
    getName(): string;
    setName(value: string): void;

    clearArgsList(): void;
    getArgsList(): Array<Pattern>;
    setArgsList(value: Array<Pattern>): void;
    addArgs(value?: Pattern, index?: number): Pattern;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): Structure.AsObject;
    static toObject(includeInstance: boolean, msg: Structure): Structure.AsObject;
    static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
    static extensionsBinary: { [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message> };
    static serializeBinaryToWriter(message: Structure, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): Structure;
    static deserializeBinaryFromReader(message: Structure, reader: jspb.BinaryReader): Structure;
  }

  export namespace Structure {
    export type AsObject = {
      name: string;
      argsList: Array<Pattern.AsObject>;
    };
  }

  export interface PatternEnumMap {
    UNIT: 0;
    WILDCARD: 1;
  }

  export const PatternEnum: PatternEnumMap;

  export enum IsCase {
    IS_NOT_SET = 0,
    ENUM = 1,
    BOOL = 2,
    VAR = 3,
    INT = 4,
    STRING = 5,
    STRUCTURE = 6,
  }
}

export class Conclusion extends jspb.Message {
  hasIntermediate(): boolean;
  clearIntermediate(): void;
  getIntermediate(): Conclusion.IntermediateConclusion | undefined;
  setIntermediate(value?: Conclusion.IntermediateConclusion): void;

  hasDatalog(): boolean;
  clearDatalog(): void;
  getDatalog(): Conclusion.DatalogConclusion | undefined;
  setDatalog(value?: Conclusion.DatalogConclusion): void;

  hasOpen(): boolean;
  clearOpen(): void;
  getOpen(): Conclusion.OpenConclusion | undefined;
  setOpen(value?: Conclusion.OpenConclusion): void;

  hasClosed(): boolean;
  clearClosed(): void;
  getClosed(): Conclusion.ClosedConclusion | undefined;
  setClosed(value?: Conclusion.ClosedConclusion): void;

  getIsCase(): Conclusion.IsCase;
  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): Conclusion.AsObject;
  static toObject(includeInstance: boolean, msg: Conclusion): Conclusion.AsObject;
  static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
  static extensionsBinary: { [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message> };
  static serializeBinaryToWriter(message: Conclusion, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): Conclusion;
  static deserializeBinaryFromReader(message: Conclusion, reader: jspb.BinaryReader): Conclusion;
}

export namespace Conclusion {
  export type AsObject = {
    intermediate?: Conclusion.IntermediateConclusion.AsObject;
    datalog?: Conclusion.DatalogConclusion.AsObject;
    open?: Conclusion.OpenConclusion.AsObject;
    closed?: Conclusion.ClosedConclusion.AsObject;
  };

  export class IntermediateConclusion extends jspb.Message {
    getName(): string;
    setName(value: string): void;

    clearVarsList(): void;
    getVarsList(): Array<number>;
    setVarsList(value: Array<number>): void;
    addVars(value: number, index?: number): number;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): IntermediateConclusion.AsObject;
    static toObject(
      includeInstance: boolean,
      msg: IntermediateConclusion,
    ): IntermediateConclusion.AsObject;
    static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
    static extensionsBinary: { [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message> };
    static serializeBinaryToWriter(
      message: IntermediateConclusion,
      writer: jspb.BinaryWriter,
    ): void;
    static deserializeBinary(bytes: Uint8Array): IntermediateConclusion;
    static deserializeBinaryFromReader(
      message: IntermediateConclusion,
      reader: jspb.BinaryReader,
    ): IntermediateConclusion;
  }

  export namespace IntermediateConclusion {
    export type AsObject = {
      name: string;
      varsList: Array<number>;
    };
  }

  export class DatalogConclusion extends jspb.Message {
    getName(): string;
    setName(value: string): void;

    clearVarsList(): void;
    getVarsList(): Array<Pattern>;
    setVarsList(value: Array<Pattern>): void;
    addVars(value?: Pattern, index?: number): Pattern;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): DatalogConclusion.AsObject;
    static toObject(includeInstance: boolean, msg: DatalogConclusion): DatalogConclusion.AsObject;
    static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
    static extensionsBinary: { [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message> };
    static serializeBinaryToWriter(message: DatalogConclusion, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): DatalogConclusion;
    static deserializeBinaryFromReader(
      message: DatalogConclusion,
      reader: jspb.BinaryReader,
    ): DatalogConclusion;
  }

  export namespace DatalogConclusion {
    export type AsObject = {
      name: string;
      varsList: Array<Pattern.AsObject>;
    };
  }

  export class OpenConclusion extends jspb.Message {
    getName(): string;
    setName(value: string): void;

    clearArgsList(): void;
    getArgsList(): Array<Pattern>;
    setArgsList(value: Array<Pattern>): void;
    addArgs(value?: Pattern, index?: number): Pattern;

    clearValuesList(): void;
    getValuesList(): Array<Pattern>;
    setValuesList(value: Array<Pattern>): void;
    addValues(value?: Pattern, index?: number): Pattern;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): OpenConclusion.AsObject;
    static toObject(includeInstance: boolean, msg: OpenConclusion): OpenConclusion.AsObject;
    static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
    static extensionsBinary: { [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message> };
    static serializeBinaryToWriter(message: OpenConclusion, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): OpenConclusion;
    static deserializeBinaryFromReader(
      message: OpenConclusion,
      reader: jspb.BinaryReader,
    ): OpenConclusion;
  }

  export namespace OpenConclusion {
    export type AsObject = {
      name: string;
      argsList: Array<Pattern.AsObject>;
      valuesList: Array<Pattern.AsObject>;
    };
  }

  export class ClosedConclusion extends jspb.Message {
    getName(): string;
    setName(value: string): void;

    clearArgsList(): void;
    getArgsList(): Array<Pattern>;
    setArgsList(value: Array<Pattern>): void;
    addArgs(value?: Pattern, index?: number): Pattern;

    clearValuesList(): void;
    getValuesList(): Array<Pattern>;
    setValuesList(value: Array<Pattern>): void;
    addValues(value?: Pattern, index?: number): Pattern;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ClosedConclusion.AsObject;
    static toObject(includeInstance: boolean, msg: ClosedConclusion): ClosedConclusion.AsObject;
    static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
    static extensionsBinary: { [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message> };
    static serializeBinaryToWriter(message: ClosedConclusion, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ClosedConclusion;
    static deserializeBinaryFromReader(
      message: ClosedConclusion,
      reader: jspb.BinaryReader,
    ): ClosedConclusion;
  }

  export namespace ClosedConclusion {
    export type AsObject = {
      name: string;
      argsList: Array<Pattern.AsObject>;
      valuesList: Array<Pattern.AsObject>;
    };
  }

  export enum IsCase {
    IS_NOT_SET = 0,
    INTERMEDIATE = 1,
    DATALOG = 2,
    OPEN = 3,
    CLOSED = 4,
  }
}

export class Rule extends jspb.Message {
  hasUnary(): boolean;
  clearUnary(): void;
  getUnary(): Rule.UnaryRule | undefined;
  setUnary(value?: Rule.UnaryRule): void;

  hasJoin(): boolean;
  clearJoin(): void;
  getJoin(): Rule.JoinRule | undefined;
  setJoin(value?: Rule.JoinRule): void;

  hasBuiltin(): boolean;
  clearBuiltin(): void;
  getBuiltin(): Rule.BuiltInRule | undefined;
  setBuiltin(value?: Rule.BuiltInRule): void;

  getIsCase(): Rule.IsCase;
  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): Rule.AsObject;
  static toObject(includeInstance: boolean, msg: Rule): Rule.AsObject;
  static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
  static extensionsBinary: { [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message> };
  static serializeBinaryToWriter(message: Rule, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): Rule;
  static deserializeBinaryFromReader(message: Rule, reader: jspb.BinaryReader): Rule;
}

export namespace Rule {
  export type AsObject = {
    unary?: Rule.UnaryRule.AsObject;
    join?: Rule.JoinRule.AsObject;
    builtin?: Rule.BuiltInRule.AsObject;
  };

  export class UnaryRule extends jspb.Message {
    getPremise(): string;
    setPremise(value: string): void;

    clearArgsList(): void;
    getArgsList(): Array<Pattern>;
    setArgsList(value: Array<Pattern>): void;
    addArgs(value?: Pattern, index?: number): Pattern;

    hasConclusion(): boolean;
    clearConclusion(): void;
    getConclusion(): Conclusion | undefined;
    setConclusion(value?: Conclusion): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): UnaryRule.AsObject;
    static toObject(includeInstance: boolean, msg: UnaryRule): UnaryRule.AsObject;
    static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
    static extensionsBinary: { [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message> };
    static serializeBinaryToWriter(message: UnaryRule, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): UnaryRule;
    static deserializeBinaryFromReader(message: UnaryRule, reader: jspb.BinaryReader): UnaryRule;
  }

  export namespace UnaryRule {
    export type AsObject = {
      premise: string;
      argsList: Array<Pattern.AsObject>;
      conclusion?: Conclusion.AsObject;
    };
  }

  export class JoinRule extends jspb.Message {
    getInname(): string;
    setInname(value: string): void;

    getNumshared(): number;
    setNumshared(value: number): void;

    getNumin(): number;
    setNumin(value: number): void;

    getPremise(): string;
    setPremise(value: string): void;

    clearArgsList(): void;
    getArgsList(): Array<number>;
    setArgsList(value: Array<number>): void;
    addArgs(value: number, index?: number): number;

    hasConclusion(): boolean;
    clearConclusion(): void;
    getConclusion(): Conclusion | undefined;
    setConclusion(value?: Conclusion): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): JoinRule.AsObject;
    static toObject(includeInstance: boolean, msg: JoinRule): JoinRule.AsObject;
    static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
    static extensionsBinary: { [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message> };
    static serializeBinaryToWriter(message: JoinRule, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): JoinRule;
    static deserializeBinaryFromReader(message: JoinRule, reader: jspb.BinaryReader): JoinRule;
  }

  export namespace JoinRule {
    export type AsObject = {
      inname: string;
      numshared: number;
      numin: number;
      premise: string;
      argsList: Array<number>;
      conclusion?: Conclusion.AsObject;
    };
  }

  export class BuiltInRule extends jspb.Message {
    getInname(): string;
    setInname(value: string): void;

    getNumin(): number;
    setNumin(value: number): void;

    getBuiltin(): BuiltinMap[keyof BuiltinMap];
    setBuiltin(value: BuiltinMap[keyof BuiltinMap]): void;

    clearArgsList(): void;
    getArgsList(): Array<Pattern>;
    setArgsList(value: Array<Pattern>): void;
    addArgs(value?: Pattern, index?: number): Pattern;

    hasConclusion(): boolean;
    clearConclusion(): void;
    getConclusion(): Conclusion | undefined;
    setConclusion(value?: Conclusion): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): BuiltInRule.AsObject;
    static toObject(includeInstance: boolean, msg: BuiltInRule): BuiltInRule.AsObject;
    static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
    static extensionsBinary: { [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message> };
    static serializeBinaryToWriter(message: BuiltInRule, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): BuiltInRule;
    static deserializeBinaryFromReader(
      message: BuiltInRule,
      reader: jspb.BinaryReader,
    ): BuiltInRule;
  }

  export namespace BuiltInRule {
    export type AsObject = {
      inname: string;
      numin: number;
      builtin: BuiltinMap[keyof BuiltinMap];
      argsList: Array<Pattern.AsObject>;
      conclusion?: Conclusion.AsObject;
    };
  }

  export enum IsCase {
    IS_NOT_SET = 0,
    UNARY = 1,
    JOIN = 2,
    BUILTIN = 3,
  }
}

export class Program extends jspb.Message {
  clearRulesList(): void;
  getRulesList(): Array<Rule>;
  setRulesList(value: Array<Rule>): void;
  addRules(value?: Rule, index?: number): Rule;

  clearSeedsList(): void;
  getSeedsList(): Array<string>;
  setSeedsList(value: Array<string>): void;
  addSeeds(value: string, index?: number): string;

  clearForbidsList(): void;
  getForbidsList(): Array<string>;
  setForbidsList(value: Array<string>): void;
  addForbids(value: string, index?: number): string;

  clearDemandsList(): void;
  getDemandsList(): Array<string>;
  setDemandsList(value: Array<string>): void;
  addDemands(value: string, index?: number): string;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): Program.AsObject;
  static toObject(includeInstance: boolean, msg: Program): Program.AsObject;
  static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
  static extensionsBinary: { [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message> };
  static serializeBinaryToWriter(message: Program, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): Program;
  static deserializeBinaryFromReader(message: Program, reader: jspb.BinaryReader): Program;
}

export namespace Program {
  export type AsObject = {
    rulesList: Array<Rule.AsObject>;
    seedsList: Array<string>;
    forbidsList: Array<string>;
    demandsList: Array<string>;
  };
}

export interface BuiltinMap {
  BOOLEAN_FALSE: 0;
  BOOLEAN_TRUE: 1;
  NAT_ZERO: 2;
  NAT_SUCC: 3;
  INT_PLUS: 4;
  INT_MINUS: 5;
  INT_TIMES: 6;
  STRING_CONCAT: 7;
  CHECK_GT: 8;
  CHECK_GEQ: 9;
  CHECK_LT: 10;
  CHECK_LEQ: 11;
  EQUAL: 12;
  NOT_EQUAL: 13;
}

export const Builtin: BuiltinMap;

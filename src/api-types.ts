// Peripheral Inspector API
export interface IPeripheralInspectorAPI {
    registerSVDFile: (expression: RegExp | string, path: string) => void;
    getSVDFile: (device: string) => string | undefined;
    getSVDFileFromCortexDebug: (device: string) => Promise<string | undefined>;
    registerPeripheralsProvider: (fileExtension: string, provider: IPeripheralsProvider) => void;
}

export interface IPeripheralsProvider {
    getPeripherals: (data: string, options: IGetPeripheralsArguments) => Promise<PeripheralOptions[]>;
}

export interface IGetPeripheralsArguments {
    gapThreshold: number;
}

export interface PeripheralOptions {
    name: string;
    baseAddress: number;
    totalLength: number;
    description: string;
    groupName?: string;
    accessType?: AccessType;
    size?: number;
    resetValue?: number;
    registers?: PeripheralRegisterOptions[];
    clusters?: ClusterOptions[];
}

export interface PeripheralRegisterOptions {
    name: string;
    description?: string;
    addressOffset: number;
    accessType?: AccessType;
    size?: number;
    resetValue?: number;
    readAction?: ReadActionType;
    fields?: FieldOptions[];
}

export interface ClusterOptions {
    name: string;
    description?: string;
    addressOffset: number;
    accessType?: AccessType;
    size?: number;
    resetValue?: number;
    registers?: PeripheralRegisterOptions[];
    clusters?: ClusterOptions[];
}

export interface FieldOptions {
    name: string;
    description: string;
    offset: number;
    width: number;
    enumeration?: EnumerationMap;
    derivedFrom?: string;           // Set this if unresolved
    accessType?: AccessType;
    readAction?: ReadActionType;
}

export interface IGetPeripheralsArguments {
    gapThreshold: number;
}

export interface IPeripheralsProvider {
    getPeripherals: (data: string, options: IGetPeripheralsArguments) => Promise<PeripheralOptions[]>;
}

export interface PeripheralsConfiguration {
    gapThreshold: number;
    peripheralOptions: Record<string, PeripheralOptions>;
    enumTypeValues: Record<string, EnumerationMap>;
    ignoredPeripherals: string[];
}

export enum AccessType {
    ReadOnly = 1,
    ReadWrite = 2,
    WriteOnly = 3
}

export enum ReadActionType {
    Clear = 1,
    Set = 2,
    Modify = 3,
    ModifyExternal = 4
}
export interface EnumerationMap {
    [value: number]: IEnumeratedValue;
}

export interface IEnumeratedValue {
    name: string;
    description: string;
    value: number;
}

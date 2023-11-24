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
}

export interface IGetPeripheralsArguments {
	gapThreshold: number;
}

export interface IPeripheralsProvider {
	getPeripherals: (data: string, options: IGetPeripheralsArguments) => Promise<PeripheralOptions[]>;
}

export declare enum AccessType {
    ReadOnly = 1,
    ReadWrite = 2,
    WriteOnly = 3
}

export interface EnumerationMap {
	[value: number]: IEnumeratedValue;
}

export interface IEnumeratedValue {
	name: string;
	description: string;
	value: number;
}

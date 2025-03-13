/********************************************************************************
 * Copyright (C) 2023 Marcel Ball, Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

export function hexFormat(value: number, padding = 8, includePrefix = true): string {
    let base = (value >>> 0).toString(16);
    base = base.padStart(padding, '0');
    return includePrefix ? '0x' + base : base;
}

export function binaryFormat(value: number, padding = 0, includePrefix = true, group = false): string {
    let base = (value >>> 0).toString(2);
    while (base.length < padding) { base = '0' + base; }

    if (group) {
        const nibRem = 4 - (base.length % 4);
        for (let i = 0; i < nibRem; i++) { base = '0' + base; }
        const groups = base.match(/[01]{4}/g);
        if (groups) {
            base = groups.join(' ');
        }

        base = base.substring(nibRem);
    }

    return includePrefix ? '0b' + base : base;
}

export function createMask(offset: number, width: number): number {
    let r = 0;
    const a = offset;
    const b = offset + width - 1;
    for (let i = a; i <= b; i++) { r = (r | (1 << i)) >>> 0; }
    return r;
}

export function extractBits(value: number, offset: number, width: number): number {
    const mask = createMask(offset, width);
    const bvalue = ((value & mask) >>> offset) >>> 0;
    return bvalue;
}

export function parseInteger(value: string, { binaryLimit = Infinity, hexLimit = Infinity, decimalLimit = Infinity } = {}): number | undefined {
    if (!value) {
        return undefined;
    }
    const text = value.toLowerCase();
    const quantifier = (limit: number) => limit === Infinity ? '+' : `{1,${limit}}`;

    const binRegex = new RegExp(`^0b[01]${quantifier(binaryLimit)}$`, 'i');
    if (binRegex.test(text)) {
        return parseInt(text.substring(2), 2);
    }
    const hexRegex = new RegExp(`^0x[0-9a-f]${quantifier(hexLimit)}$`, 'i');
    if (hexRegex.test(text)) {
        return parseInt(text.substring(2), 16);
    }
    const decRegex = new RegExp(`^[0-9]${quantifier(decimalLimit)}$`, 'i');
    if (decRegex.test(text)) {
        return parseInt(text, 10);
    }
    const binHashRegex = new RegExp(`^#[01]${quantifier(binaryLimit)}$`, 'i');
    if (binHashRegex.test(text)) {
        return parseInt(text.substring(1), 2);
    }
    return undefined;
}

export function parseDimIndex(spec: string, count: number): string[] {
    if (spec.indexOf(',') !== -1) {
        const components = spec.split(',').map((c) => c.trim());
        if (components.length !== count) {
            throw new Error('dimIndex Element has invalid specification.');
        }
        return components;
    }

    if (/^([0-9]+)-([0-9]+)$/i.test(spec)) {
        const parts = spec.split('-').map((p) => parseInteger(p));
        const start = parts[0];
        const end = parts[1];

        if (!start || !end) {
            return [];
        }

        const numElements = end - start + 1;
        if (numElements < count) {
            throw new Error('dimIndex Element has invalid specification.');
        }

        const components: string[] = [];
        for (let i = 0; i < count; i++) {
            components.push(`${start + i}`);
        }

        return components;
    }

    if (/^[a-zA-Z]-[a-zA-Z]$/.test(spec)) {
        const start = spec.charCodeAt(0);
        const end = spec.charCodeAt(2);

        const numElements = end - start + 1;
        if (numElements < count) {
            throw new Error('dimIndex Element has invalid specification.');
        }

        const components: string[] = [];
        for (let i = 0; i < count; i++) {
            components.push(String.fromCharCode(start + i));
        }

        return components;
    }

    return [];
}

export const readFromUrl = async (url: string): Promise<ArrayBuffer | undefined> => {
    // Download using fetch
    const response = await fetch(url);
    if (!response.ok) {
        const body = await response.text();
        const msg = `Request to ${url} failed. Status="${response.status}". Body="${body}".`;
        throw new Error(msg);
    }

    const buffer = await response.arrayBuffer();
    return buffer;
};

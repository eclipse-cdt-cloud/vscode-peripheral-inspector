/********************************************************************************
 * Copyright (C) 2024 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import { binaryFormat, hexFormat } from '../utils';

export enum NumberFormat {
    Auto = 0,
    Hexadecimal,
    Decimal,
    Binary
}

export function formatValue(value: number, hexLength: number, format: NumberFormat): string {
    switch (format) {
        case NumberFormat.Decimal:
            return value.toString();
        case NumberFormat.Binary:
            return binaryFormat(value, hexLength * 4);
        default:
            return hexFormat(value, hexLength, true);
    }
}

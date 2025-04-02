/********************************************************************************
 * Copyright (C) 2023 Marcel Ball, Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

export class AddrRange {
    constructor(public base: number, public length: number) {
    }

    /** return next address after this addr. range */
    public nxtAddr(): number {
        return this.base + this.length;
    }

    /** return last address in this range */
    public endAddr(): number {
        return this.nxtAddr() - 1;
    }
}

export class BitRange {
    constructor(public offs: number, public width: number) {
    }

    /** return next address after this addr. range */
    public mask(): number {
        if (this.offs + this.width >= 32) { // handle uint32, could be error is > 32
            return 0xffffffff;
        } else {
            return ((1 << this.width) - 1) << this.offs;
        }
    }
}

export class AddressRangesUtils {
    /**
     * Returns a set of address ranges that have 0 < length <= maxBytes
     *
     * @param ranges array of ranges to check an split
     * @param maxBytes limit of each range
     * @param dbgMsg To output debug messages -- name of address space
     * @param dbgLen To output debug messages -- total length of addr space
     */
    public static splitIntoChunks(ranges: AddrRange[], maxBytes: number, _dbgMsg = '', _dbgLen = 0): AddrRange[] {
        const newRanges = new Array<AddrRange>();
        for (const r of ranges) {
            while (r.length > maxBytes) {
                newRanges.push(new AddrRange(r.base, maxBytes));
                r.base += maxBytes;
                r.length -= maxBytes;
            }
            if (r.length > 0) {     // Watch out, can be negative
                newRanges.push(r);
            }
        }
        return newRanges;
    }
}

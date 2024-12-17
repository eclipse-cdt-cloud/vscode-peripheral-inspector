/********************************************************************************
 * Copyright (C) 2023 Marcel Ball, Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import * as vscode from 'vscode';
import { AddrRange, AddressRangesUtils } from '../../../addrranges';
import { AccessType, EnumerationMap, PeripheralOptions } from '../../../api-types';
import { NodeSetting } from '../../../common';
import { NumberFormat } from '../../../common/format';
import { PeripheralNodeDTO } from '../../../common/peripheral-dto';
import { MemUtils } from '../../../memreadutils';
import { PeripheralBaseNode } from './base-node';
import { PeripheralClusterNode, PeripheralRegisterOrClusterNode } from './peripheral-cluster-node';
import { PeripheralRegisterNode } from './peripheral-register-node';
import type { PeripheralTreeForSession } from '../tree/peripheral-session-tree';


export class PeripheralNode extends PeripheralBaseNode {
    public children: Array<PeripheralRegisterNode | PeripheralClusterNode>;
    public readonly name: string;
    public readonly baseAddress: number;
    public readonly description: string;
    public readonly groupName: string;
    public readonly totalLength: number;
    public readonly accessType = AccessType.ReadOnly;
    public readonly size: number;
    public readonly resetValue: number;
    protected addrRanges: AddrRange[];

    private currentValue: number[] = [];

    constructor(public gapThreshold: number, protected options: PeripheralOptions, parent: PeripheralTreeForSession) {
        super(parent);

        this.name = options.name;
        this.baseAddress = options.baseAddress;
        this.totalLength = options.totalLength;
        this.description = options.description;
        this.groupName = options.groupName || '';
        this.resetValue = options.resetValue || 0;
        this.size = options.size || 32;
        this.children = [];
        this.addrRanges = [];

        options.clusters?.forEach((clusterOptions) => {
            // PeripheralClusterNode constructor already adding the reference as child to parent object (PeripheralNode object)
            new PeripheralClusterNode(this, clusterOptions);
        });

        options.registers?.forEach((registerOptions) => {
            // PeripheralRegisterNode constructor already adding the reference as child to parent object (PeripheralNode object)
            new PeripheralRegisterNode(this, registerOptions);
        });
    }

    public getPeripheral(): PeripheralBaseNode {
        return this;
    }

    public getChildren(): PeripheralBaseNode[] | Promise<PeripheralBaseNode[]> {
        return this.children;
    }

    public setChildren(children: Array<PeripheralRegisterNode | PeripheralClusterNode>): void {
        this.children = children;
        this.children.sort((c1, c2) => c1.offset > c2.offset ? 1 : -1);
    }

    public addChild(child: PeripheralRegisterOrClusterNode): void {
        this.children.push(child);
        this.children.sort((c1, c2) => c1.offset > c2.offset ? 1 : -1);
    }

    public getBytes(offset: number, size: number): Uint8Array {
        try {
            return new Uint8Array(this.currentValue.slice(offset, offset + size));
        } catch (e) {
            return new Uint8Array(0);
        }
    }

    public getAddress(offset: number): number {
        return this.baseAddress + offset;
    }

    public getOffset(offset: number): number {
        return offset;
    }

    public getFormat(): NumberFormat {
        return this.format;
    }

    public async updateData(): Promise<boolean> {
        if (!this.expanded) {
            return false;
        }

        try {
            const errors = await this.readMemory();
            for (const error of errors) {
                const str = `Failed to read peripheral ${this.name}: ${error}`;
                if (vscode.debug.activeDebugConsole) {
                    vscode.debug.activeDebugConsole.appendLine(str);
                }
            }
        } catch (e) {
            /* This should never happen */
            const msg = (e as Error).message || 'unknown error';
            const str = `Failed to read peripheral ${this.name}: ${msg}`;
            if (vscode.debug.activeDebugConsole) {
                vscode.debug.activeDebugConsole.appendLine(str);
            }
        }

        try {
            const promises = this.children.map((r) => r.updateData());
            await Promise.all(promises);
            return true;
        } catch (e) {
            /* This should never happen */
            const msg = (e as Error).message || 'unknown error';
            const str = `Internal error: Failed to update peripheral ${this.name} after memory reads: ${msg}`;
            if (vscode.debug.activeDebugConsole) {
                vscode.debug.activeDebugConsole.appendLine(str);
            }
            // Could return false, but some things could have been updated. Returning true triggers a GUI refresh
            return true;
        }
    }

    protected readMemory(): Promise<Error[]> | [] {
        if (!this.currentValue) {
            this.currentValue = new Array<number>(this.totalLength);
        }

        if (this.session) {
            return MemUtils.readMemoryChunks(this.session, this.baseAddress, this.addrRanges, this.currentValue);
        } else {
            return [];
        }
    }

    public collectRanges(): void {
        const addresses: AddrRange[] = [];
        this.children.map((child) => child.collectRanges(addresses));
        addresses.sort((a, b) => (a.base < b.base) ? -1 : ((a.base > b.base) ? 1 : 0));
        addresses.map((r) => r.base += this.baseAddress);

        const maxGap = this.gapThreshold;
        let ranges: AddrRange[] = [];
        if (maxGap >= 0) {
            let last: AddrRange | undefined;
            for (const r of addresses) {
                if (last && ((last.nxtAddr() + maxGap) >= r.base)) {
                    const max = Math.max(last.nxtAddr(), r.nxtAddr());
                    last.length = max - last.base;
                } else {
                    ranges.push(r);
                    last = r;
                }
            }
        } else {
            ranges = addresses;
        }

        // OpenOCD has an issue where the max number of bytes readable are 8191 (instead of 8192)
        // which causes unaligned reads (via gdb) and silent failures. There is patch for this in OpenOCD
        // but in general, it is good to split the reads up. see http://openocd.zylin.com/#/c/5109/
        // Another benefit, we can minimize gdb timeouts
        const maxBytes = (4 * 1024); // Should be a multiple of 4 to be safe for MMIO reads
        this.addrRanges = AddressRangesUtils.splitIntoChunks(ranges, maxBytes, this.name, this.totalLength);
    }

    public getPeripheralNode(): PeripheralNode {
        return this;
    }

    public selected(): Promise<boolean> {
        return this.performUpdate();
    }

    public saveState(_path?: string): NodeSetting[] {
        const results: NodeSetting[] = [];

        if (this.format !== NumberFormat.Auto || this.expanded || this.pinned) {
            results.push({
                node: `${this.name}`,
                expanded: this.expanded,
                format: this.format,
                pinned: this.pinned
            });
        }

        this.children.forEach((c) => {
            results.push(...c.saveState(`${this.name}`));
        });

        return results;
    }

    public findByPath(path: string[]): PeripheralBaseNode | undefined {
        if (path.length === 0) {
            return this;
        } else {
            const child = this.children.find((c) => c.name === path[0]);
            if (child) {
                return child.findByPath(path.slice(1));
            } else {
                return undefined;
            }
        }
    }

    public async performUpdate(): Promise<boolean> {
        throw new Error('Method not implemented.');
    }

    public resolveDeferedEnums(enumTypeValuesMap: { [key: string]: EnumerationMap; }) {
        for (const child of this.children) {
            child.resolveDeferedEnums(enumTypeValuesMap);
        }
    }

    serialize(): PeripheralNodeDTO {
        return PeripheralNodeDTO.create({
            ...super.serialize(),
            ...this.options,
            groupName: this.groupName,
            name: this.name,
            children: []
        });
    }
}

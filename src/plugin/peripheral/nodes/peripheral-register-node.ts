/********************************************************************************
 * Copyright (C) 2023 Marcel Ball, Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import * as vscode from 'vscode';
import { AddrRange } from '../../../addrranges';
import { AccessType, EnumerationMap, PeripheralRegisterOptions } from '../../../api-types';
import { NodeSetting } from '../../../common';
import { NumberFormat } from '../../../common/format';
import { PeripheralRegisterNodeDTO } from '../../../common/peripheral-dto';
import { MemUtils } from '../../../memreadutils';
import { createMask, extractBits, hexFormat, parseInteger } from '../../../utils';
import { ClusterOrRegisterBaseNode, PeripheralBaseNode } from './base-node';
import { PeripheralClusterNode } from './peripheral-cluster-node';
import { PeripheralFieldNode } from './peripheral-field-node';
import { PeripheralNode } from './peripheral-node';


export class PeripheralRegisterNode extends ClusterOrRegisterBaseNode {
    public children: PeripheralFieldNode[];
    public readonly name: string;
    public readonly description?: string;
    public readonly offset: number;
    public readonly accessType: AccessType;
    public readonly size: number;
    public readonly resetValue: number;

    private maxValue: number;
    private hexLength: number;
    private currentValue: number;
    private previousValue?: number;

    constructor(public parent: PeripheralNode | PeripheralClusterNode, protected options: PeripheralRegisterOptions) {
        super(parent);

        this.name = options.name;
        this.description = options.description;
        this.offset = options.addressOffset;
        this.accessType = options.accessType || parent.accessType;
        this.size = options.size || parent.size;
        this.resetValue = options.resetValue !== undefined ? options.resetValue : parent.resetValue;
        this.currentValue = this.resetValue;

        this.hexLength = Math.ceil(this.size / 4);

        this.maxValue = Math.pow(2, this.size);
        this.children = [];
        this.parent.addChild(this);

        options.fields?.forEach((fieldOptions) => {
            // PeripheralFieldNode constructor already adding the reference as child to parent object (PeripheralRegisterNode object)
            new PeripheralFieldNode(this, fieldOptions);
        });
    }

    public reset(): void {
        this.currentValue = this.resetValue;
    }

    public extractBits(offset: number, width: number): number {
        return extractBits(this.currentValue, offset, width);
    }

    public async updateBits(offset: number, width: number, value: number): Promise<boolean> {
        const limit = Math.pow(2, width);
        if (value > limit) {
            throw Error(`Value entered is invalid. Maximum value for this field is ${limit - 1} (${hexFormat(limit - 1, 0)})`);
        }
        const mask = createMask(offset, width);
        const sv = value << offset;
        const newval = (this.currentValue & ~mask) | sv;
        await this.updateValueInternal(newval);
        return true;
    }

    public extractBitsFromReset(offset: number, width: number): number {
        return extractBits(this.resetValue, offset, width);
    }

    public getChildren(): PeripheralFieldNode[] {
        return this.children || [];
    }

    public setChildren(children: PeripheralFieldNode[]): void {
        this.children = children.slice(0, children.length);
        this.children.sort((f1, f2) => f1.offset > f2.offset ? 1 : -1);
    }

    public addChild(child: PeripheralFieldNode): void {
        this.children.push(child);
        this.children.sort((f1, f2) => f1.offset > f2.offset ? 1 : -1);
    }

    public async performUpdate(value?: string): Promise<boolean> {
        const val = value ?? await vscode.window.showInputBox({ prompt: 'Enter new value: (prefix hex with 0x, binary with 0b)', value });
        if (typeof val === 'string') {
            const numval = parseInteger(val);
            if (numval === undefined) {
                return false;
            }
            if (numval >= this.maxValue) {
                throw new Error(`Value entered (${numval}) is greater than the maximum value of ${this.maxValue}`);
            }
            return this.updateValueInternal(numval);
        }
        return false;
    }

    public getAddress(): number {
        return this.parent.getAddress(this.offset);
    }

    private async updateValueInternal(value: number): Promise<boolean> {
        if (!vscode.debug.activeDebugSession) {
            return false;
        }

        const success = await MemUtils.writeMemory(vscode.debug.activeDebugSession, this.parent.getAddress(this.offset), value, this.size);
        if (success) {
            await this.parent.updateData();
        }
        return success;
    }

    public async updateData(): Promise<boolean> {
        const bc = this.size / 8;
        const bytes = this.parent.getBytes(this.offset, bc);
        const buffer = Buffer.from(bytes);
        this.previousValue = this.currentValue;

        switch (bc) {
            case 1:
                this.currentValue = buffer.readUInt8(0);
                break;
            case 2:
                this.currentValue = buffer.readUInt16LE(0);
                break;
            case 4:
                this.currentValue = buffer.readUInt32LE(0);
                break;
            default:
                vscode.debug.activeDebugConsole.appendLine(`Register ${this.name} has invalid size: ${this.size}. Should be 8, 16 or 32.`);
                break;
        }
        await Promise.all(this.children.map(child => child.updateData()));
        return true;
    }

    public saveState(path?: string): NodeSetting[] {
        const results: NodeSetting[] = [];

        if (this.format !== NumberFormat.Auto || this.expanded) {
            results.push({ node: `${path}.${this.name}`, expanded: this.expanded, format: this.format });
        }

        this.children.forEach((c) => {
            results.push(...c.saveState(`${path}.${this.name}`));
        });

        return results;
    }

    public findByPath(path: string[]): PeripheralBaseNode | undefined {
        if (path.length === 0) {
            return this;
        } else if (path.length === 1) {
            const child = this.children.find((c) => c.name === path[0]);
            return child;
        } else {
            return undefined;
        }
    }

    public getPeripheral(): PeripheralBaseNode {
        return this.parent.getPeripheral();
    }

    public collectRanges(addrs: AddrRange[]): void {
        const finalOffset = this.parent.getOffset(this.offset);
        addrs.push(new AddrRange(finalOffset, this.size / 8));
    }

    public resolveDeferedEnums(enumTypeValuesMap: { [key: string]: EnumerationMap; }) {
        for (const child of this.children) {
            child.resolveDeferedEnums(enumTypeValuesMap);
        }
    }

    serialize(): PeripheralRegisterNodeDTO {
        return PeripheralRegisterNodeDTO.create({
            ...super.serialize(),
            ...this.options,
            name: this.name,
            previousValue: this.previousValue,
            currentValue: this.currentValue,
            resetValue: this.resetValue,
            offset: this.offset,
            size: this.size,
            hexLength: this.hexLength,
            children: [],
            address: this.getAddress()
        });
    }
}

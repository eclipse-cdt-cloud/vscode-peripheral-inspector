/********************************************************************************
 * Copyright (C) 2023 Marcel Ball, Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import * as vscode from 'vscode';
import { PeripheralNode } from './peripheral-node';
import { PeripheralClusterNode } from './peripheral-cluster-node';
import { ClusterOrRegisterBaseNode, PERIPHERAL_ID_SEP, PeripheralBaseNode } from './base-node';
import { PeripheralFieldNode } from './peripheral-field-node';
import { AddrRange } from '../../../addrranges';
import { AccessType, PeripheralRegisterOptions, EnumerationMap } from '../../../api-types';
import { NumberFormat, NodeSetting, CommandDefinition } from '../../../common';
import { MemUtils } from '../../../memreadutils';
import { extractBits, hexFormat, createMask, binaryFormat } from '../../../utils';
import { Commands } from '../../../manifest';
import { CDTTreeItem } from '../../../components/tree/types';

export type PeripheralRegisterNodeContextValue = 'registerRW' | 'registerRO' | 'registerWO'

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
    private hexRegex: RegExp;
    private binaryRegex: RegExp;
    private currentValue: number;
    private prevValue = '';

    constructor(public parent: PeripheralNode | PeripheralClusterNode, options: PeripheralRegisterOptions) {
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
        this.binaryRegex = new RegExp(`^0b[01]{1,${this.size}}$`, 'i');
        this.hexRegex = new RegExp(`^0x[0-9a-f]{1,${this.hexLength}}$`, 'i');
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

    public updateBits(offset: number, width: number, value: number): Thenable<boolean> {
        return new Promise((resolve, reject) => {
            const limit = Math.pow(2, width);
            if (value > limit) {
                return reject(`Value entered is invalid. Maximum value for this field is ${limit - 1} (${hexFormat(limit - 1, 0)})`);
            } else {
                const mask = createMask(offset, width);
                const sv = value << offset;
                const newval = (this.currentValue & ~mask) | sv;
                this.updateValueInternal(newval).then(resolve, reject);
            }
        });
    }

    public getCommands(): CommandDefinition[] {
        switch (this.getContextValue()) {
            case 'registerRO':
                return [Commands.COPY_VALUE_COMMAND, Commands.FORCE_REFRESH_COMMAND];
            case 'registerRW':
                return [Commands.COPY_VALUE_COMMAND, Commands.FORCE_REFRESH_COMMAND, Commands.UPDATE_NODE_COMMAND];
            case 'registerWO':
                return [];
            default:
                return [];
        }
    }

    public getContextValue(): PeripheralRegisterNodeContextValue {
        return this.accessType === AccessType.ReadWrite ? 'registerRW' : (this.accessType === AccessType.ReadOnly ? 'registerRO' : 'registerWO');
    }

    public getLabelTitle(): string {
        return `${this.name} @ ${hexFormat(this.offset, 0)}`;
    }

    public getLabelValue(): string {
        return this.getFormattedValue(this.getFormat());
    }

    public getLabel(): string {
        return this.getLabelTitle() + ' ' + this.getLabelValue();
    }

    public hasHighlights(): boolean {
        const displayValue = this.getLabelValue();

        return displayValue !== this.prevValue;
    }

    public getLabelHighlights(): [number, number][] | undefined {
        const title = this.getLabelTitle();
        const label = this.getLabel();

        if (this.hasHighlights()) {
            return [[title.length + 1, label.length]];
        }

        return undefined;
    }

    public getTreeItem(): vscode.TreeItem | Promise<vscode.TreeItem> {
        const collapseState = this.children && this.children.length > 0
            ? (this.expanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed)
            : vscode.TreeItemCollapsibleState.None;

        const labelItem: vscode.TreeItemLabel = {
            label: this.getLabel(),
            highlights: this.getLabelHighlights()
        };
        const item = new vscode.TreeItem(labelItem, collapseState);
        item.id = this.getId();
        item.contextValue = this.getContextValue();
        item.tooltip = this.generateTooltipMarkdown() || undefined;

        return item;
    }

    public getCDTTreeItem(): CDTTreeItem {
        const labelValue = this.getLabelValue();
        return CDTTreeItem.create({
            id: this.getId(),
            label: this.getLabel(),
            expanded: this.expanded,
            path: this.getId().split(PERIPHERAL_ID_SEP),
            options: {
                commands: this.getCommands(),
                contextValue: this.getContextValue(),
                tooltip: this.generateTooltipMarkdown()?.value ?? undefined,
                highlights: this.getLabelHighlights(),
            },
            columns: {
                'title': {
                    type: 'expander',
                    label: this.getLabelTitle(),
                    tooltip: this.generateTooltipMarkdown()?.value ?? undefined,
                },
                'value': {
                    type: 'string',
                    label: labelValue,
                    highlight: this.hasHighlights() ?
                        [[0, labelValue.length]]
                        : undefined,
                    tooltip: labelValue
                }
            }
        });
    }

    private generateTooltipMarkdown(): vscode.MarkdownString | null {
        const mds = new vscode.MarkdownString('', true);
        mds.isTrusted = true;

        const address = `${hexFormat(this.getAddress())}`;

        const formattedValue = this.getFormattedValue(this.getFormat());

        const roLabel = this.accessType === AccessType.ReadOnly ? '(Read Only)' : '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;';

        mds.appendMarkdown(`| ${this.name}@${address} | ${roLabel} | *${formattedValue}* |\n`);
        mds.appendMarkdown('|:---|:---:|---:|\n\n');

        if (this.accessType !== AccessType.WriteOnly) {
            mds.appendMarkdown(`**Reset Value:** ${this.getFormattedResetValue(this.getFormat())}\n`);
        }

        mds.appendMarkdown('\n____\n\n');
        if (this.description) {
            mds.appendMarkdown(this.description);
        }

        mds.appendMarkdown('\n_____\n\n');

        // Don't try to display current value table for write only fields
        if (this.accessType === AccessType.WriteOnly) {
            return mds;
        }

        const hex = this.getFormattedValue(NumberFormat.Hexadecimal);
        const decimal = this.getFormattedValue(NumberFormat.Decimal);
        const binary = this.getFormattedValue(NumberFormat.Binary);

        mds.appendMarkdown('| Hex &nbsp;&nbsp; | Decimal &nbsp;&nbsp; | Binary &nbsp;&nbsp; |\n');
        mds.appendMarkdown('|:---|:---|:---|\n');
        mds.appendMarkdown(`| ${hex} &nbsp;&nbsp; | ${decimal} &nbsp;&nbsp; | ${binary} &nbsp;&nbsp; |\n\n`);

        const children = this.getChildren();
        if (children.length === 0) { return mds; }

        mds.appendMarkdown('**Fields**\n\n');
        mds.appendMarkdown('| Field | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; | Bit-Range | Value |\n');
        mds.appendMarkdown('|:---|:---:|:---|:---|\n');

        children.forEach((field) => {
            mds.appendMarkdown(`| ${field.name} | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; | ${field.getFormattedRange()} | `
                + `${field.getFormattedValue(field.getFormat(), true)} |\n`);
        });

        return mds;
    }

    public getFormattedValue(format: NumberFormat): string {
        return this.formatValue(this.currentValue, format);
    }

    public getFormattedResetValue(format: NumberFormat): string {
        return this.formatValue(this.resetValue, format);
    }

    private formatValue(value: number, format: NumberFormat): string {
        if (this.accessType === AccessType.WriteOnly) {
            return '(Write Only)';
        }

        switch (format) {
            case NumberFormat.Decimal:
                return value.toString();
            case NumberFormat.Binary:
                return binaryFormat(value, this.hexLength * 4);
            default:
                return hexFormat(value, this.hexLength, true);
        }
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

    public getFormat(): NumberFormat {
        if (this.format !== NumberFormat.Auto) {
            return this.format;
        } else {
            return this.parent.getFormat();
        }
    }

    public getCopyValue(): string {
        switch (this.getFormat()) {
            case NumberFormat.Decimal:
                return this.currentValue.toString();
            case NumberFormat.Binary:
                return binaryFormat(this.currentValue, this.hexLength * 4);
            default:
                return hexFormat(this.currentValue, this.hexLength);
        }
    }

    public async performUpdate(): Promise<boolean> {
        const val = await vscode.window.showInputBox({ prompt: 'Enter new value: (prefix hex with 0x, binary with 0b)', value: this.getCopyValue() });
        if (!val) {
            return false;
        }

        let numval: number;
        if (val.match(this.hexRegex)) {
            numval = parseInt(val.substr(2), 16);
        } else if (val.match(this.binaryRegex)) {
            numval = parseInt(val.substr(2), 2);
        } else if (val.match(/^[0-9]+/)) {
            numval = parseInt(val, 10);
            if (numval >= this.maxValue) {
                throw new Error(`Value entered (${numval}) is greater than the maximum value of ${this.maxValue}`);
            }
        } else {
            throw new Error('Value entered is not a valid format.');
        }

        return this.updateValueInternal(numval);
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

    public updateData(): Thenable<boolean> {
        const bc = this.size / 8;
        const bytes = this.parent.getBytes(this.offset, bc);
        const buffer = Buffer.from(bytes);
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
        this.children.forEach((f) => f.updateData());
        this.prevValue = this.getLabelValue();

        return Promise.resolve(true);
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
}

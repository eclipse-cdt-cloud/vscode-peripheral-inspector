/********************************************************************************
 * Copyright (C) 2023 Marcel Ball, Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import * as vscode from 'vscode';
import { AddrRange } from '../../../addrranges';
import { AccessType, EnumerationMap, FieldOptions } from '../../../api-types';
import { CommandDefinition, NodeSetting, NumberFormat } from '../../../common';
import { Commands } from '../../../manifest';
import { binaryFormat, hexFormat, parseInteger } from '../../../utils';
import { PERIPHERAL_ID_SEP, PeripheralBaseNode } from './base-node';
import { CDTTreeItem } from '../../../components/tree/types';
import { PeripheralRegisterNode } from './peripheral-register-node';

export type PeripheralFieldNodeContextValue = 'field' | 'field-res' | 'fieldRO' | 'fieldWO'

export class PeripheralFieldNode extends PeripheralBaseNode {
    public session: vscode.DebugSession | undefined;
    public readonly name: string;
    public readonly description: string;
    public readonly offset: number;
    public readonly width: number;
    public readonly accessType: AccessType;

    private enumeration: EnumerationMap | undefined;
    private enumerationValues: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private enumerationMap: any;
    private prevValue = '';

    constructor(public parent: PeripheralRegisterNode, private options: FieldOptions) {
        super(parent);

        this.name = options.name;
        this.description = options.description;
        this.offset = options.offset;
        this.width = options.width;

        if (!options.accessType) {
            this.accessType = parent.accessType;
        } else {
            if (parent.accessType === AccessType.ReadOnly && options.accessType !== AccessType.ReadOnly) {
                this.accessType = AccessType.ReadOnly;
            } else if (parent.accessType === AccessType.WriteOnly && options.accessType !== AccessType.WriteOnly) {
                this.accessType = AccessType.WriteOnly;
            } else {
                this.accessType = options.accessType;
            }
        }

        if (options.enumeration) {
            this.setEnumeration(options.enumeration);
        }

        this.parent.addChild(this);
    }

    private setEnumeration(enumeration: EnumerationMap) {
        this.enumeration = enumeration;
        this.enumerationMap = {};
        this.enumerationValues = [];

        for (const key in enumeration) {
            const name = enumeration[key].name;

            this.enumerationValues.push(name);
            this.enumerationMap[name] = key;
        }
    }

    public getLabelTitle(): string {
        const rangestart = this.offset;
        const rangeend = this.offset + this.width - 1;
        return `${this.name} [${rangeend}:${rangestart}]`;
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
        const labelItem: vscode.TreeItemLabel = {
            label: this.getLabel(),
            highlights: this.getLabelHighlights()
        };
        const item = new vscode.TreeItem(labelItem, vscode.TreeItemCollapsibleState.None);
        item.id = this.getId();
        item.contextValue = this.getContextValue();
        item.tooltip = this.generateTooltipMarkdown(this.isReserved()) || undefined;

        return item;
    }

    public getCDTTreeItem(): CDTTreeItem {
        const labelValue = this.getLabelValue();

        return CDTTreeItem.create({
            id: this.getId(),
            label: this.getLabel(),
            leaf: true,
            path: this.getId().split(PERIPHERAL_ID_SEP),
            options: {
                commands: this.getCommands(),
                contextValue: this.getContextValue(),
                tooltip: this.generateTooltipMarkdown(this.isReserved())?.value ?? undefined,
                highlights: this.getLabelHighlights()
            },
            columns: {
                'title': {
                    type: 'expander',
                    label: this.getLabelTitle(),
                    tooltip: this.generateTooltipMarkdown(this.isReserved())?.value ?? undefined,
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

    public getCommands(): CommandDefinition[] {
        switch (this.getContextValue()) {
            case 'field':
                return [Commands.COPY_VALUE_COMMAND, Commands.UPDATE_NODE_COMMAND,];
            case 'field-res':
                return [];
            case 'fieldRO':
                return [Commands.COPY_VALUE_COMMAND];
            case 'fieldWO':
                return [Commands.UPDATE_NODE_COMMAND];
            default:
                return [];
        }
    }

    public getContextValue(): PeripheralFieldNodeContextValue {
        let context: PeripheralFieldNodeContextValue = 'field';
        if (this.isReserved()) {
            context = 'field-res';
        } else if (this.accessType === AccessType.ReadOnly) {
            context = 'fieldRO';
        } else if (this.accessType === AccessType.WriteOnly) {
            context = 'fieldWO';
        }

        return context;
    }

    public isReserved(): boolean {
        return this.name.toLowerCase() === 'reserved';
    }

    private generateTooltipMarkdown(isReserved: boolean): vscode.MarkdownString | null {
        const mds = new vscode.MarkdownString('', true);
        mds.isTrusted = true;

        const address = `${hexFormat(this.parent.getAddress())}${this.getFormattedRange()}`;

        if (isReserved) {
            mds.appendMarkdown(`| ${this.name}@${address} | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; | *Reserved* |\n`);
            mds.appendMarkdown('|:---|:---:|---:|');
            return mds;
        }

        const formattedValue = this.getFormattedValue(this.getFormat(), true);

        const roLabel = this.accessType === AccessType.ReadOnly ? '(Read Only)' : '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;';

        mds.appendMarkdown(`| ${this.name}@${address} | ${roLabel} | *${formattedValue}* |\n`);
        mds.appendMarkdown('|:---|:---:|---:|\n\n');

        if (this.accessType !== AccessType.WriteOnly) {
            mds.appendMarkdown(`**Reset Value:** ${this.formatValue(this.getResetValue(), this.getFormat())}\n`);
        }

        mds.appendMarkdown('\n____\n\n');
        mds.appendMarkdown(this.description);

        mds.appendMarkdown('\n_____\n\n');

        // Don't try to display current value table for write only fields
        if (this.accessType === AccessType.WriteOnly) {
            return mds;
        }

        const value = this.parent.extractBits(this.offset, this.width);
        const hex = hexFormat(value, Math.ceil(this.width / 4), true);
        const decimal = value.toString();
        const binary = binaryFormat(value, this.width);

        if (this.enumeration) {
            mds.appendMarkdown('| Enumeration Value &nbsp;&nbsp; | Hex &nbsp;&nbsp; | Decimal &nbsp;&nbsp; | Binary &nbsp;&nbsp; |\n');
            mds.appendMarkdown('|:---|:---|:---|:---|\n');
            let ev = 'Unknown';
            if (this.enumeration[value]) {
                ev = this.enumeration[value].name;
            }

            mds.appendMarkdown(`| ${ev} &nbsp;&nbsp; | ${hex} &nbsp;&nbsp; | ${decimal} &nbsp;&nbsp; | ${binary} &nbsp;&nbsp; |\n\n`);
            if (this.enumeration[value] && this.enumeration[value].description) {
                mds.appendMarkdown(this.enumeration[value].description);
            }
        } else {
            mds.appendMarkdown('| Hex &nbsp;&nbsp; | Decimal &nbsp;&nbsp; | Binary &nbsp;&nbsp; |\n');
            mds.appendMarkdown('|:---|:---|:---|\n');
            mds.appendMarkdown(`| ${hex} &nbsp;&nbsp; | ${decimal} &nbsp;&nbsp; | ${binary} &nbsp;&nbsp; |\n`);
        }

        return mds;
    }

    public getFormattedRange(): string {
        const rangestart = this.offset;
        const rangeend = this.offset + this.width - 1;
        return `[${rangeend}:${rangestart}]`;
    }

    private getCurrentValue(): number {
        return this.parent.extractBits(this.offset, this.width);
    }

    private getResetValue(): number {
        return this.parent.extractBitsFromReset(this.offset, this.width);
    }

    public getFormattedValue(format: NumberFormat, includeEnumeration = true): string {
        return this.formatValue(this.getCurrentValue(), format, includeEnumeration);
    }

    private formatValue(value: number, format: NumberFormat, includeEnumeration = true): string {
        if (this.accessType === AccessType.WriteOnly) {
            return '(Write Only)';
        }

        let formatted = '';

        switch (format) {
            case NumberFormat.Decimal:
                formatted = value.toString();
                break;
            case NumberFormat.Binary:
                formatted = binaryFormat(value, this.width);
                break;
            case NumberFormat.Hexadecimal:
                formatted = hexFormat(value, Math.ceil(this.width / 4), true);
                break;
            default:
                formatted = this.width >= 4 ? hexFormat(value, Math.ceil(this.width / 4), true) : binaryFormat(value, this.width);
                break;
        }

        if (includeEnumeration && this.enumeration) {
            if (this.enumeration[value]) {
                formatted = `${this.enumeration[value].name} (${formatted})`;
            } else {
                formatted = `Unknown Enumeration (${formatted})`;
            }
        }

        return formatted;
    }

    public getEnumerationValue(value: number): string | undefined {
        if (!this.enumeration) {
            return undefined;
        }

        if (this.enumeration[value]) {
            return this.enumeration[value].name;
        }
    }

    public getChildren(): PeripheralBaseNode[] | Promise<PeripheralBaseNode[]> {
        return [];
    }

    public performUpdate(): Thenable<boolean> {
        return new Promise((resolve, reject) => {
            if (this.enumeration) {
                const items: vscode.QuickPickItem[] = [];
                for (const eStr of this.enumerationValues) {
                    const numval = this.enumerationMap[eStr];
                    const e = this.enumeration[numval];
                    const item: vscode.QuickPickItem = {
                        label: eStr,
                        detail: e.description
                    };
                    items.push(item);
                }
                vscode.window.showQuickPick(items).then((val) => {
                    if (val === undefined) {
                        return false;
                    }

                    const numval = this.enumerationMap[val.label];
                    this.parent.updateBits(this.offset, this.width, numval).then(resolve, reject);
                });
            } else {
                vscode.window.showInputBox({ prompt: 'Enter new value: (prefix hex with 0x, binary with 0b)', value: this.getCopyValue() }).then((val) => {
                    if (typeof val === 'string') {
                        const numval = parseInteger(val);
                        if (numval === undefined) {
                            return false;
                        }
                        this.parent.updateBits(this.offset, this.width, numval).then(resolve, reject);
                    }
                });
            }
        });
    }

    public getCopyValue(): string {
        const value = this.parent.extractBits(this.offset, this.width);
        switch (this.getFormat()) {
            case NumberFormat.Decimal:
                return value.toString();
            case NumberFormat.Binary:
                return binaryFormat(value, this.width);
            case NumberFormat.Hexadecimal:
                return hexFormat(value, Math.ceil(this.width / 4), true);
            default:
                return this.width >= 4 ? hexFormat(value, Math.ceil(this.width / 4), true) : binaryFormat(value, this.width);
        }
    }

    public updateData(): Thenable<boolean> {
        this.prevValue = this.getLabelValue();
        return Promise.resolve(true);
    }

    public getFormat(): NumberFormat {
        if (this.format !== NumberFormat.Auto) {
            return this.format;
        } else {
            return this.parent.getFormat();
        }
    }

    public saveState(path: string): NodeSetting[] {
        if (this.format !== NumberFormat.Auto) {
            return [{ node: `${path}.${this.name}`, format: this.format }];
        } else {
            return [];
        }
    }

    public findByPath(path: string[]): PeripheralBaseNode | undefined {
        if (path.length === 0) {
            return this;
        } else {
            return undefined;
        }
    }

    public getPeripheral(): PeripheralBaseNode {
        return this.parent.getPeripheral();
    }

    public collectRanges(_a: AddrRange[]): void {
        throw new Error('Method not implemented.');
    }

    public resolveDeferedEnums(enumTypeValuesMap: { [key: string]: EnumerationMap; }) {
        if (this.options.derivedFrom) {
            const map = enumTypeValuesMap[this.options.derivedFrom];
            if (map) {
                this.setEnumeration(map);
                this.options.derivedFrom = undefined;
            } else {
                throw new Error(`Invalid derivedFrom=${this.options.derivedFrom} for enumeratedValues of field ${this.name}`);
            }
        }
    }
}

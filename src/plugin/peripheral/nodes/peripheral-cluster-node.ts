/********************************************************************************
 * Copyright (C) 2023 Marcel Ball, Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import * as vscode from 'vscode';
import { AddrRange } from '../../../addrranges';
import { AccessType, ClusterOptions, EnumerationMap } from '../../../api-types';
import { NodeSetting } from '../../../common';
import { CDTTreeItem } from '../../../components/tree/types';
import { hexFormat } from '../../../utils';
import { ClusterOrRegisterBaseNodeImpl, PeripheralBaseNodeImpl } from './base-node';
import { PeripheralNodeImpl } from './peripheral-node';
import { PeripheralRegisterNodeImpl } from './peripheral-register-node';
import { PERIPHERAL_ID_SEP, PeripheralClusterNode } from '../../../common/peripherals';
import { NumberFormat } from '../../../common/format';



export type PeripheralOrClusterNodeImpl = PeripheralNodeImpl | PeripheralClusterNodeImpl;
export type PeripheralRegisterOrClusterNodeImpl = PeripheralRegisterNodeImpl | PeripheralClusterNodeImpl;

export class PeripheralClusterNodeImpl extends ClusterOrRegisterBaseNodeImpl {
    private children: PeripheralRegisterOrClusterNodeImpl[];
    public readonly name: string;
    public readonly description?: string;
    public readonly offset: number;
    public readonly size: number;
    public readonly resetValue: number;
    public readonly accessType: AccessType;

    constructor(public parent: PeripheralOrClusterNodeImpl, protected options: ClusterOptions) {
        super(parent);
        this.name = options.name;
        this.description = options.description;
        this.offset = options.addressOffset;
        this.accessType = options.accessType || AccessType.ReadWrite;
        this.size = options.size || parent.size;
        this.resetValue = options.resetValue || parent.resetValue;
        this.children = [];
        this.parent.addChild(this);

        options.clusters?.forEach((clusterOptions) => {
            // PeripheralClusterNode constructor already adding the reference as child to parent object (PeripheralClusterNode object)
            new PeripheralClusterNodeImpl(this, clusterOptions);
        });

        options.registers?.forEach((registerOptions) => {
            // PeripheralRegisterNode constructor already adding the reference as child to parent object (PeripheralClusterNode object)
            new PeripheralRegisterNodeImpl(this, registerOptions);
        });
    }

    /**
     * @deprecated
     */
    public getLabel(): string {
        return `${this.getLabelTitle()} [${this.getLabelValue()}]`;
    }

    /**
     * @deprecated
     */
    public getLabelTitle(): string {
        return this.name;
    }

    /**
     * @deprecated
     */
    public getLabelValue(): string {
        return hexFormat(this.offset, 0);
    }

    /**
     * @deprecated
     */
    public getContextValue(): string {
        return 'cluster';
    }

    public getTreeItem(): vscode.TreeItem | Promise<vscode.TreeItem> {
        const label = this.getLabel();

        const item = new vscode.TreeItem(label, this.expanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed);
        item.id = this.getId();
        item.contextValue = this.getContextValue();
        item.tooltip = this.description || undefined;

        return item;
    }

    /**
     * @deprecated
     */
    public getCDTTreeItem(): CDTTreeItem {
        return CDTTreeItem.create({
            id: this.getId(),
            key: this.getId(),
            expanded: this.expanded,
            label: this.getLabel(),
            resource: undefined,
            path: this.getId().split(PERIPHERAL_ID_SEP),
            options: {
                commands: this.getCommands(),
                contextValue: this.getContextValue(),
                tooltip: this.description,
            },
            columns: {
                'title': {
                    type: 'expander',
                    label: this.getLabelTitle(),
                    tooltip: this.description,
                },
                'value': {
                    type: 'string',
                    label: this.getLabelValue(),
                    tooltip: this.getLabelValue()
                }
            }
        });
    }
    public getChildren(): PeripheralRegisterOrClusterNodeImpl[] {
        return this.children;
    }

    public setChildren(children: PeripheralRegisterOrClusterNodeImpl[]): void {
        this.children = children.slice(0, children.length);
        this.children.sort((c1, c2) => c1.offset > c2.offset ? 1 : -1);
    }

    public addChild(child: PeripheralRegisterOrClusterNodeImpl): void {
        this.children.push(child);
        this.children.sort((c1, c2) => c1.offset > c2.offset ? 1 : -1);
    }

    public getBytes(offset: number, size: number): Uint8Array {
        return this.parent.getBytes(this.offset + offset, size);
    }

    public getAddress(offset: number): number {
        return this.parent.getAddress(this.offset + offset);
    }

    public getOffset(offset: number): number {
        return this.parent.getOffset(this.offset + offset);
    }

    public getFormat(): NumberFormat {
        if (this.format !== NumberFormat.Auto) {
            return this.format;
        } else {
            return this.parent.getFormat();
        }
    }

    public updateData(): Thenable<boolean> {
        return new Promise((resolve, reject) => {
            const promises = this.children.map((r) => r.updateData());
            Promise.all(promises).then(() => {
                resolve(true);
            }).catch(() => {
                reject('Failed');
            });
        });
    }

    public saveState(path: string): NodeSetting[] {
        const results: NodeSetting[] = [];

        if (this.format !== NumberFormat.Auto || this.expanded) {
            results.push({ node: `${path}.${this.name}`, expanded: this.expanded, format: this.format });
        }

        this.children.forEach((c) => {
            results.push(...c.saveState(`${path}.${this.name}`));
        });

        return results;
    }

    public findByPath(path: string[]): PeripheralBaseNodeImpl | undefined {
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

    public collectRanges(ary: AddrRange[]): void {
        this.children.map((r) => { r.collectRanges(ary); });
    }

    public getPeripheral(): PeripheralBaseNodeImpl {
        return this.parent.getPeripheral();
    }

    public getCopyValue(): string {
        throw new Error('Method not implemented.');
    }

    public performUpdate(): Thenable<boolean> {
        throw new Error('Method not implemented.');
    }

    public resolveDeferedEnums(enumTypeValuesMap: { [key: string]: EnumerationMap; }) {
        for (const child of this.children) {
            child.resolveDeferedEnums(enumTypeValuesMap);
        }
    }

    serialize(): PeripheralClusterNode {
        return PeripheralClusterNode.create({
            ...super.serialize(),
            ...this.options,
            offset: this.offset,
            children: []
        });
    }

}

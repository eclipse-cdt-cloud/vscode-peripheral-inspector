/********************************************************************************
 * Copyright (C) 2023 Marcel Ball, Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import { AddrRange } from '../../../addrranges';
import { AccessType, ClusterOptions, EnumerationMap } from '../../../api-types';
import { NodeSetting } from '../../../common';
import { NumberFormat } from '../../../common/format';
import { PeripheralClusterNodeDTO } from '../../../common/peripheral-dto';
import { ClusterOrRegisterBaseNode, PeripheralBaseNode } from './base-node';
import { PeripheralNode } from './peripheral-node';
import { PeripheralRegisterNode as PeripheralRegisterNode } from './peripheral-register-node';



export type PeripheralOrClusterNode = PeripheralNode | PeripheralClusterNode;
export type PeripheralRegisterOrClusterNode = PeripheralRegisterNode | PeripheralClusterNode;

export class PeripheralClusterNode extends ClusterOrRegisterBaseNode {
    private children: PeripheralRegisterOrClusterNode[];
    public readonly name: string;
    public readonly description?: string;
    public readonly offset: number;
    public readonly size: number;
    public readonly resetValue: number;
    public readonly accessType: AccessType;

    constructor(public parent: PeripheralOrClusterNode, protected options: ClusterOptions) {
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
            new PeripheralClusterNode(this, clusterOptions);
        });

        options.registers?.forEach((registerOptions) => {
            // PeripheralRegisterNode constructor already adding the reference as child to parent object (PeripheralClusterNode object)
            new PeripheralRegisterNode(this, registerOptions);
        });
    }

    public getChildren(): PeripheralRegisterOrClusterNode[] {
        return this.children;
    }

    public setChildren(children: PeripheralRegisterOrClusterNode[]): void {
        this.children = children.slice(0, children.length);
        this.children.sort((c1, c2) => c1.offset > c2.offset ? 1 : -1);
    }

    public addChild(child: PeripheralRegisterOrClusterNode): void {
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

    public collectRanges(ary: AddrRange[]): void {
        this.children.map((r) => { r.collectRanges(ary); });
    }

    public getPeripheral(): PeripheralBaseNode {
        return this.parent.getPeripheral();
    }

    public performUpdate(): Thenable<boolean> {
        throw new Error('Method not implemented.');
    }

    public resolveDeferedEnums(enumTypeValuesMap: { [key: string]: EnumerationMap; }) {
        for (const child of this.children) {
            child.resolveDeferedEnums(enumTypeValuesMap);
        }
    }

    serialize(): PeripheralClusterNodeDTO {
        return PeripheralClusterNodeDTO.create({
            ...super.serialize(),
            ...this.options,
            offset: this.offset,
            children: []
        });
    }

}
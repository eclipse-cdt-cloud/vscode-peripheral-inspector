/********************************************************************************
 * Copyright (C) 2023 Marcel Ball, Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import { Command, DebugSession, TreeItem } from 'vscode';
import { AddrRange } from '../../../addrranges';
import { EnumerationMap } from '../../../api-types';
import { CommandDefinition, MaybePromise, NodeSetting, NumberFormat } from '../../../common';
import { CDTTreeItem } from '../../../components/tree/types';

export abstract class BaseNode {
    public expanded: boolean;

    constructor(protected readonly parent?: BaseNode) {
        this.expanded = false;
    }

    public getParent(): BaseNode | undefined {
        return this.parent;
    }

    public abstract getChildren(): BaseNode[] | Promise<BaseNode[]>;
    public abstract getTreeItem(): TreeItem | Promise<TreeItem>;
    public abstract getCDTTreeItem(): MaybePromise<CDTTreeItem>;


    public getCommand(): Command | undefined {
        return undefined;
    }

    public abstract getCopyValue(): string | undefined;
}

export const PERIPHERAL_ID_SEP = '-';

export abstract class PeripheralBaseNode extends BaseNode {
    public format: NumberFormat;
    public pinned: boolean;
    public readonly name: string | undefined;
    public session: DebugSession | undefined;

    constructor(public readonly parent?: PeripheralBaseNode) {
        super(parent);
        this.format = NumberFormat.Auto;
        this.pinned = false;
    }

    public async selected(): Promise<boolean> {
        return false;
    }

    public getId(): string {
        if (this.parent) {
            return `${this.parent.getId()}${PERIPHERAL_ID_SEP}${this.name}`;
        }

        return this.name ?? this.session?.id ?? 'unknown';
    }

    public abstract performUpdate(value?: string): Promise<boolean>;
    public abstract updateData(): Promise<boolean>;

    public abstract getChildren(): PeripheralBaseNode[] | Promise<PeripheralBaseNode[]>;
    public abstract getPeripheral(): PeripheralBaseNode | undefined;

    public abstract collectRanges(ary: AddrRange[]): void;      // Append addr range(s) to array

    public abstract saveState(path?: string): NodeSetting[];
    public abstract findByPath(path: string[]): PeripheralBaseNode | undefined;
    public getCommands(): CommandDefinition[] {
        return [];
    }

    public async setSession(session: DebugSession): Promise<void> {
        this.session = session;
        const children = await this.getChildren();
        for (const child of children) {
            child.setSession(session);
        }
    }
}

export abstract class ClusterOrRegisterBaseNode extends PeripheralBaseNode {
    public readonly offset: number | undefined;
    public abstract resolveDeferedEnums(enumTypeValuesMap: { [key: string]: EnumerationMap; }): void;
}

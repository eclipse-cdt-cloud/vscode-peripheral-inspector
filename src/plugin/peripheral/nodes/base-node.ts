/********************************************************************************
 * Copyright (C) 2023 Marcel Ball, Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import { Command, DebugSession, TreeItem } from 'vscode';
import { AddrRange } from '../../../addrranges';
import { EnumerationMap } from '../../../api-types';
import { CommandDefinition, MaybePromise, NodeSetting } from '../../../common';
import { NumberFormat } from '../../../common/format';
import { ClusterOrRegisterBaseNode, PERIPHERAL_ID_SEP, PeripheralBaseNode, PeripheralBaseTreeNode } from '../../../common/peripherals';
import { CDTTreeItem } from '../../../components/tree/types';

export abstract class BaseTreeNodeImpl {
    get id(): string {
        return this.getId();
    }

    /**
     * @deprecated Webview manages the display state
     */
    public expanded: boolean;

    constructor(protected readonly parent?: BaseTreeNodeImpl) {
        this.expanded = false;
    }

    public getParent(): BaseTreeNodeImpl | undefined {
        return this.parent;
    }

    public abstract getId(): string;

    public abstract getChildren(): BaseTreeNodeImpl[] | Promise<BaseTreeNodeImpl[]>;
    /**
     * @deprecated Webview manages the display state
     */
    public abstract getTreeItem(): TreeItem | Promise<TreeItem>;
    /**
     * @deprecated Webview manages the display state
     */
    public abstract getCDTTreeItem(): MaybePromise<CDTTreeItem>;
    /**
     * @deprecated Webview manages the display state
     */
    public getCommand(): Command | undefined {
        return undefined;
    }
    /**
     * @deprecated Webview manages the display state
     */
    public abstract getCopyValue(): string | undefined;

    serialize(): PeripheralBaseTreeNode {
        return PeripheralBaseTreeNode.create({
            id: this.id,
            parentId: this.parent?.id,
            expanded: this.expanded,
        });
    }
}

export abstract class PeripheralBaseNodeImpl extends BaseTreeNodeImpl {
    public format: NumberFormat;
    public pinned: boolean;
    public readonly name: string | undefined;
    public session: DebugSession | undefined;

    constructor(public readonly parent?: PeripheralBaseNodeImpl) {
        super(parent);
        this.format = NumberFormat.Auto;
        this.pinned = false;
    }

    public selected(): Thenable<boolean> {
        return Promise.resolve(false);
    }

    public getId(): string {
        if (this.parent) {
            return `${this.parent.getId()}${PERIPHERAL_ID_SEP}${this.name}`;
        }

        return this.name ?? this.session?.id ?? 'unknown';
    }

    public abstract performUpdate(): Thenable<boolean>;
    public abstract updateData(): Thenable<boolean>;

    public abstract getChildren(): PeripheralBaseNodeImpl[] | Promise<PeripheralBaseNodeImpl[]>;
    public abstract getPeripheral(): PeripheralBaseNodeImpl | undefined;

    public abstract collectRanges(ary: AddrRange[]): void;      // Append addr range(s) to array

    public abstract saveState(path?: string): NodeSetting[];
    public abstract findByPath(path: string[]): PeripheralBaseNodeImpl | undefined;
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

    serialize(): PeripheralBaseNode {
        return PeripheralBaseNode.create({
            ...super.serialize(),
            id: this.getId(),
            format: this.format,
            pinned: this.pinned,
            session: this.session?.id,
        });
    }
}

export abstract class ClusterOrRegisterBaseNodeImpl extends PeripheralBaseNodeImpl {
    public readonly offset: number | undefined;
    public abstract resolveDeferedEnums(enumTypeValuesMap: { [key: string]: EnumerationMap; }): void;

    serialize(): ClusterOrRegisterBaseNode {
        return ClusterOrRegisterBaseNode.create({
            ...super.serialize(),
            offset: this.offset,
        });
    }
}

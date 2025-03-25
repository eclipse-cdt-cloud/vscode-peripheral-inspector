/********************************************************************************
 * Copyright (C) 2023 Marcel Ball, Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import { DebugSession } from 'vscode';
import { AddrRange } from '../../../addrranges';
import { EnumerationMap } from '../../../api-types';
import { NodeSetting } from '../../../common';
import { NumberFormat } from '../../../common/format';
import { ClusterOrRegisterBaseNodeDTO, PERIPHERAL_ID_SEP, PeripheralBaseNodeDTO, PeripheralBaseTreeNodeDTO } from '../../../common/peripheral-dto';

export abstract class BaseTreeNode {
    get id(): string {
        return this.getId();
    }

    /**
     * Whether the node is expanded or not. Depending on the tree view implementation, this may refresh children.
     */
    public expanded: boolean;

    constructor(protected parent?: BaseTreeNode) {
        this.expanded = false;
    }

    public getParent(): BaseTreeNode | undefined {
        return this.parent;
    }

    public setParent(parent: BaseTreeNode): void {
        this.parent = parent;
    }

    public abstract getId(): string;

    public abstract getChildren(): BaseTreeNode[] | Promise<BaseTreeNode[]>;

    serialize(): PeripheralBaseTreeNodeDTO {
        return PeripheralBaseTreeNodeDTO.create({
            id: this.id,
            parentId: this.parent?.id,
            expanded: this.expanded,
        });
    }
}

export abstract class PeripheralBaseNode extends BaseTreeNode {
    public format: NumberFormat;
    public pinned: boolean;
    public name?: string;
    public session?: DebugSession;

    constructor(parent?: PeripheralBaseNode) {
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

    public abstract performUpdate(args?: unknown): Promise<boolean>;
    public abstract updateData(): Promise<boolean>;

    public abstract getChildren(): PeripheralBaseNode[] | Promise<PeripheralBaseNode[]>;
    public abstract getPeripheral(): PeripheralBaseNode | undefined;

    public abstract collectRanges(ary: AddrRange[]): void;      // Append addr range(s) to array

    public abstract saveState(path?: string): NodeSetting[];
    public abstract findByPath(path: string[]): PeripheralBaseNode | undefined;

    public async setSession(session: DebugSession): Promise<void> {
        this.session = session;
        const children = await this.getChildren();
        for (const child of children) {
            child.setSession(session);
        }
    }

    serialize(): PeripheralBaseNodeDTO {
        return PeripheralBaseNodeDTO.create({
            ...super.serialize(),
            id: this.getId(),
            name: this.name || '',
            format: this.format,
            pinned: this.pinned,
            session: this.session?.id,
        });
    }
}

export abstract class ClusterOrRegisterBaseNode extends PeripheralBaseNode {
    public readonly offset: number | undefined;
    public abstract resolveDeferedEnums(enumTypeValuesMap: { [key: string]: EnumerationMap; }): void;

    serialize(): ClusterOrRegisterBaseNodeDTO {
        return ClusterOrRegisterBaseNodeDTO.create({
            ...super.serialize(),
            offset: this.offset,
        });
    }
}

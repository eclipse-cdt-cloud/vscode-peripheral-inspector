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

export interface UpdateDataContext {
    reason?: string;
    changes?: PeripheralBaseNode[];
}

/** Separates the base segment from the ordinal of siblings that share it. Must not be PERIPHERAL_ID_SEP. */
const DUPLICATE_NAME_SEP = '#';

export function compareByOffset(a: { offset: number }, b: { offset: number }): number {
    return a.offset - b.offset;
}

export abstract class PeripheralBaseNode extends BaseTreeNode {
    public format: NumberFormat;
    public pinned: boolean;
    public name?: string;
    public session?: DebugSession;

    /**
     * Segment of this node in its id and path.
     * A unique base stays as-is (`name`, or `name[offset:width]` for a field).
     * Among siblings that share a base, the lowest offset keeps the base and the rest become `base#2`, `base#3`, ...
     * Ties keep SVD order. A generated suffix never takes a base that another sibling actually has (`FOO#2`).
     */
    public idSegment?: string;

    constructor(parent?: PeripheralBaseNode) {
        super(parent);
        this.format = NumberFormat.Auto;
        this.pinned = false;
    }

    public async selected(): Promise<boolean> {
        return false;
    }

    protected reassignChildIdSegments<T extends PeripheralBaseNode>(
        children: readonly T[],
        baseOf: (child: T) => string = (child) => child.name ?? '',
    ): void {
        const bases = children.map((child) => baseOf(child));
        const reserved = new Set(bases);
        const claimed = new Set<string>();
        for (let i = 0; i < children.length; i++) {
            const base = bases[i];
            let segment = base;
            for (let n = 2; claimed.has(segment) || (segment !== base && reserved.has(segment)); n++) {
                segment = `${base}${DUPLICATE_NAME_SEP}${n}`;
            }
            claimed.add(segment);
            children[i].idSegment = segment;
        }
    }

    protected findChildBySegment<T extends PeripheralBaseNode>(children: T[], segment: string): T | undefined {
        return children.find((c) => c.getIdSegment() === segment);
    }

    public getIdSegment(): string | undefined {
        return this.idSegment ?? this.name;
    }

    public getId(): string {
        if (this.parent) {
            return `${this.parent.getId()}${PERIPHERAL_ID_SEP}${this.getIdSegment()}`;
        }

        return this.name ?? this.session?.id ?? 'unknown';
    }

    public abstract performUpdate(args?: unknown): Promise<boolean>;
    public abstract updateData(context?: UpdateDataContext): Promise<boolean>;

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

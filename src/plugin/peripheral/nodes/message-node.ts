/********************************************************************************
 * Copyright (C) 2023 Marcel Ball, Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import * as vscode from 'vscode';
import { AddrRange } from '../../../addrranges';
import { NodeSetting } from '../../../common';
import { CDTTreeItem } from '../../../components/tree/types';
import { PeripheralBaseNodeImpl } from './base-node';

export class MessageNode extends PeripheralBaseNodeImpl {

    constructor(public message: string, public tooltip?: string | vscode.MarkdownString) {
        super();
    }

    public getId(): string {
        return 'message';
    }

    public getChildren(): PeripheralBaseNodeImpl[] | Promise<PeripheralBaseNodeImpl[]> {
        return [];
    }

    public getTreeItem(): vscode.TreeItem | Promise<vscode.TreeItem> {
        const ti = new vscode.TreeItem(this.getTitle(), vscode.TreeItemCollapsibleState.None);
        if (this.tooltip) { // A null crashes VSCode Tree renderer
            ti.tooltip = this.tooltip;
        }
        return ti;
    }

    public getCDTTreeItem(): CDTTreeItem {
        return CDTTreeItem.create({
            id: this.getId(),
            key: this.getId(),
            resource: undefined,
        });
    }

    public getTitle(): string {
        return this.message;
    }

    public getCopyValue(): string | undefined {
        return undefined;
    }

    public performUpdate(): Thenable<boolean> {
        return Promise.resolve(false);
    }

    public updateData(): Thenable<boolean> {
        return Promise.resolve(false);
    }

    public getPeripheral(): PeripheralBaseNodeImpl | undefined {
        return undefined;
    }

    public collectRanges(_ary: AddrRange[]): void {
        // Do nothing
    }

    public saveState(_path?: string): NodeSetting[] {
        return [];
    }

    public findByPath(_path: string[]): PeripheralBaseNodeImpl | undefined {
        return undefined;
    }
}

/********************************************************************************
 * Copyright (C) 2024 Marcel Ball, Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import * as vscode from 'vscode';
import { CDTTreeDataProvider } from '../../../../components/tree/integration/tree-data-provider';
import { CDTTreeWebviewViewProvider } from '../../../../components/tree/integration/webview';
import { CDTTreeItem, CDTTreeTableColumnDefinition, CDTTreeViewType } from '../../../../components/tree/types';
import { PeripheralBaseNode } from '../../nodes';
import { PeripheralDataTracker } from '../peripheral-data-tracker';

export class PeripheralCDTTreeDataProvider implements CDTTreeDataProvider<PeripheralBaseNode> {
    protected viewType: CDTTreeViewType = 'tree';

    protected onDidChangeTreeDataEvent = new vscode.EventEmitter<PeripheralBaseNode | undefined>();
    public readonly onDidChangeTreeData = this.onDidChangeTreeDataEvent.event;

    constructor(protected readonly dataTracker: PeripheralDataTracker, protected context: vscode.ExtensionContext) {
        this.dataTracker.onDidChange(() => {
            this.onDidChangeTreeDataEvent.fire(undefined);
        });
        this.dataTracker.onDidExpand(async () => {
            this.onDidChangeTreeDataEvent.fire(undefined);
        });
        this.dataTracker.onDidCollapse(async () => {
            this.onDidChangeTreeDataEvent.fire(undefined);
        });
    }

    public async activate(webview: CDTTreeWebviewViewProvider<PeripheralBaseNode>): Promise<void> {
        this.viewType = webview.type;

        this.context.subscriptions.push(
            webview.onDidClickNode(async (e) => {
                const node = this.getNodeByCDTTreeItem(e);
                await this.dataTracker.selectNode(node);
            }),
            webview.onDidExecuteCommand(async (e) => {
                const node = this.getNodeByCDTTreeItem(e.item);
                vscode.commands.executeCommand(e.commandId, node);
            }),
            webview.onDidToggleNode((e) => {
                const node = this.getNodeByCDTTreeItem(e);
                this.dataTracker.toggleNode(node);
            })
        );
    }

    public async getCDTTreeItem(element: PeripheralBaseNode): Promise<CDTTreeItem> {
        const item = await element.getCDTTreeItem();

        if (item.expanded) {
            const children = await this.getChildren(element);
            if (children) {
                item.children = await Promise.all(children.map(c => this.getCDTTreeItem(c)));
            }
        }

        return item;
    }

    public async getCDTTreeRoots(): Promise<CDTTreeItem[]> {
        const children = await this.getChildren() ?? [];

        return Promise.all(children.map(c => this.getCDTTreeItem(c)));
    }

    public getChildren(element?: PeripheralBaseNode): vscode.ProviderResult<PeripheralBaseNode[]> {
        return this.dataTracker.getChildren(element);
    }

    public async getSelectedItem(): Promise<CDTTreeItem | undefined> {
        const node = this.dataTracker.getSelectedNode();

        if (node) {
            return this.getCDTTreeItem(node);
        }

        return undefined;
    }

    public getColumnDefinitions(): CDTTreeTableColumnDefinition[] {
        return [{ field: 'title', expander: true }, { field: 'value' }];
    }

    protected findNodeByCDTTreeItem(item: CDTTreeItem): PeripheralBaseNode | undefined {
        return this.dataTracker.findNodeByPath(item.path);
    }

    protected getNodeByCDTTreeItem(item: CDTTreeItem): PeripheralBaseNode {
        const node = this.findNodeByCDTTreeItem(item);
        if (node === undefined) {
            throw new Error(`Node not found for ${JSON.stringify(item)}`);
        }

        return node;
    }

}


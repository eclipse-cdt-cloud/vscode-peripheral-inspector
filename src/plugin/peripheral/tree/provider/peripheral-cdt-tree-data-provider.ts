/********************************************************************************
 * Copyright (C) 2024 Marcel Ball, Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import * as vscode from 'vscode';
import { TreeNotification } from '../../../../common/notification';
import { PERIPHERAL_ID_SEP, PeripheralBaseNode } from '../../../../common/peripherals';
import { CDTTreeDataProvider } from '../../../../components/tree/integration/tree-data-provider';
import { CDTTreeWebviewViewProvider } from '../../../../components/tree/integration/webview';
import { CDTTreeItem, CDTTreeTableColumnDefinition, CDTTreeViewType } from '../../../../components/tree/types';
import { PeripheralBaseNodeImpl } from '../../nodes';
import { PeripheralDataTracker } from '../peripheral-data-tracker';

export class PeripheralCDTTreeDataProvider implements CDTTreeDataProvider<PeripheralBaseNodeImpl, PeripheralBaseNode> {
    protected viewType: CDTTreeViewType = 'tree';

    protected onDidChangeTreeDataEvent = new vscode.EventEmitter<TreeNotification<PeripheralBaseNodeImpl | PeripheralBaseNodeImpl[] | undefined>>();
    public readonly onDidChangeTreeData = this.onDidChangeTreeDataEvent.event;

    constructor(protected readonly dataTracker: PeripheralDataTracker, protected context: vscode.ExtensionContext) {
        this.dataTracker.onDidSelectionChange(() => {
            this.onDidChangeTreeDataEvent.fire({ data: undefined });
        });
        this.dataTracker.onDidChange(async () => {
            await this.getSerializedRoots();
            this.onDidChangeTreeDataEvent.fire({ data: undefined });
        });
        this.dataTracker.onDidPeripheralChange(async (event) => {
            await this.getSerializedData(event.data, true);
            this.onDidChangeTreeDataEvent.fire(event);
        });
        this.dataTracker.onDidExpand(async (event) => {
            await this.getSerializedData(event.data, true);
            this.onDidChangeTreeDataEvent.fire(event);
        });
        this.dataTracker.onDidCollapse(async (event) => {
            await this.getSerializedData(event.data, true);
            this.onDidChangeTreeDataEvent.fire(event);
        });
    }
    public async activate(webview: CDTTreeWebviewViewProvider<PeripheralBaseNodeImpl>): Promise<void> {
        this.viewType = webview.type;

        this.context.subscriptions.push(
            webview.onDidClickNode(async (event) => {
                const node = this.getNodeByCDTTreeItem(event.data);
                await this.dataTracker.selectNode(node);
            }),
            webview.onDidExecuteCommand(async (event) => {
                const node = this.getNodeByCDTTreeItem(event.data.item);
                vscode.commands.executeCommand(event.data.commandId, node, event.context);
            }),
            webview.onDidToggleNode((event) => {
                const node = this.getNodeByCDTTreeItem(event.data);
                this.dataTracker.toggleNode(node, true, event.context);
            })
        );
    }

    public async getCDTTreeItem(element: PeripheralBaseNodeImpl): Promise<CDTTreeItem> {
        const item = await element.getCDTTreeItem();

        const children = await this.getChildren(element);
        if (children && children?.length > 0) {
            item.children = await Promise.all(children.map(c => this.getCDTTreeItem(c)));
        }

        return item;
    }

    async getSerializedRoots(): Promise<PeripheralBaseNode[]> {
        const children = await this.getChildren() ?? [];

        return Promise.all(children.map(c => this.getSerializedData(c)));
    }

    cache = new Map<string, PeripheralBaseNode>();
    async getSerializedData(element: PeripheralBaseNodeImpl, refreshCache = false): Promise<PeripheralBaseNode> {
        // if (!refreshCache && this.cache.has(element.getId())) {
        //     return this.cache.get(element.getId())!;
        // }

        const item = await element.serialize();

        const children = await this.getChildren(element);
        if (children && children?.length > 0) {
            item.children = await Promise.all(children.map(c => this.getSerializedData(c, refreshCache)));
        }

        // this.cache.set(element.getId(), item);

        return item;
    }


    public async getCDTTreeRoots(): Promise<CDTTreeItem[]> {
        const children = await this.getChildren() ?? [];

        return Promise.all(children.map(c => this.getCDTTreeItem(c)));
    }

    public getChildren(element?: PeripheralBaseNodeImpl): vscode.ProviderResult<PeripheralBaseNodeImpl[]> {
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
        return [{ type: 'string', field: 'title' }, { type: 'string', field: 'value' }, { type: 'action', field: 'actions' }];
    }

    protected findNodeByCDTTreeItem(item: CDTTreeItem): PeripheralBaseNodeImpl | undefined {
        return this.dataTracker.findNodeByPath(item.id.split(PERIPHERAL_ID_SEP));
    }

    protected getNodeByCDTTreeItem(item: CDTTreeItem): PeripheralBaseNodeImpl {
        const node = this.findNodeByCDTTreeItem(item);
        if (node === undefined) {
            throw new Error(`Node not found for ${JSON.stringify(item)}`);
        }

        return node;
    }

}


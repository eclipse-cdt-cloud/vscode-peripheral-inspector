/********************************************************************************
 * Copyright (C) 2024 Marcel Ball, Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import * as vscode from 'vscode';
import { TreeNotification } from '../../../common/notification';
import { PERIPHERAL_ID_SEP, PeripheralBaseNodeDTO } from '../../../common/peripheral-dto';
import { CDTTreeDataProvider } from '../../../components/tree/integration/tree-data-provider';
import { CDTTreeWebviewViewProvider } from '../../../components/tree/integration/webview';
import { CDTTreeTableColumnDefinition } from '../../../components/tree/types';
import * as manifest from '../../../manifest';
import { PeripheralBaseNode } from '../nodes';
import { PeripheralDataTracker } from './peripheral-data-tracker';

export class PeripheralTreeDataProvider implements CDTTreeDataProvider<PeripheralBaseNode, PeripheralBaseNodeDTO> {
    public static viewName = `${manifest.PACKAGE_NAME}.svd`;

    protected onDidChangeTreeDataEvent = new vscode.EventEmitter<TreeNotification<PeripheralBaseNode | PeripheralBaseNode[] | undefined>>();
    readonly onDidChangeTreeData = this.onDidChangeTreeDataEvent.event;

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

    async activate(webview: CDTTreeWebviewViewProvider<PeripheralBaseNode>): Promise<void> {
        this.context.subscriptions.push(
            webview.onDidClickNode(async (event) => {
                const node = this.getNodeByItemId(event.data);
                await this.dataTracker.selectNode(node);
            }),
            webview.onDidExecuteCommand(async (event) => {
                const node = this.getNodeByItemId(event.data.itemId);
                vscode.commands.executeCommand(event.data.commandId, node, event.data.value, event.context);
            }),
            webview.onDidToggleNode((event) => {
                const node = this.getNodeByItemId(event.data);
                this.dataTracker.toggleNode(node, true, event.context);
            })
        );
    }

    getColumnDefinitions(): CDTTreeTableColumnDefinition[] {
        return [
            { type: 'string', field: 'title' },
            { type: 'string', field: 'value' },
            { type: 'action', field: 'actions' }];
    }

    async getSerializedRoots(): Promise<PeripheralBaseNodeDTO[]> {
        const children = await this.getChildren() ?? [];

        return Promise.all(children.map(c => this.getSerializedData(c)));
    }

    async getSerializedData(element: PeripheralBaseNode, refreshCache = false): Promise<PeripheralBaseNodeDTO> {
        const item = await element.serialize();

        const children = await this.getChildren(element);
        if (children && children?.length > 0) {
            item.children = await Promise.all(children.map(c => this.getSerializedData(c, refreshCache)));
        }

        return item;
    }

    getChildren(element?: PeripheralBaseNode): vscode.ProviderResult<PeripheralBaseNode[]> {
        return this.dataTracker.getChildren(element);
    }

    protected findNodeByItemId(itemId: string): PeripheralBaseNode | undefined {
        return this.dataTracker.findNodeByPath(itemId.split(PERIPHERAL_ID_SEP));
    }

    protected getNodeByItemId(itemId: string): PeripheralBaseNode {
        const node = this.findNodeByItemId(itemId);
        if (node === undefined) {
            throw new Error(`Node not found for ${JSON.stringify(itemId)}`);
        }

        return node;
    }

}


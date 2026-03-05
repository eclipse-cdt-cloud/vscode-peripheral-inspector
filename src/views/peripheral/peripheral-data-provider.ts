/********************************************************************************
 * Copyright (C) 2024 Marcel Ball, Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import { CDTTreeTableColumnDefinition } from '@eclipse-cdt-cloud/vscode-ui-components';
import { CDTTreeDataProvider, CDTTreeWebviewViewProvider } from '@eclipse-cdt-cloud/vscode-ui-components/lib/tree/vscode';
import * as vscode from 'vscode';
import { TreeNotification, TreeTerminatedEvent } from '../../common/notification';
import { PERIPHERAL_ID_SEP, PeripheralBaseNodeDTO } from '../../common/peripheral-dto';
import * as manifest from '../../manifest';
import { PeripheralBaseNode, PeripheralRegisterNode } from '../../model/peripheral/nodes';
import { PeripheralDataTracker } from '../../model/peripheral/tree/peripheral-data-tracker';

export class PeripheralTreeDataProvider implements CDTTreeDataProvider<PeripheralBaseNode, PeripheralBaseNodeDTO> {
    public static viewName = `${manifest.PACKAGE_NAME}.svd`;

    protected onDidTerminateEvent = new vscode.EventEmitter<TreeTerminatedEvent<PeripheralBaseNode>>();
    readonly onDidTerminate = this.onDidTerminateEvent.event;
    protected onDidChangeTreeDataEvent = new vscode.EventEmitter<TreeNotification<PeripheralBaseNode | PeripheralBaseNode[] | undefined>>();
    readonly onDidChangeTreeData = this.onDidChangeTreeDataEvent.event;

    private includeIds?: Set<string>;
    private defaultExpandedIds?: Set<string>;
    private searchSequence = 0;

    constructor(protected readonly dataTracker: PeripheralDataTracker, protected context: vscode.ExtensionContext) {
        this.dataTracker.onDidTerminate((event) => {
            this.onDidTerminateEvent.fire(event);
        });
        this.dataTracker.onDidSelectionChange((event) => {
            this.onDidChangeTreeDataEvent.fire(event);
        });
        this.dataTracker.onDidChange((changes) => {
            this.onDidChangeTreeDataEvent.fire({ data: changes });
        });
        this.dataTracker.onDidPeripheralChange((event) => {
            this.onDidChangeTreeDataEvent.fire(event);
        });
        this.dataTracker.onDidExpand((event) => {
            this.onDidChangeTreeDataEvent.fire(event);
        });
        this.dataTracker.onDidCollapse((event) => {
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
                vscode.commands.executeCommand(event.data.commandId, node, event.data.value);
            }),
            webview.onDidToggleNode((event) => {
                const node = this.getNodeByItemId(event.data);
                this.dataTracker.toggleNode(node, true);
            }),
            webview.onDidSearchChanged((event) => {
                const text = event.data?.text ?? '';
                this.handleSearchText(text);
            })
        );
    }

    getColumnDefinitions(): CDTTreeTableColumnDefinition[] {
        return [
            { type: 'string', field: 'title', resizable: true },
            { type: 'string', field: 'value' },
            { type: 'action', field: 'actions' }];
    }

    async getSerializedRoots(): Promise<PeripheralBaseNodeDTO[]> {
        const children = await this.getChildren() ?? [];

        return Promise.all(children.map(c => this.getSerializedData(c)));
    }

    async getSerializedData(element: PeripheralBaseNode): Promise<PeripheralBaseNodeDTO> {
        const item = await element.serialize();

        // ===== SEARCH MODE =====
        if (this.includeIds) {
            const includeIds = this.includeIds;

            if (!includeIds.has(element.getId())) {
                return item;
            }

            const children = (await this.getChildren(element)) ?? [];

            if (element instanceof PeripheralRegisterNode) {
                item.expanded =
                    element.expanded ||
                    this.defaultExpandedIds?.has(element.getId()) === true;

                if (children.length > 0) {
                    item.children = await Promise.all(
                        children.map(child => this.getSerializedData(child))
                    );
                }

                return item;
            }

            const visibleChildren = children.filter(child =>
                includeIds.has(child.getId())
            );

            if (visibleChildren.length > 0) {
                item.expanded =
                    element.expanded ||
                    this.defaultExpandedIds?.has(element.getId()) === true;

                item.children = await Promise.all(
                    visibleChildren.map(child => this.getSerializedData(child))
                );
            }

            return item;
        }

        // ===== NORMAL LAZY MODE =====

        if (element instanceof PeripheralRegisterNode) {
            const children = (await this.getChildren(element)) ?? [];

            if (children.length > 0) {
                item.children = await Promise.all(
                    children.map(child => this.getSerializedData(child))
                );
            }

            return item;
        }

        if (!element.expanded) {
            return item;
        }

        const children = (await this.getChildren(element)) ?? [];

        if (children.length > 0) {
            item.children = await Promise.all(
                children.map(child => this.getSerializedData(child))
            );
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

    private handleSearchText(text: string): void {
        const sequence = ++this.searchSequence;
        const normalized = (text ?? '').trim();

        if (!normalized) {
            this.searchSequence++;
            this.includeIds = undefined;
            this.defaultExpandedIds = undefined;
            this.onDidChangeTreeDataEvent.fire({ data: undefined });
            return;
        }

        void (async () => {
            const matches = await this.dataTracker.findNodesByText(normalized);

            if (sequence !== this.searchSequence) {
                return; // Ignore stale results
            }

            const include = new Set<string>();
            const expand = new Set<string>();

            for (const node of matches) {
                include.add(node.getId());

                let parent = node.getParent?.() as PeripheralBaseNode | undefined;
                while (parent) {
                    include.add(parent.getId());
                    expand.add(parent.getId());
                    parent = parent.getParent?.() as PeripheralBaseNode | undefined;
                }
            }

            this.includeIds = include;
            this.defaultExpandedIds = expand;

            this.onDidChangeTreeDataEvent.fire({ data: undefined });
        })();
    }

}


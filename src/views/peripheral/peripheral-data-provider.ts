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

type SearchState = {
    includeIds: Set<string>;
    directMatchIds: Set<string>;
    defaultExpandedIds: Set<string>;
};

export class PeripheralTreeDataProvider implements CDTTreeDataProvider<PeripheralBaseNode, PeripheralBaseNodeDTO> {
    public static viewName = `${manifest.PACKAGE_NAME}.svd`;

    protected onDidTerminateEvent = new vscode.EventEmitter<TreeTerminatedEvent<PeripheralBaseNode>>();
    readonly onDidTerminate = this.onDidTerminateEvent.event;
    protected onDidChangeTreeDataEvent = new vscode.EventEmitter<TreeNotification<PeripheralBaseNode | PeripheralBaseNode[] | undefined>>();
    readonly onDidChangeTreeData = this.onDidChangeTreeDataEvent.event;

    private searchState?: SearchState;
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
            webview.onDidSearchChange((event) => {
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

        if (!this.searchState) {
            return this.serializeLazyNode(element, item);
        }

        return this.serializeSearchNode(element, item);
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
        const normalized = text.trim();

        if (!normalized) {
            this.clearSearchState();
            return;
        }

        void this.updateSearchState(normalized, sequence);
    }

    private clearSearchState(): void {
        this.searchSequence++;
        this.searchState = undefined;
        this.onDidChangeTreeDataEvent.fire({ data: undefined });
    }

    private async updateSearchState(query: string, sequence: number): Promise<void> {
        const matches = await this.dataTracker.findNodesByText(query);

        if (sequence !== this.searchSequence) {
            return;
        }

        this.searchState = this.buildSearchState(matches);
        this.onDidChangeTreeDataEvent.fire({ data: undefined });
    }

    private buildSearchState(matches: PeripheralBaseNode[]): SearchState {
        const includeIds = new Set<string>();
        const directMatchIds = new Set<string>();
        const defaultExpandedIds = new Set<string>();

        for (const node of matches) {
            const nodeId = node.getId();
            directMatchIds.add(nodeId);
            includeIds.add(nodeId);

            let parent = node.getParent?.() as PeripheralBaseNode | undefined;
            while (parent) {
                includeIds.add(parent.getId());
                defaultExpandedIds.add(parent.getId());
                parent = parent.getParent?.() as PeripheralBaseNode | undefined;
            }
        }

        return { includeIds, directMatchIds, defaultExpandedIds };
    }

    private async serializeSearchNode(
        element: PeripheralBaseNode,
        item: PeripheralBaseNodeDTO
    ): Promise<PeripheralBaseNodeDTO> {
        const searchState = this.searchState;
        if (!searchState) {
            return this.serializeLazyNode(element, item);
        }

        const isIncluded = searchState.includeIds.has(element.getId());
        const isDirectMatch = searchState.directMatchIds.has(element.getId());
        const isDescendantOfDirectMatch = this.isDescendantOfDirectMatch(element, searchState.directMatchIds);

        if (!isIncluded && !isDescendantOfDirectMatch) {
            return item;
        }

        if (isDirectMatch || isDescendantOfDirectMatch) {
            return this.serializeLazyNode(element, item);
        }

        return this.serializeAncestorNode(element, item, searchState);
    }

    private isDescendantOfDirectMatch(
        node: PeripheralBaseNode,
        directMatchIds: Set<string>
    ): boolean {
        let parent = node.getParent?.() as PeripheralBaseNode | undefined;

        while (parent) {
            if (directMatchIds.has(parent.getId())) {
                return true;
            }

            parent = parent.getParent?.() as PeripheralBaseNode | undefined;
        }

        return false;
    }

    private async serializeAncestorNode(
        element: PeripheralBaseNode,
        item: PeripheralBaseNodeDTO,
        searchState: SearchState
    ): Promise<PeripheralBaseNodeDTO> {
        const children = (await this.getChildren(element)) ?? [];

        item.expanded =
            element.expanded ||
            searchState.defaultExpandedIds.has(element.getId());

        const visibleChildren = children.filter(child => searchState.includeIds.has(child.getId()));

        if (visibleChildren.length > 0) {
            item.children = await Promise.all(
                visibleChildren.map(child => this.getSerializedData(child))
            );
        }

        return item;
    }

    private async serializeLazyNode(
        element: PeripheralBaseNode,
        item: PeripheralBaseNodeDTO
    ): Promise<PeripheralBaseNodeDTO> {
        if (element instanceof PeripheralRegisterNode) {
            return this.serializeAllChildren(element, item);
        }

        if (!element.expanded) {
            return item;
        }

        return this.serializeAllChildren(element, item);
    }

    private async serializeAllChildren(
        element: PeripheralBaseNode,
        item: PeripheralBaseNodeDTO
    ): Promise<PeripheralBaseNodeDTO> {
        const children = (await this.getChildren(element)) ?? [];

        if (children.length > 0) {
            item.children = await Promise.all(
                children.map(child => this.getSerializedData(child))
            );
        }

        return item;
    }

}


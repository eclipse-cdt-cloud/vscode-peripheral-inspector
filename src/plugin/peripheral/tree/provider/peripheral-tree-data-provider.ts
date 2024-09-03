/********************************************************************************
 * Copyright (C) 2024 Marcel Ball, Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import * as vscode from 'vscode';
import * as manifest from '../../../../manifest';
import { PeripheralBaseNode } from '../../nodes';
import { PeripheralDataTracker } from '../peripheral-data-tracker';

export class PeripheralTreeDataProvider implements vscode.TreeDataProvider<PeripheralBaseNode> {
    public static viewName = `${manifest.PACKAGE_NAME}.svd`;

    protected onDidChangeTreeDataEvent = new vscode.EventEmitter<PeripheralBaseNode | undefined>();
    public readonly onDidChangeTreeData = this.onDidChangeTreeDataEvent.event;

    constructor(protected readonly dataTracker: PeripheralDataTracker, protected context: vscode.ExtensionContext) {
        this.dataTracker.onDidChange(() => {
            this.onDidChangeTreeDataEvent.fire(undefined);
        });
    }

    public async activate(): Promise<void> {
        const opts: vscode.TreeViewOptions<PeripheralBaseNode> = {
            treeDataProvider: this,
            showCollapseAll: true
        };
        const view = vscode.window.createTreeView(PeripheralTreeDataProvider.viewName, opts);
        this.context.subscriptions.push(
            view,
            view.onDidExpandElement((e) => {
                this.dataTracker.expandNode(e.element);
            }),
            view.onDidCollapseElement((e) => {
                this.dataTracker.collapseNode(e.element);
            })
        );
    }

    public getTreeItem(element: PeripheralBaseNode): vscode.TreeItem | Promise<vscode.TreeItem> {
        return element?.getTreeItem();
    }


    public getChildren(element?: PeripheralBaseNode): vscode.ProviderResult<PeripheralBaseNode[]> {
        return this.dataTracker.getChildren(element);
    }
}


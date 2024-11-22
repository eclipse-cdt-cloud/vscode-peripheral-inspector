/********************************************************************************
 * Copyright (C) 2024 Marcel Ball, Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import * as vscode from 'vscode';
import * as manifest from '../../../../manifest';
import { PeripheralBaseNodeImpl } from '../../nodes';
import { PeripheralDataTracker } from '../peripheral-data-tracker';

export class PeripheralTreeDataProvider implements vscode.TreeDataProvider<PeripheralBaseNodeImpl> {
    public static viewName = `${manifest.PACKAGE_NAME}.svd`;

    protected onDidChangeTreeDataEvent = new vscode.EventEmitter<PeripheralBaseNodeImpl | undefined>();
    public readonly onDidChangeTreeData = this.onDidChangeTreeDataEvent.event;

    constructor(protected readonly dataTracker: PeripheralDataTracker, protected context: vscode.ExtensionContext) {
        this.dataTracker.onDidPeripheralChange(() => {
            this.onDidChangeTreeDataEvent.fire(undefined);
        });
    }

    public async activate(): Promise<void> {
        const opts: vscode.TreeViewOptions<PeripheralBaseNodeImpl> = {
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

    public getTreeItem(element: PeripheralBaseNodeImpl): vscode.TreeItem | Promise<vscode.TreeItem> {
        return element?.getTreeItem();
    }


    public getChildren(element?: PeripheralBaseNodeImpl): vscode.ProviderResult<PeripheralBaseNodeImpl[]> {
        return this.dataTracker.getChildren(element);
    }
}


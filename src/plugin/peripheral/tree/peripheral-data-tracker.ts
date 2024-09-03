/********************************************************************************
 * Copyright (C) 2024 Marcel Ball, Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import * as vscode from 'vscode';
import { DebugTracker } from '../../../debug-tracker';
import * as manifest from '../../../manifest';
import { PeripheralInspectorAPI } from '../../../peripheral-inspector-api';
import { SvdResolver } from '../../../svd-resolver';
import { MessageNode, PeripheralBaseNode, PeripheralRegisterNode } from '../nodes';
import { PeripheralTreeForSession } from './peripheral-session-tree';
import { PeripheralTreeDataProvider } from './provider/peripheral-tree-data-provider';

export class PeripheralDataTracker {
    protected onDidChangeEvent = new vscode.EventEmitter<PeripheralBaseNode | void>();
    public readonly onDidChange = this.onDidChangeEvent.event;
    protected onDidSelectionChangeEvent = new vscode.EventEmitter<PeripheralBaseNode | undefined>();
    public readonly onDidSelectionChange = this.onDidSelectionChangeEvent.event;
    protected onDidExpandEvent = new vscode.EventEmitter<PeripheralBaseNode>();
    public readonly onDidExpand = this.onDidExpandEvent.event;
    protected onDidCollapseEvent = new vscode.EventEmitter<PeripheralBaseNode>();
    public readonly onDidCollapse = this.onDidCollapseEvent.event;

    protected sessionPeripherals = new Map<string, PeripheralTreeForSession>();
    protected selectedNode?: PeripheralBaseNode;
    protected oldState = new Map<string, vscode.TreeItemCollapsibleState>();

    getSessionPeripherals(): Map<string, PeripheralTreeForSession> {
        return this.sessionPeripherals;
    }

    constructor(tracker: DebugTracker, protected resolver: SvdResolver, protected api: PeripheralInspectorAPI, protected context: vscode.ExtensionContext) {
        tracker.onWillStartSession(session => this.onDebugSessionStarted(session));
        tracker.onWillStopSession(session => this.onDebugSessionTerminated(session));
        tracker.onDidStopDebug(session => this.onDebugStopped(session));
    }

    public async selectNode(node?: PeripheralBaseNode): Promise<void> {
        this.selectedNode = node;
        const children = await node?.getChildren();
        if (node && children && children.length > 0) {
            this.toggleNode(node);
        } else {
            this.onDidSelectionChangeEvent.fire(node);
        }
    }

    public getSelectedNode(): PeripheralBaseNode | undefined {
        return this.selectedNode;
    }

    public getChildren(element?: PeripheralBaseNode): PeripheralBaseNode[] | Promise<PeripheralBaseNode[]> {
        const values = Array.from(this.sessionPeripherals.values());
        if (element) {
            return element.getChildren();
        } else if (values.length === 0) {
            return [new MessageNode('SVD: No active debug sessions or no SVD files specified')];
        } else if (values.length === 1) {
            return values[0].getChildren();     // Don't do root nodes at top-level if there is only one root
        } else {
            return values;
        }
    }

    public togglePin(node: PeripheralBaseNode): void {
        const session = vscode.debug.activeDebugSession;
        if (session) {
            const peripheralTree = this.sessionPeripherals.get(session.id);
            if (peripheralTree) {
                peripheralTree.togglePinPeripheral(node);
                this.refresh();
            }
        }
    }

    public expandNode(node: PeripheralBaseNode, emit = true): void {
        node.expanded = true;
        const isReg = node instanceof PeripheralRegisterNode;
        if (!isReg) {
            // If we are at a register level, parent already expanded, no update/refresh needed
            const p = node.getPeripheral();
            if (p) {
                p.updateData();
            }
        }

        if (emit) {
            this.onDidExpandEvent.fire(node);
        }
    }

    public collapseNode(node: PeripheralBaseNode, emit = true): void {
        node.expanded = false;
        if (emit) {
            this.onDidCollapseEvent.fire(node);
        }
    }

    public async collapseAll(): Promise<void> {
        for (const tree of this.sessionPeripherals.values()) {
            const children = await tree.getChildren();
            children.forEach(c => this.collapseNode(c, false));
        }
        this.refresh();
    }

    public toggleNode(node: PeripheralBaseNode, emit = true): void {
        if (node.expanded) {
            this.collapseNode(node, emit);
        } else {
            this.expandNode(node, emit);
        }
    }

    public findNodeByPath(path: string[]): PeripheralBaseNode | undefined {
        const trees = this.sessionPeripherals.values();
        for (const tree of trees) {
            const node = tree.findNodeByPath(path.join('.'));
            if (node) {
                return node;
            }
        }
    }

    public getNodeByPath(path: string[]): PeripheralBaseNode {
        const node = this.findNodeByPath(path);
        if (node === undefined) {
            throw new Error(`No node found with path ${path}`);
        }

        return node;
    }


    public async updateData(): Promise<void> {
        const trees = this.sessionPeripherals.values();
        for (const tree of trees) {
            await tree.updateData();
        }
        this.refresh();
    }

    public refresh(): void {
        this.onDidChangeEvent.fire(undefined);
    }

    protected async onDebugSessionStarted(session: vscode.DebugSession): Promise<void> {
        const wsFolderPath = session.workspaceFolder ? session.workspaceFolder.uri : vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0].uri;
        const svdPath = await this.resolver.resolve(session, wsFolderPath);

        if (!svdPath) {
            return;
        }

        if (this.sessionPeripherals.get(session.id)) {
            this.onDidChangeEvent.fire(undefined);
            vscode.debug.activeDebugConsole.appendLine(`Internal Error: Session ${session.name} id=${session.id} already in the tree view?`);
            return;
        }

        let state = this.oldState.get(session.name);
        if (state === undefined) {
            state = this.sessionPeripherals.size === 0 ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed;
        }
        const peripheralTree = new PeripheralTreeForSession(session, this.api, state, () => {
            this.onDidChangeEvent.fire(undefined);
        });

        this.sessionPeripherals.set(session.id, peripheralTree);
        let thresh = session.configuration[manifest.CONFIG_ADDRGAP];

        if (!thresh) {
            thresh = vscode.workspace.getConfiguration(manifest.PACKAGE_NAME).get<number>(manifest.CONFIG_ADDRGAP) || manifest.DEFAULT_ADDRGAP;
        }

        try {
            await peripheralTree.sessionStarted(this.context, svdPath, thresh);     // Should never reject
        } catch (e) {
            vscode.debug.activeDebugConsole.appendLine(`Internal Error: Unexpected rejection of promise ${e}`);
        } finally {
            this.onDidChangeEvent.fire(undefined);
        }

        vscode.commands.executeCommand('setContext', `${PeripheralTreeDataProvider.viewName}.hasData`, this.sessionPeripherals.size > 0);
    }

    protected onDebugSessionTerminated(session: vscode.DebugSession): void {
        if (!this.sessionPeripherals.get(session.id)) {
            return;
        }
        const regs = this.sessionPeripherals.get(session.id);

        if (regs && regs.myTreeItem.collapsibleState) {
            this.oldState.set(session.name, regs.myTreeItem.collapsibleState);
            this.sessionPeripherals.delete(session.id);
            regs.sessionTerminated(this.context);
            this.onDidChangeEvent.fire(undefined);
        }

        vscode.commands.executeCommand('setContext', `${PeripheralTreeDataProvider.viewName}.hasData`, this.sessionPeripherals.size > 0);
    }

    protected onDebugStopped(session: vscode.DebugSession): void {
        if (!this.sessionPeripherals.get(session.id)) {
            return;
        }

        // We are stopped for many reasons very briefly where we cannot even execute any queries
        // reliably and get errors. Programs stop briefly to set breakpoints, during startup/reset/etc.
        // Also give VSCode some time to finish it's updates (Variables, Stacktraces, etc.)
        setTimeout(() => {
            const peripheralTree = this.sessionPeripherals.get(session.id);
            if (peripheralTree) {     // We are called even before the session has started, as part of reset
                peripheralTree.updateData();
            }
        }, 100);
    }
}

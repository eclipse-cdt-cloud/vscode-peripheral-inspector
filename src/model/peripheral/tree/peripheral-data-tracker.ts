/********************************************************************************
 * Copyright (C) 2024 Marcel Ball, Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import * as vscode from 'vscode';
import { DebugTracker } from '../../../debug-tracker';
import { PeripheralInspectorAPI } from '../../../peripheral-inspector-api';
import { SvdResolver } from '../../../svd-resolver';
import {
    MessageNode,
    PeripheralBaseNode,
    PeripheralClusterNode,
    PeripheralFieldNode,
    PeripheralNode,
    PeripheralRegisterNode,
} from '../nodes';
import { PeripheralTreeForSession } from './peripheral-session-tree';
import { TreeNotification, TreeTerminatedEvent } from '../../../common/notification';
import { PeripheralTreeDataProvider } from '../../../views/peripheral/peripheral-data-provider';
import * as xmlWriter from 'xmlbuilder2';
import { XMLBuilder } from 'xmlbuilder2/lib/interfaces';
import { hexFormat } from '../../../utils';
import { PeripheralConfigurationProvider } from './peripheral-configuration-provider';

export class PeripheralDataTracker {
    protected onDidTerminateEvent = new vscode.EventEmitter<TreeTerminatedEvent<PeripheralTreeForSession>>();
    public readonly onDidTerminate = this.onDidTerminateEvent.event;
    protected onDidChangeEvent = new vscode.EventEmitter<PeripheralBaseNode[] | undefined>();
    public readonly onDidChange = this.onDidChangeEvent.event;
    protected onDidPeripheralChangeEvent = new vscode.EventEmitter<TreeNotification<PeripheralBaseNode>>();
    public readonly onDidPeripheralChange = this.onDidPeripheralChangeEvent.event;
    protected onDidSelectionChangeEvent = new vscode.EventEmitter<TreeNotification<PeripheralBaseNode | undefined>>();
    public readonly onDidSelectionChange = this.onDidSelectionChangeEvent.event;
    protected onDidExpandEvent = new vscode.EventEmitter<TreeNotification<PeripheralBaseNode>>();
    public readonly onDidExpand = this.onDidExpandEvent.event;
    protected onDidCollapseEvent = new vscode.EventEmitter<TreeNotification<PeripheralBaseNode>>();
    public readonly onDidCollapse = this.onDidCollapseEvent.event;

    protected sessionPeripherals = new Map<string, PeripheralTreeForSession>();
    protected selectedNode?: PeripheralBaseNode;
    protected oldState = new Map<string, boolean>();

    getSessionPeripherals(): Map<string, PeripheralTreeForSession> {
        return this.sessionPeripherals;
    }

    constructor(tracker: DebugTracker, protected resolver: SvdResolver, protected api: PeripheralInspectorAPI, protected config: PeripheralConfigurationProvider, protected context: vscode.ExtensionContext) {
        tracker.onWillStartSession(session => this.onDebugSessionStarted(session));
        tracker.onWillStopSession(session => this.onDebugSessionTerminated(session));
        tracker.onDidStopDebug(session => this.onDebugStopped(session));
        tracker.onDidContinueDebug(session => this.onDebugContinued(session));
        this.init();
    }

    private init(): void {
        this.config.onDidChangeIgnorePeripherals(() => {
            const sessions = Array.from(this.sessionPeripherals.values());
            if (sessions.length === 0) {
                return;
            }

            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Reloading peripherals',
                cancellable: false
            }, () => {
                return Promise.all(sessions.map(session => session.reloadIgnoredPeripherals()));
            });
        });
    }

    public async selectNode(node?: PeripheralBaseNode): Promise<void> {
        this.selectedNode = node;
        const children = await node?.getChildren();
        if (node && children && children.length > 0) {
            this.toggleNode(node);
        } else {
            this.onDidSelectionChangeEvent.fire({ data: node });
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

    public togglePin(
        node: PeripheralBaseNode): void {
        const session = vscode.debug.activeDebugSession;
        if (session) {
            const peripheralTree = this.sessionPeripherals.get(session.id);
            if (peripheralTree) {
                peripheralTree.togglePinPeripheral(node);
                this.onDidPeripheralChangeEvent.fire({ data: node });
            }
        }
    }

    private async writeModuleToXml(
        node: PeripheralBaseNode,
        xmlBuilder: XMLBuilder,
    ): Promise<void> {
        const item = await node.serialize();
        if (node instanceof PeripheralNode || node instanceof PeripheralClusterNode) {
            const moduleElement = xmlBuilder.ele('module');
            moduleElement.att('name', item.name);
            moduleElement.att('address', `${hexFormat(node.getAddress(0))}`);

            const childNodes = await this.getChildren(node);
            await Promise.all(
                childNodes.map((c: PeripheralBaseNode) =>
                    this.writeModuleToXml(c, moduleElement),
                ),
            );
        } else if (node instanceof PeripheralRegisterNode) {
            await this.writeRegisterToXml(node, xmlBuilder);
        }
    }

    private async writeRegisterToXml(
        node: PeripheralRegisterNode,
        parentElement: XMLBuilder,
    ): Promise<void> {
        const item = await node.serialize();
        const registerElement = parentElement.ele('register');
        registerElement.att('name', item.name);
        registerElement.att('address', `${hexFormat(item.address)}`);
        registerElement.att('size', item.size.toString());
        registerElement.att('value', `${hexFormat(item.currentValue)}`);

        const childNodes = await this.getChildren(node);
        await Promise.all(
            childNodes.map((c: PeripheralBaseNode) => {
                if (c instanceof PeripheralFieldNode) {
                    return this.writeFieldToXml(c, registerElement);
                }
                return this.writeRegisterToXml(
                    c as PeripheralRegisterNode,
                    registerElement,
                );
            }),
        );
    }

    private async writeFieldToXml(
        node: PeripheralFieldNode,
        parentElement: XMLBuilder,
    ): Promise<void> {
        const item = await node.serialize();
        const rangestart = item.offset;
        const rangeend = item.offset + item.width - 1;

        const fieldElement = parentElement.ele('bitfield');
        fieldElement.att('name', item.name);
        fieldElement.att('bitrange', `[${rangeend}:${rangestart}]`);
        fieldElement.att('value', `${hexFormat(item.currentValue)}`);
    }

    public async exportNodeToXml(
        node: PeripheralBaseNode,
        filePath: vscode.Uri,
    ): Promise<void> {
        const xmlBuilder = xmlWriter
            .create({ version: '1.0', encoding: 'UTF-8' })
            .ele('moduletable');
        await this.writeModuleToXml(node, xmlBuilder);

        const xmlContent = this.finalizeXml(xmlBuilder);
        await this.writeToFile(filePath, xmlContent);
    }

    public async exportAllNodesToXml(filePath: vscode.Uri): Promise<void> {
        const xmlBuilder = xmlWriter
            .create({ version: '1.0', encoding: 'UTF-8' })
            .ele('moduletable');
        const children = (await this.getChildren()) ?? [];

        await Promise.all(
            children.map((c) => this.writeModuleToXml(c, xmlBuilder)),
        );

        const xmlContent = this.finalizeXml(xmlBuilder);
        await this.writeToFile(filePath, xmlContent);
    }

    private finalizeXml(xmlBuilder: XMLBuilder): Uint8Array {
        const xmlString = xmlBuilder.end({ prettyPrint: true, allowEmptyTags: true });
        return new TextEncoder().encode(xmlString);
    }

    private async writeToFile(filePath: vscode.Uri, content: Uint8Array): Promise<void> {
        await vscode.workspace.fs.writeFile(filePath, content);
        this.fireOnDidChange();
    }

    public async expandNode(
        node: PeripheralBaseNode,
        emit = true): Promise<void> {
        node.expanded = true;


        if (!(node instanceof PeripheralTreeForSession) && !(node instanceof PeripheralRegisterNode)) {
            // If we are at a register level, parent already expanded, no update/refresh needed
            const peripheral = node.getPeripheral();
            if (peripheral) {
                await peripheral.updateData();
            }
        }

        if (emit) {
            this.onDidExpandEvent.fire({ data: node });
        }
    }

    public collapseNode(
        node: PeripheralBaseNode,
        emit = true): void {
        node.expanded = false;
        if (emit) {
            this.onDidCollapseEvent.fire({ data: node });
        }
    }

    public async collapseAll(): Promise<void> {
        for (const tree of this.sessionPeripherals.values()) {
            const children = await tree.getChildren();
            children.forEach(c => this.collapseNode(c, false));
        }
        this.fireOnDidChange();
    }

    public toggleNode(
        node: PeripheralBaseNode,
        emit = true): void {
        if (node.expanded) {
            this.collapseNode(node, emit);
        } else {
            this.expandNode(node, emit);
        }
    }

    public findNodeByPath(path: string[]): PeripheralBaseNode | undefined {
        const trees = Array.from(this.sessionPeripherals.values());
        const tree = trees.find(t => t.id === path[0]);
        if (tree) {
            if (path.length === 1) {
                return tree;
            }

            return tree.findByPath(path.slice(1));
        }
    }

    public getNodeByPath(path: string[]): PeripheralBaseNode {
        const node = this.findNodeByPath(path);
        if (node === undefined) {
            throw new Error(`No node found with path ${path}`);
        }
        return node;
    }

    public findSessionByPath(path: string[]): vscode.DebugSession | undefined {
        return this.sessionPeripherals.get(path[0])?.session;
    }

    public getSessionByPath(path: string[]): vscode.DebugSession {
        const session = this.findSessionByPath(path);
        if (session === undefined) {
            throw new Error(`No node found with path ${path}`);
        }
        return session;
    }

    public async updateData(): Promise<void> {
        const trees = this.sessionPeripherals.values();
        for (const tree of trees) {
            // The tree will trigger a refresh on it's own
            await tree.updateData();
        }
    }

    public fireOnDidChange(changes?: PeripheralBaseNode[]): void {
        this.onDidChangeEvent.fire(changes);
    }

    protected async onDebugSessionStarted(session: vscode.DebugSession): Promise<void> {
        const wsFolderPath = session.workspaceFolder ? session.workspaceFolder.uri : vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0].uri;
        const svdPath = await this.resolver.resolve(session, wsFolderPath);

        if (!svdPath) {
            return;
        }

        if (this.sessionPeripherals.get(session.id)) {
            this.fireOnDidChange();
            vscode.debug.activeDebugConsole.appendLine(`Internal Error: Session ${session.name} id=${session.id} already in the tree view?`);
            return;
        }

        let expanded = this.oldState.get(session.name);
        if (expanded === undefined) {
            expanded = this.sessionPeripherals.size === 0 ? true : false;
        }
        const peripheralTree = new PeripheralTreeForSession(session, this.api, this.config, expanded, (changes) => {
            this.fireOnDidChange(changes);
        });

        this.sessionPeripherals.set(session.id, peripheralTree);
        const thresh = this.config.addressGapThreshold(session);

        try {
            await peripheralTree.sessionStarted(this.context, svdPath, thresh);     // Should never reject
        } catch (e) {
            vscode.debug.activeDebugConsole.appendLine(`Internal Error: Unexpected rejection of promise ${e}`);
        } finally {
            this.fireOnDidChange();
        }

        this.refreshContext();
    }

    protected onDebugSessionTerminated(session: string | vscode.DebugSession): void {
        const isSessionId = typeof session === 'string';
        const sessionId = isSessionId ? session : session.id;
        if (!this.sessionPeripherals.get(sessionId)) {
            return;
        }
        const regs = this.sessionPeripherals.get(sessionId);

        if (regs) {
            const sessionName = isSessionId ? regs.name : session.name;
            this.oldState.set(sessionName, regs.expanded);
            this.sessionPeripherals.delete(sessionId);
            regs.sessionTerminated(this.context);
            this.onDidTerminateEvent.fire({
                data: regs,
                remaining: this.sessionPeripherals.size
            });
        }

        this.refreshContext();
    }

    protected onDebugStopped(session: vscode.DebugSession): void {
        this.sessionPeripherals.get(session.id)?.debugStopped(this.context);
    }

    protected onDebugContinued(session: vscode.DebugSession): void {
        this.sessionPeripherals.get(session.id)?.debugContinued(this.context);
    }

    protected refreshContext(): void {
        vscode.commands.executeCommand('setContext', `${PeripheralTreeDataProvider.viewName}.hasData`, this.sessionPeripherals.size > 0);
    }
}

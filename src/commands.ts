/********************************************************************************
 * Copyright (C) 2023 Marcel Ball, Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import * as vscode from 'vscode';
import { NumberFormat } from './common/format';
import { TreeNotificationContext } from './common/notification';
import { PERIPHERAL_ID_SEP } from './common/peripheral-dto';
import { CTDTreeMessengerType, CTDTreeWebviewContext } from './components/tree/types';
import { Commands } from './manifest';
import { PeripheralBaseNode } from './plugin/peripheral/nodes';
import { PeripheralDataTracker } from './plugin/peripheral/tree/peripheral-data-tracker';
import { PeripheralsTreeTableWebView } from './plugin/peripheral/webview/peripheral-tree-webview-main';
import { getFilePath } from './fileUtils';
import * as manifest from './manifest';
import { VSCodeContextKeys } from './common/vscode-context';

export class PeripheralCommands {
    public constructor(
        protected readonly dataTracker: PeripheralDataTracker,
        protected readonly webview: PeripheralsTreeTableWebView) {
    }

    public async activate(context: vscode.ExtensionContext): Promise<void> {
        this.updateIgnoredPeripheralsContext();
        context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration(`${manifest.PACKAGE_NAME}.${manifest.IGNORE_PERIPHERALS}`)) {
                    this.updateIgnoredPeripheralsContext();
                }
            }),

            // VSCode specific commands
            vscode.commands.registerCommand(Commands.FIND_COMMAND_ID, () => this.find()),
            vscode.commands.registerCommand(Commands.SET_FORMAT_COMMAND_ID, (node) => this.peripheralsSetFormat(node)),
            vscode.commands.registerCommand(Commands.REFRESH_ALL_COMMAND_ID, () => this.peripheralsForceRefresh()),
            vscode.commands.registerCommand(Commands.COLLAPSE_ALL_COMMAND_ID, () => this.collapseAll()),
            vscode.commands.registerCommand(Commands.EXPORT_ALL_COMMAND_ID, () => this.peripheralsExportAll()),
            vscode.commands.registerCommand(Commands.IGNORE_PERIPHERAL_ID, (context) => this.ignorePeripheral(context)),
            vscode.commands.registerCommand(Commands.CLEAR_IGNORED_PERIPHERAL_ID, () => this.clearIgnoredPeripherals()),

            // Commands manually rendered in the DOM
            vscode.commands.registerCommand(Commands.UPDATE_NODE_COMMAND.commandId, (node, value) => this.peripheralsUpdateNode(node, value)),
            vscode.commands.registerCommand(Commands.EXPORT_NODE_COMMAND.commandId, node => this.peripheralsExportNode(node)),
            vscode.commands.registerCommand(Commands.COPY_VALUE_COMMAND.commandId, (node, value) => this.peripheralsCopyValue(node, value)),
            vscode.commands.registerCommand(Commands.FORCE_REFRESH_COMMAND.commandId, (node) => this.peripheralsForceRefresh(node)),
            vscode.commands.registerCommand(Commands.PIN_COMMAND.commandId, (node, _, context) => this.peripheralsTogglePin(node, context)),
            vscode.commands.registerCommand(Commands.UNPIN_COMMAND.commandId, (node, _, context) => this.peripheralsTogglePin(node, context)),
        );
    }

    private updateIgnoredPeripheralsContext(): void {
        const ignoredPeripherals = vscode.workspace.getConfiguration(manifest.PACKAGE_NAME)?.inspect<string[]>(manifest.IGNORE_PERIPHERALS)?.workspaceValue ?? [];
        vscode.commands.executeCommand('setContext', VSCodeContextKeys.IGNORED_PERIPHERALS_LENGTH, ignoredPeripherals.length);
    }

    private async peripheralsUpdateNode(node: PeripheralBaseNode, value?: unknown): Promise<void> {
        try {
            const result = await node.performUpdate(value);
            if (result) {
                // Update the tree view
                this.dataTracker.fireOnDidChange();
            }

        } catch (error) {
            vscode.debug.activeDebugConsole.appendLine(`Unable to update value: ${(error as Error).message}`);
        }
    }

    private async peripheralsExportNode(
        node: PeripheralBaseNode,
    ): Promise<void> {
        const filePath = await getFilePath();
        if (!filePath) {
            this.dataTracker.fireOnDidChange();
            return;
        }
        this.dataTracker.exportNodeToXml(node, filePath);
    }

    private async peripheralsExportAll(): Promise<void> {
        const filePath = await getFilePath();
        if (!filePath) {
            this.dataTracker.fireOnDidChange();
            return;
        }
        this.dataTracker.exportAllNodesToXml(filePath);
    }

    private peripheralsCopyValue(_node: PeripheralBaseNode, value?: string): void {
        if (value) {
            vscode.env.clipboard.writeText(value);
        }
    }

    private collapseAll(): void {
        this.dataTracker.collapseAll();
    }

    private async peripheralsSetFormat(context: PeripheralBaseNode | CTDTreeWebviewContext): Promise<void> {
        const result = await vscode.window.showQuickPick([
            { label: 'Auto', description: 'Automatically choose format (Inherits from parent)', value: NumberFormat.Auto },
            { label: 'Hex', description: 'Format value in hexadecimal', value: NumberFormat.Hexadecimal },
            { label: 'Decimal', description: 'Format value in decimal', value: NumberFormat.Decimal },
            { label: 'Binary', description: 'Format value in binary', value: NumberFormat.Binary }
        ]);
        if (result === undefined) {
            return;
        }

        let node: PeripheralBaseNode;
        if (CTDTreeWebviewContext.is(context)) {
            node = this.dataTracker.getNodeByPath(context.cdtTreeItemId.split(PERIPHERAL_ID_SEP));
        } else {
            node = context;
        }

        node.format = result.value;
        this.dataTracker.fireOnDidChange();
    }

    private async find(): Promise<void> {
        this.webview.sendNotification(CTDTreeMessengerType.openSearch);
    }

    private async peripheralsForceRefresh(node?: PeripheralBaseNode): Promise<void> {
        if (node) {
            const peripheral = node.getPeripheral();
            if (peripheral) {
                await peripheral.updateData();
            }
            this.dataTracker.fireOnDidChange();
        } else {
            return this.dataTracker.updateData();
        }
    }

    private peripheralsTogglePin(node: PeripheralBaseNode, context?: TreeNotificationContext): void {
        this.dataTracker.togglePin(node, context);
    }

    private ignorePeripheral(context: CTDTreeWebviewContext): void {
        const node = this.dataTracker.getNodeByPath(context.cdtTreeItemId.split(PERIPHERAL_ID_SEP));

        const ignoredPeripherals = vscode.workspace.getConfiguration(manifest.PACKAGE_NAME).get<string[]>(manifest.IGNORE_PERIPHERALS) ?? [];
        vscode.workspace.getConfiguration(manifest.PACKAGE_NAME).update(manifest.IGNORE_PERIPHERALS, [...ignoredPeripherals, node.name]);
    }

    private clearIgnoredPeripherals(): void {
        vscode.workspace.getConfiguration(manifest.PACKAGE_NAME).update(manifest.IGNORE_PERIPHERALS, undefined);
    }
}

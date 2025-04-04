/********************************************************************************
 * Copyright (C) 2023 Marcel Ball, Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import { CDTTreeMessengerType, CDTTreeWebviewContext } from '@eclipse-cdt-cloud/vscode-ui-components';
import * as vscode from 'vscode';
import { NumberFormat } from './common/format';
import { PERIPHERAL_ID_SEP } from './common/peripheral-dto';
import { VSCodeContextKeys } from './common/vscode-context';
import { getFilePath } from './fileUtils';
import { Commands } from './manifest';
import { PeripheralBaseNode } from './model/peripheral/nodes';
import { PeripheralConfigurationProvider } from './model/peripheral/tree/peripheral-configuration-provider';
import { PeripheralDataTracker } from './model/peripheral/tree/peripheral-data-tracker';
import { PeripheralsTreeTableWebView } from './views/peripheral/peripheral-view-provider';

export class PeripheralCommands {
    public constructor(
        protected readonly dataTracker: PeripheralDataTracker,
        protected readonly config: PeripheralConfigurationProvider,
        protected readonly webview: PeripheralsTreeTableWebView) {
    }

    public async activate(context: vscode.ExtensionContext): Promise<void> {
        this.updateIgnoredPeripheralsContext();
        context.subscriptions.push(
            this.config.onDidChangeIgnorePeripherals(() => this.updateIgnoredPeripheralsContext()),

            // VSCode specific commands
            vscode.commands.registerCommand(Commands.FIND_COMMAND_ID, () => this.find()),
            vscode.commands.registerCommand(Commands.SET_FORMAT_COMMAND_ID, (node) => this.peripheralsSetFormat(node)),
            vscode.commands.registerCommand(Commands.REFRESH_ALL_COMMAND_ID, () => this.peripheralsForceRefresh()),
            vscode.commands.registerCommand(Commands.COLLAPSE_ALL_COMMAND_ID, () => this.collapseAll()),
            vscode.commands.registerCommand(Commands.EXPORT_ALL_COMMAND_ID, () => this.peripheralsExportAll()),
            vscode.commands.registerCommand(Commands.IGNORE_PERIPHERAL_ID, (context) => this.ignorePeripheral(context)),
            vscode.commands.registerCommand(Commands.CLEAR_IGNORED_PERIPHERAL_ID, () => this.clearIgnoredPeripherals()),
            vscode.commands.registerCommand(Commands.PERIODIC_REFRESH_ID, (context) => this.periodicRefreshMode(context)),
            vscode.commands.registerCommand(Commands.PERIODIC_REFRESH_INTERVAL_ID, (context) => this.periodicRefreshInterval(context)),

            // Commands manually rendered in the DOM
            vscode.commands.registerCommand(Commands.UPDATE_NODE_COMMAND.commandId, (node, value) => this.peripheralsUpdateNode(node, value)),
            vscode.commands.registerCommand(Commands.EXPORT_NODE_COMMAND.commandId, node => this.peripheralsExportNode(node)),
            vscode.commands.registerCommand(Commands.COPY_VALUE_COMMAND.commandId, (node, value) => this.peripheralsCopyValue(node, value)),
            vscode.commands.registerCommand(Commands.FORCE_REFRESH_COMMAND.commandId, (node) => this.peripheralsForceRefresh(node)),
            vscode.commands.registerCommand(Commands.PIN_COMMAND.commandId, (node) => this.peripheralsTogglePin(node)),
            vscode.commands.registerCommand(Commands.UNPIN_COMMAND.commandId, (node) => this.peripheralsTogglePin(node)),
        );
    }

    private updateIgnoredPeripheralsContext(): void {
        const ignoredPeripherals = this.config.ignorePeripherals();
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

    private async peripheralsSetFormat(context: PeripheralBaseNode | CDTTreeWebviewContext): Promise<void> {
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
        if (CDTTreeWebviewContext.is(context)) {
            node = this.dataTracker.getNodeByPath(context.cdtTreeItemId.split(PERIPHERAL_ID_SEP));
        } else {
            node = context;
        }

        node.format = result.value;
        this.dataTracker.fireOnDidChange();
    }

    private async find(): Promise<void> {
        this.webview.sendNotification(CDTTreeMessengerType.openSearch);
    }

    private async peripheralsForceRefresh(node?: PeripheralBaseNode): Promise<void> {
        if (node) {
            const peripheral = node.getPeripheral();
            const changes: PeripheralBaseNode[] = [];
            if (peripheral) {
                await peripheral.updateData({ changes });
            }
            this.dataTracker.fireOnDidChange(changes);
        } else {
            await this.dataTracker.updateData();
        }
    }

    private peripheralsTogglePin(node: PeripheralBaseNode): void {
        this.dataTracker.togglePin(node);
    }

    private ignorePeripheral(context: CDTTreeWebviewContext): void {
        const node = this.dataTracker.getNodeByPath(context.cdtTreeItemId.split(PERIPHERAL_ID_SEP));
        if (node.name) {
            this.config.addIgnorePeripherals(node.name);
        }
    }

    private clearIgnoredPeripherals(): void {
        this.config.setIgnorePeripherals();
    }

    private periodicRefreshMode(_context?: CDTTreeWebviewContext): void {
        this.config.queryPeriodicRefreshMode();
    }

    private periodicRefreshInterval(_context?: CDTTreeWebviewContext): void {
        this.config.queryPeriodicRefreshInterval();
    }
}

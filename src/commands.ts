/********************************************************************************
 * Copyright (C) 2023 Marcel Ball, Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import * as vscode from 'vscode';
import { NumberFormat } from './common/format';
import { TreeNotificationContext } from './common/notification';
import { PERIPHERAL_ID_SEP } from './common/peripherals';
import { CTDTreeWebviewContext } from './components/tree/types';
import { Commands } from './manifest';
import { PeripheralBaseNodeImpl } from './plugin/peripheral/nodes';
import { PeripheralDataTracker } from './plugin/peripheral/tree/peripheral-data-tracker';

export class PeripheralCommands {
    public constructor(
        protected readonly dataTracker: PeripheralDataTracker) {
    }

    public async activate(context: vscode.ExtensionContext): Promise<void> {
        context.subscriptions.push(
            vscode.commands.registerCommand(Commands.UPDATE_NODE_COMMAND.commandId, (node) => this.peripheralsUpdateNode(node)),
            vscode.commands.registerCommand(Commands.COPY_VALUE_COMMAND.commandId, (node) => this.peripheralsCopyValue(node)),
            vscode.commands.registerCommand(Commands.SET_FORMAT_COMMAND.commandId, (node) => this.peripheralsSetFormat(node)),
            vscode.commands.registerCommand(Commands.FORCE_REFRESH_COMMAND.commandId, (node) => this.peripheralsForceRefresh(node)),
            vscode.commands.registerCommand(Commands.PIN_COMMAND.commandId, (node, context) => this.peripheralsTogglePin(node, context)),
            vscode.commands.registerCommand(Commands.UNPIN_COMMAND.commandId, (node, context) => this.peripheralsTogglePin(node, context)),
            vscode.commands.registerCommand(Commands.REFRESH_ALL_COMMAND.commandId, () => this.peripheralsForceRefresh()),
            vscode.commands.registerCommand(Commands.COLLAPSE_ALL_COMMAND.commandId, () => this.collapseAll()),
        );
    }

    private async peripheralsUpdateNode(node: PeripheralBaseNodeImpl): Promise<void> {
        try {
            const result = await node.performUpdate();
            if (result) {
                await this.peripheralsForceRefresh();
            } else {
                this.dataTracker.refresh();
            }

        } catch (error) {
            vscode.debug.activeDebugConsole.appendLine(`Unable to update value: ${(error as Error).message}`);
        }
    }

    private peripheralsCopyValue(node: PeripheralBaseNodeImpl): void {
        const cv = node.getCopyValue();
        if (cv) {
            vscode.env.clipboard.writeText(cv);
        }
    }

    private collapseAll(): void {
        this.dataTracker.collapseAll();
    }

    private async peripheralsSetFormat(context: PeripheralBaseNodeImpl | CTDTreeWebviewContext): Promise<void> {
        const result = await vscode.window.showQuickPick([
            { label: 'Auto', description: 'Automatically choose format (Inherits from parent)', value: NumberFormat.Auto },
            { label: 'Hex', description: 'Format value in hexadecimal', value: NumberFormat.Hexadecimal },
            { label: 'Decimal', description: 'Format value in decimal', value: NumberFormat.Decimal },
            { label: 'Binary', description: 'Format value in binary', value: NumberFormat.Binary }
        ]);
        if (result === undefined) {
            return;
        }

        let node: PeripheralBaseNodeImpl;
        if (CTDTreeWebviewContext.is(context)) {
            node = this.dataTracker.getNodeByPath(context.cdtTreeItemId.split(PERIPHERAL_ID_SEP));
        } else {
            node = context;
        }

        node.format = result.value;
        this.dataTracker.refresh();
    }

    private async peripheralsForceRefresh(node?: PeripheralBaseNodeImpl): Promise<void> {
        if (node) {
            const p = node.getPeripheral();
            if (p) {
                await p.updateData();
            }

            this.dataTracker.refresh();
        } else {
            await this.dataTracker.updateData();
        }
    }

    private peripheralsTogglePin(node: PeripheralBaseNodeImpl, context?: TreeNotificationContext): void {
        this.dataTracker.togglePin(node, context);
    }
}

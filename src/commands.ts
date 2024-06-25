/********************************************************************************
 * Copyright (C) 2023 Marcel Ball, Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import * as vscode from 'vscode';
import { NumberFormat } from './common';
import { PeripheralBaseNode } from './plugin/peripheral/nodes';
import { PeripheralDataTracker } from './plugin/peripheral/tree/peripheral-data-tracker';
import { Commands } from './manifest';
import { CTDTreeWebviewContext } from './components/tree/types';

export class PeripheralCommands {
    public constructor(
        protected readonly dataTracker: PeripheralDataTracker) {
    }

    public async activate(context: vscode.ExtensionContext): Promise<void> {
        context.subscriptions.push(
            vscode.commands.registerCommand(Commands.UPDATE_NODE_COMMAND.commandId, node => this.peripheralsUpdateNode(node)),
            vscode.commands.registerCommand(Commands.COPY_VALUE_COMMAND.commandId, node => this.peripheralsCopyValue(node)),
            vscode.commands.registerCommand(Commands.SET_FORMAT_COMMAND.commandId, node => this.peripheralsSetFormat(node)),
            vscode.commands.registerCommand(Commands.FORCE_REFRESH_COMMAND.commandId, node => this.peripheralsForceRefresh(node)),
            vscode.commands.registerCommand(Commands.PIN_COMMAND.commandId, node => this.peripheralsTogglePin(node)),
            vscode.commands.registerCommand(Commands.UNPIN_COMMAND.commandId, node => this.peripheralsTogglePin(node)),
            vscode.commands.registerCommand(Commands.REFRESH_ALL_COMMAND.commandId, () => this.peripheralsForceRefresh()),
            vscode.commands.registerCommand(Commands.COLLAPSE_ALL_COMMAND.commandId, () => this.collapseAll()),
        );
    }

    private async peripheralsUpdateNode(node: PeripheralBaseNode): Promise<void> {
        try {
            const result = await node.performUpdate();
            if (result) {
                this.peripheralsForceRefresh();
            }
        } catch (error) {
            vscode.debug.activeDebugConsole.appendLine(`Unable to update value: ${(error as Error).message}`);
        }
    }

    private peripheralsCopyValue(node: PeripheralBaseNode): void {
        const cv = node.getCopyValue();
        if (cv) {
            vscode.env.clipboard.writeText(cv);
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
            node = this.dataTracker.getNodeByPath(context.cdtTreeItemPath);
        } else {
            node = context;
        }

        node.format = result.value;
        this.dataTracker.refresh();
    }

    private async peripheralsForceRefresh(node?: PeripheralBaseNode): Promise<void> {
        if (node) {
            const p = node.getPeripheral();
            if (p) {
                await p.updateData();
            }
        } else {
            this.dataTracker.updateData();
        }
    }

    private peripheralsTogglePin(node: PeripheralBaseNode): void {
        this.dataTracker.togglePin(node);
    }
}

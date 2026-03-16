/********************************************************************************
 * Copyright (C) 2026 Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import * as vscode from 'vscode';
import { PACKAGE_NAME, PUBLISHER_NAME } from '../manifest';
import { IPeripheralInspectorAPI } from '../api-types';

export class PrintApiInterruptTable {
    public static readonly COMMAND_ID = `${PACKAGE_NAME}.printInterruptTable`;

    public async activate(context: vscode.ExtensionContext): Promise<void> {
        context.subscriptions.push(
            vscode.commands.registerCommand(PrintApiInterruptTable.COMMAND_ID, () => this.printInterruptTable())
        );
    };

    private async printInterruptTable(): Promise<void> {
        const extension = vscode.extensions.getExtension<IPeripheralInspectorAPI>(`${PUBLISHER_NAME}.${PACKAGE_NAME}`);

        if (!extension || !extension.isActive) {
            vscode.debug.activeDebugConsole.appendLine('Interrupt Table: API not found. Make sure the extension is activated.');
            return;
        }

        const api = extension.exports;

        if (!api.getInterruptTable) {
            vscode.debug.activeDebugConsole.appendLine('Interrupt Table: API does not provide \'getInterruptTable()\'.');
            return;
        }

        // Get loaded files from local API
        const svdPath = await vscode.window.showInputBox({ prompt: 'Enter the path to the SVD file', ignoreFocusOut: true });
        if (!svdPath) {
            vscode.window.showInformationMessage('No SVD file path provided');
            return;
        }

        const interruptTable = api.getInterruptTable(svdPath);
        if (!interruptTable) {
            vscode.debug.activeDebugConsole.appendLine('Interrupt Table: Not available');
            return;
        }
        vscode.debug.activeDebugConsole.appendLine('Interrupt Table:');
        Object.values(interruptTable.interrupts).forEach(interrupt => vscode.debug.activeDebugConsole.appendLine(
            `\tInterrupt #${interrupt.value}: '${interrupt.name}' ${interrupt.description ?? ''}`
        ));
    }
};

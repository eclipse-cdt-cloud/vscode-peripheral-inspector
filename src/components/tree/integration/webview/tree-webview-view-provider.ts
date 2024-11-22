/********************************************************************************
 * Copyright (C) 2024 Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import * as vscode from 'vscode';
import { Messenger } from 'vscode-messenger';
import { WebviewIdMessageParticipant } from 'vscode-messenger-common';
import { CDTTreeExecuteCommand, CDTTreeItem, CDTTreeState, CDTTreeViewType, CTDTreeMessengerType } from '../../types';
import { CDTTreeDataProvider } from '../tree-data-provider';
import { TreeNotification } from '../../../../common/notification';

export abstract class CDTTreeWebviewViewProvider<TNode> implements vscode.WebviewViewProvider {

    protected onDidToggleNodeEvent = new vscode.EventEmitter<TreeNotification<CDTTreeItem>>();
    public readonly onDidToggleNode = this.onDidToggleNodeEvent.event;
    protected onDidExecuteCommandEvent = new vscode.EventEmitter<TreeNotification<CDTTreeExecuteCommand>>();
    public readonly onDidExecuteCommand = this.onDidExecuteCommandEvent.event;
    protected onDidClickNodeEvent = new vscode.EventEmitter<TreeNotification<CDTTreeItem>>();
    public readonly onDidClickNode = this.onDidClickNodeEvent.event;

    abstract readonly type: CDTTreeViewType;

    protected get extensionUri(): vscode.Uri {
        return this.context.extensionUri;
    }

    protected _view?: vscode.WebviewView;
    protected participant: WebviewIdMessageParticipant | undefined;

    public constructor(
        protected readonly dataProvider: CDTTreeDataProvider<TNode, any>,
        protected readonly context: vscode.ExtensionContext,
        protected readonly messenger = new Messenger({ ignoreHiddenViews: false, debugLog: true })
    ) {
        this.init();
    }

    protected init(): void {
        this.dataProvider.onDidChangeTreeData?.(async (event) => {
            if (event.context?.resync !== false) {
                this.refresh();
            }
        });
    }

    public async resolveWebviewView(webviewView: vscode.WebviewView, _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken): Promise<void> {
        this._view = webviewView;

        const baseExtensionUriString = this.extensionUri.toString();
        const distPathUri = vscode.Uri.parse(`${baseExtensionUriString}/dist/views`, true /* strict */);
        const mediaPathUri = vscode.Uri.parse(`${baseExtensionUriString}/media`, true /* strict */);
        const nodeModulesPathUri = vscode.Uri.parse(`${baseExtensionUriString}/node_modules`, true /* strict */);

        // Allow scripts in the webview
        webviewView.webview.options = {
            enableScripts: true,                            // enable scripts in the webview
            localResourceRoots: [distPathUri, mediaPathUri, nodeModulesPathUri] // restrict extension's local file access
        };

        // Set the HTML content that will fill the webview view
        webviewView.webview.html = await this.getWebviewContent(webviewView.webview, this.extensionUri);

        // Sets up an event listener to listen for messages passed from the webview view context
        // and executes code based on the message that is received
        this.setWebviewMessageListener(webviewView);
        this.setWebviewData(webviewView);
    }

    protected setWebviewData(_webviewView: vscode.WebviewView): void {
        // Nothing to do
    }

    protected async getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): Promise<string> {
        const codiconsUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'));
        const mainUri = webview.asWebviewUri(vscode.Uri.joinPath(
            extensionUri,
            'dist',
            'views',
            'treeWebView.js'
        ));

        return `
            <!DOCTYPE html>
            <html lang='en' style="height: 100%">
                <head>
                    <meta charset='UTF-8'>
                    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
                    <meta http-equiv='Content-Security-Policy' content="default-src 'none'; font-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource};">
                    <link href="${codiconsUri}" rel="stylesheet" />
                    <script type='module' src='${mainUri}'></script>
                </head>
                <body style="height: 100%">
                    <div id='root'></div>
                </body>
            </html>
        `;
    }

    protected setWebviewMessageListener(webview: vscode.WebviewView): void {
        const participant = this.participant = this.messenger.registerWebviewView(webview);

        if (this.participant === undefined) {
            return;
        }

        const disposables = [
            this.messenger.onNotification(CTDTreeMessengerType.ready, () => this.onReady(), { sender: participant }),
            this.messenger.onNotification(CTDTreeMessengerType.executeCommand, (event) => this.onDidExecuteCommandEvent.fire(event), { sender: participant }),
            this.messenger.onNotification(CTDTreeMessengerType.toggleNode, event => this.onDidToggleNodeEvent.fire(event), { sender: participant }),
            this.messenger.onNotification(CTDTreeMessengerType.clickNode, event => this.onDidClickNodeEvent.fire(event), { sender: participant }),
        ];

        webview.onDidDispose(() => disposables.forEach(disposible => disposible.dispose()));
    }

    protected async onReady(): Promise<void> {
        await this.refresh();
    }

    protected async refresh(): Promise<void> {
        if (!this.participant) {
            return;
        }

        counter++;
        const label = counter + ' CDTTreeWebviewViewProvider.refresh';
        console.time(label);
        const peripherals = await this.dataProvider.getSerializedRoots();
        console.timeEnd(label);

        const state: CDTTreeState = {
            peripherals,
            columnFields: this.dataProvider.getColumnDefinitions?.(),
            type: this.type
        };
        this.messenger.sendNotification(CTDTreeMessengerType.updateState, this.participant, state);
    }
}

let counter = 0;

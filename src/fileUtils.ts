import * as vscode from 'vscode';

export async function getFilePath(): Promise<vscode.Uri | undefined> {
    const fileUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri : undefined,
        filters: {
            'xml': ['xml'],
        }
    });

    if (!fileUri) {
        vscode.window.showWarningMessage('Please enter a valid file name.');
    }
    return fileUri;
}

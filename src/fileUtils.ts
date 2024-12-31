import * as vscode from 'vscode';

export async function getFilePath(): Promise<vscode.Uri | undefined> {
    const workspaceFolder = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri : undefined;
    if (!workspaceFolder) {
        return;
    }
    const defaultFilePath = vscode.Uri.joinPath(workspaceFolder, 'registers.xml');
    const fileUri = await vscode.window.showSaveDialog({
        defaultUri: defaultFilePath,
        filters: {
            'xml': ['xml'],
        },
    });
    return fileUri;
}

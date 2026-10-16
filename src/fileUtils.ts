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

// At least two characters before the colon, so a Windows drive ("C:\...") is not taken as a scheme
const URI_SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]+:/;

/** Whether the path is a URI such as "vscode-vfs://..." rather than a file system path. */
export const hasUriScheme = (path: string): boolean => URI_SCHEME.test(path);

export const pathToUri = (path: string): vscode.Uri => {
    // A URI is kept as it is, so definition files can be read from any file system provider
    if (hasUriScheme(path)) {
        return vscode.Uri.parse(path);
    }
    try {
        return vscode.Uri.file(path);
    } catch {
        return vscode.Uri.parse(path);
    }
};

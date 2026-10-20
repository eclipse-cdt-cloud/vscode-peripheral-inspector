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

/** Whether the path is a URI such as "vscode-vfs://..." rather than a file system path. */
export const hasUriScheme = (path: string): boolean => {
    try {
        // Strict, so a path without a scheme throws instead of getting "file". A one-letter
        // scheme is a Windows drive ("C:\..."), not a URI.
        return vscode.Uri.parse(path, true).scheme.length > 1;
    } catch {
        return false;
    }
};

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

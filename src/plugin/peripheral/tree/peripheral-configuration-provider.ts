import * as vscode from 'vscode';
import * as manifest from '../../../manifest';
import { DebugTracker } from '../../../debug-tracker';

export class PeripheralConfigurationProvider {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    protected sessionConfiguration: Map<string, { [key: string]: any }> = new Map();
    protected sessionConfigurationEmitter: Map<string, { [key: string]: vscode.EventEmitter<unknown> }> = new Map();

    constructor(tracker: DebugTracker) {
        tracker.onWillStartSession(session => {
            this.sessionConfiguration.set(session.id, {});
            this.sessionConfigurationEmitter.set(session.id, {});
        });
        tracker.onWillStopSession(session => {
            this.sessionConfiguration.delete(session.id);
            const sessionConfigurationPropertyEmitters = this.sessionConfigurationEmitter.get(session.id);
            if (sessionConfigurationPropertyEmitters) {
                Object.keys(sessionConfigurationPropertyEmitters).forEach(key => sessionConfigurationPropertyEmitters[key].dispose());
            }
            this.sessionConfigurationEmitter.delete(session.id);
        });
    }

    // Workspace Configuration

    workspaceConfiguration(): vscode.WorkspaceConfiguration {
        return vscode.workspace.getConfiguration(manifest.PACKAGE_NAME);
    }

    assetPath(): string {
        return this.workspaceConfiguration().get<string>(manifest.CONFIG_ASSET_PATH, manifest.DEFAULT_ASSET_PATH);
    }

    onDidChangeAssetPath(callback: (newValue: string) => void): vscode.Disposable {
        return vscode.workspace.onDidChangeConfiguration(evt => {
            if (evt.affectsConfiguration(`${manifest.PACKAGE_NAME}.${manifest.CONFIG_ASSET_PATH}`)) {
                callback(this.assetPath());
            }
        });
    }

    setAssetPath(assetPath: string | undefined): void {
        this.workspaceConfiguration().update(manifest.CONFIG_ASSET_PATH, assetPath);
    }

    deviceConfig(): string {
        return this.workspaceConfiguration().get<string>(manifest.CONFIG_DEVICE, manifest.DEFAULT_DEVICE);
    }

    onDidChangeDeviceConfig(callback: (newValue: string) => void): vscode.Disposable {
        return vscode.workspace.onDidChangeConfiguration(evt => {
            if (evt.affectsConfiguration(`${manifest.PACKAGE_NAME}.${manifest.CONFIG_DEVICE}`)) {
                callback(this.deviceConfig());
            }
        });
    }

    setDeviceConfig(deviceConfig: string | undefined): void {
        this.workspaceConfiguration().update(manifest.CONFIG_DEVICE, deviceConfig);
    }

    ignorePeripherals(): string[] {
        return this.workspaceConfiguration().get<string[]>(manifest.CONFIG_IGNORE_PERIPHERALS, manifest.DEFAULT_IGNORE_PERIPHERALS);
    }

    onDidChangeIgnorePeripherals(callback: (newValue: string[]) => void): vscode.Disposable {
        return vscode.workspace.onDidChangeConfiguration(evt => {
            if (evt.affectsConfiguration(`${manifest.PACKAGE_NAME}.${manifest.CONFIG_IGNORE_PERIPHERALS}`)) {
                callback(this.ignorePeripherals());
            }
        });
    }

    addIgnorePeripherals(...ignorePeripherals: string[]): void {
        const ignoredPeripherals = this.ignorePeripherals();
        this.workspaceConfiguration().update(manifest.CONFIG_IGNORE_PERIPHERALS, [...ignoredPeripherals, ...ignorePeripherals]);
    }

    setIgnorePeripherals(ignorePeripherals?: string[]): void {
        this.workspaceConfiguration().update(manifest.CONFIG_IGNORE_PERIPHERALS, ignorePeripherals);
    }

    processorConfig(): string {
        return this.workspaceConfiguration().get<string>(manifest.CONFIG_PROCESSOR, manifest.DEFAULT_PROCESSOR);
    }

    onDidChangeProcessorConfig(callback: (newValue: string) => void): vscode.Disposable {
        return vscode.workspace.onDidChangeConfiguration(evt => {
            if (evt.affectsConfiguration(`${manifest.PACKAGE_NAME}.${manifest.CONFIG_PROCESSOR}`)) {
                callback(this.processorConfig());
            }
        });
    }

    setProcessorConfig(processorConfig: string | undefined): void {
        this.workspaceConfiguration().update(manifest.CONFIG_PROCESSOR, processorConfig);
    }

    sdvConfig(): string {
        return this.workspaceConfiguration().get<string>(manifest.CONFIG_SVD_PATH, manifest.DEFAULT_SVD_PATH);
    }

    onDidChangeSvdConfig(callback: (newValue: string) => void): vscode.Disposable {
        return vscode.workspace.onDidChangeConfiguration(evt => {
            if (evt.affectsConfiguration(`${manifest.PACKAGE_NAME}.${manifest.CONFIG_SVD_PATH}`)) {
                callback(this.sdvConfig());
            }
        });
    }

    setSvdConfig(svdConfig: string | undefined): void {
        this.workspaceConfiguration().update(manifest.CONFIG_SVD_PATH, svdConfig);
    }

    saveLayout(): boolean {
        return this.workspaceConfiguration().get<boolean>(manifest.CONFIG_SAVE_LAYOUT, manifest.DEFAULT_SAVE_LAYOUT);
    }

    onDidChangeSaveLayout(callback: (newValue: boolean) => void): vscode.Disposable {
        return vscode.workspace.onDidChangeConfiguration(evt => {
            if (evt.affectsConfiguration(`${manifest.PACKAGE_NAME}.${manifest.CONFIG_SAVE_LAYOUT}`)) {
                callback(this.saveLayout());
            }
        });
    }

    setSaveLayout(saveLayout: boolean | undefined): void {
        this.workspaceConfiguration().update(manifest.CONFIG_SAVE_LAYOUT, saveLayout);
    }

    // Session Configuration

    addressGapThreshold(session?: vscode.DebugSession): number {
        return session?.configuration[manifest.CONFIG_ADDRGAP] ?? this.workspaceConfiguration().get<number>(manifest.CONFIG_ADDRGAP, manifest.DEFAULT_ADDRGAP);
    }

    deviceName(session: vscode.DebugSession): string | undefined {
        return session.configuration[this.deviceConfig()];
    }

    processorName(session: vscode.DebugSession): string | undefined {
        return session.configuration[this.processorConfig()];
    }

    sdvPath(session: vscode.DebugSession): string | undefined {
        return session.configuration[this.sdvConfig()];
    }

    protected getSessionOrWorkspaceConfiguration<T>(section: string, session: vscode.DebugSession | undefined, defaultValue: T): T;
    protected getSessionOrWorkspaceConfiguration<T>(section: string, session: vscode.DebugSession | undefined): T | undefined;
    protected getSessionOrWorkspaceConfiguration<T>(section: string, session: vscode.DebugSession | undefined, defaultValue?: T): T | undefined {
        // hierarchy: custom configurations > session configurations > workspace configurations
        return this.sessionConfiguration.get(session?.id ?? 'empty')?.[section]
            ?? session?.configuration[section]
            ?? this.workspaceConfiguration().get<T | undefined>(section, defaultValue);
    }

    protected setSessionOrWorkspaceConfiguration<T>(section: string, session: vscode.DebugSession | undefined, value: T | undefined): void {
        if (session) {
            // we cannot update the session.configuration directly
            this.sessionConfiguration.set(session.id, { ...this.sessionConfiguration.get(session.id), [section]: value });
            this.sessionConfigurationEmitter.get(session.id)?.[section]?.fire(value);
            return;
        }
        this.workspaceConfiguration().update(section, value);
    }

    protected onDidChangeSessionOrWorkspaceConfiguration<T>(section: string, session: vscode.DebugSession | undefined, callback: (newValue: T) => void, workspaceValue: () => T): vscode.Disposable {
        const disposables: vscode.Disposable[] = [];
        if (session) {
            const sectionEmitters = this.sessionConfigurationEmitter.get(session.id);
            let emitter = sectionEmitters?.[section] as vscode.EventEmitter<T>;
            if (!emitter) {
                emitter = new vscode.EventEmitter<T>();
                this.sessionConfigurationEmitter.set(session.id, { ...sectionEmitters, [section]: emitter });
            }
            disposables.push(emitter.event(callback));
        }
        disposables.push(vscode.workspace.onDidChangeConfiguration(evt => {
            if (evt.affectsConfiguration(`${manifest.PACKAGE_NAME}.${section}`)) {
                callback(workspaceValue());
            }
        }));
        return vscode.Disposable.from(...disposables);
    }

    periodicRefreshMode(session?: vscode.DebugSession): manifest.PeriodicRefreshMode {
        return this.getSessionOrWorkspaceConfiguration(manifest.CONFIG_PERIODIC_REFRESH_MODE, session, manifest.DEFAULT_PERIODIC_REFRESH);
    }

    onDidChangePeriodicRefreshMode(callback: (newValue: manifest.PeriodicRefreshMode) => void, session?: vscode.DebugSession): vscode.Disposable {
        return this.onDidChangeSessionOrWorkspaceConfiguration(manifest.CONFIG_PERIODIC_REFRESH_MODE, session, callback, () => this.periodicRefreshMode(session));
    }

    setPeriodicRefreshMode(periodicRefreshMode: manifest.PeriodicRefreshMode | undefined, session?: vscode.DebugSession): void {
        this.setSessionOrWorkspaceConfiguration(manifest.CONFIG_PERIODIC_REFRESH_MODE, session, periodicRefreshMode);
    }

    async queryPeriodicRefreshMode(session?: vscode.DebugSession): Promise<void> {
        const context = session ? 'Session: ' : 'Workspace: ';
        const currentValue = this.periodicRefreshMode(session);
        const pick = await vscode.window.showQuickPick(manifest.PERIODIC_REFRESH_MODE_CHOICES, {
            placeHolder: currentValue,
            title: context + 'Select the periodic refresh mode'
        });
        if (pick) {
            return this.setPeriodicRefreshMode(pick as manifest.PeriodicRefreshMode, session);
        }
    }

    periodicRefreshInterval(session?: vscode.DebugSession): number {
        return this.getSessionOrWorkspaceConfiguration(manifest.CONFIG_PERIODIC_REFRESH_INTERVAL, session, manifest.DEFAULT_PERIODIC_REFRESH_INTERVAL);
    }

    onDidChangePeriodicRefreshInterval(callback: (newValue: number) => void, session?: vscode.DebugSession): vscode.Disposable {
        return this.onDidChangeSessionOrWorkspaceConfiguration(manifest.CONFIG_PERIODIC_REFRESH_INTERVAL, session, callback, () => this.periodicRefreshInterval(session));
    }

    setPeriodicRefreshInterval(periodicRefreshInterval: number | undefined, session?: vscode.DebugSession): void {
        this.setSessionOrWorkspaceConfiguration(manifest.CONFIG_PERIODIC_REFRESH_INTERVAL, session, periodicRefreshInterval);
    }

    async queryPeriodicRefreshInterval(session?: vscode.DebugSession): Promise<void> {
        const context = session ? 'Session: ' : 'Workspace: ';
        const currentValue = this.periodicRefreshInterval(session);
        const input = await vscode.window.showInputBox({
            prompt: context + 'Enter the interval in milliseconds or -1 for no refresh',
            placeHolder: String(currentValue),
            value: String(currentValue),
            validateInput: value => {
                const interval = parseInt(value);
                return isNaN(interval) || (interval < 1 && interval !== -1) ? 'Please enter a positive integer or -1 for no refresh' : undefined;
            }
        });
        if (input) {
            return this.setPeriodicRefreshInterval(parseInt(input), session);
        }
    }
}

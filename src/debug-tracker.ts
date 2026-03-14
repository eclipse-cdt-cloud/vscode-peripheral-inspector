/********************************************************************************
 * Copyright (C) 2023 Marcel Ball, Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import * as vscode from 'vscode';

const DEBUG_TRACKER_EXTENSION = 'mcu-debug.debug-tracker-vscode';

interface IDebuggerTrackerEvent {
    event: DebugSessionStatus;
    session?: vscode.DebugSession;
    sessionId?: string;
}

interface IDebuggerTrackerSubscribeArgBodyV1 {
    debuggers: string[] | '*';
    handler: (arg: IDebuggerTrackerEvent) => Promise<void>;
}

interface IDebuggerTrackerSubscribeArg {
    version: number;
    body: IDebuggerTrackerSubscribeArgBodyV1;
}

interface IDebugTracker {
    subscribe(arg: IDebuggerTrackerSubscribeArg): void;
}

export enum DebugSessionStatus {
    Unknown = 'unknown',
    Initializing = 'initializing',
    Started = 'started',
    Stopped = 'stopped',
    Running = 'running',
    Terminated = 'terminated'
}

export class DebugTracker {
    public constructor(private debugType = '*') {
    }

    private _onWillStartSession: vscode.EventEmitter<vscode.DebugSession> = new vscode.EventEmitter<vscode.DebugSession>();
    public readonly onWillStartSession: vscode.Event<vscode.DebugSession> = this._onWillStartSession.event;

    private _onWillStopSession: vscode.EventEmitter<string | vscode.DebugSession> = new vscode.EventEmitter<string | vscode.DebugSession>();
    public readonly onWillStopSession: vscode.Event<string | vscode.DebugSession> = this._onWillStopSession.event;

    private _onDidStopDebug: vscode.EventEmitter<string> = new vscode.EventEmitter<string>();
    public readonly onDidStopDebug: vscode.Event<string> = this._onDidStopDebug.event;

    private _onDidContinueDebug: vscode.EventEmitter<string> = new vscode.EventEmitter<string>();
    public readonly onDidContinueDebug: vscode.Event<string> = this._onDidContinueDebug.event;

    public async activate(context: vscode.ExtensionContext): Promise<void> {
        const debugtracker = await this.getTracker();
        if (debugtracker) {
            // Use shared debug tracker extension
            debugtracker.subscribe({
                version: 1,
                body: {
                    debuggers: '*',
                    handler: async event => {
                        const sessionId = event.session?.id ?? event.sessionId;
                        if (event.event === DebugSessionStatus.Initializing && event.session) {
                            this.handleOnWillStartSession(event.session);
                        }
                        if (event.event === DebugSessionStatus.Terminated && sessionId) {
                            this.handleOnWillStopSession(sessionId);
                        }
                        if (event.event === DebugSessionStatus.Stopped && sessionId) {
                            this.handleOnDidStopDebug(sessionId);
                        }
                        if (event.event === DebugSessionStatus.Running && sessionId) {
                            this.handleOnDidContinueDebug(sessionId);
                        }
                    }
                }
            });
        } else {
            // Use vscode debug tracker
            const createDebugAdapterTracker = (session: vscode.DebugSession): vscode.DebugAdapterTracker => {
                return {
                    onWillStartSession: () => this.handleOnWillStartSession(session),
                    onWillStopSession: () => this.handleOnWillStopSession(session),
                    onDidSendMessage: message => {
                        if (message.type === 'event' && message.event === 'stopped') {
                            this.handleOnDidStopDebug(session.id);
                        }
                        if (message.type === 'event' && message.event === 'continued') {
                            this.handleOnDidContinueDebug(session.id);
                        }
                    }
                };
            };

            context.subscriptions.push(
                vscode.debug.registerDebugAdapterTrackerFactory(this.debugType, { createDebugAdapterTracker })
            );
        }
    }

    private handleOnWillStartSession(session: vscode.DebugSession): void {
        this._onWillStartSession.fire(session);
    }

    private handleOnWillStopSession(session: string | vscode.DebugSession): void {
        this._onWillStopSession.fire(session);
    }

    private handleOnDidStopDebug(session: string): void {
        this._onDidStopDebug.fire(session);
    }

    private handleOnDidContinueDebug(session: string): void {
        this._onDidContinueDebug.fire(session);
    }

    private async getTracker(): Promise<IDebugTracker | undefined> {
        try {
            const trackerExtension = vscode.extensions.getExtension<IDebugTracker>(DEBUG_TRACKER_EXTENSION);
            if (trackerExtension) {
                return trackerExtension.activate();
            }
        } catch {
            // Ignore error
        }

        return undefined;
    }
}

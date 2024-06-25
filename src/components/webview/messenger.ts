/********************************************************************************
 * Copyright (C) 2024 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import { Messenger } from 'vscode-messenger-webview';

export const vscode = acquireVsCodeApi();
export const messenger = new Messenger(vscode);
messenger.start();

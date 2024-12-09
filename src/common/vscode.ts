/********************************************************************************
 * Copyright (C) 2024 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/
import { NumberFormat } from './format';

export interface VscodeContext {
    'data-vscode-context': string;
}

export interface NodeSetting {
    node: string;
    expanded?: boolean;
    format?: NumberFormat;
    pinned?: boolean;
}

export interface CommandDefinition {
    commandId: string;
    icon: string;
    title?: string;
}

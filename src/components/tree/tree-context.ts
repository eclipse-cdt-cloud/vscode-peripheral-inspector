/********************************************************************************
 * Copyright (C) 2024 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import { createContext } from 'react';
import { NotificationType } from 'vscode-messenger-common';
import React from 'react';

export interface NotifyOptions {
    isLoading?: boolean
}

export interface CDTTreeContext {
    notify<TParam>(notification: NotificationType<TParam>, params: TParam, options?: NotifyOptions): void;
}
export const CDTTreeContext = createContext<CDTTreeContext>({
    notify: () => {
        throw new Error('Notification lost as no context provided.');
    }
});
export const useCDTTreeContext = () => {
    const context = React.useContext(CDTTreeContext);

    if (context == null) {
        throw new Error('CDTTree components must be wrapped in <CDTTreeView/>');
    }

    return context;
};

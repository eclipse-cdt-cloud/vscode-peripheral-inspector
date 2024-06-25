/*********************************************************************
 * Copyright (c) 2024 Arm Limited and others
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 *********************************************************************/

import 'primeflex/primeflex.css';
import 'primereact/resources/primereact.css';
import 'primereact/resources/themes/lara-light-indigo/theme.css';
import './tree-view.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { HOST_EXTENSION, NotificationType } from 'vscode-messenger-common';
import { messenger } from '../webview/messenger';
import { ComponentTree } from './components/tree';
import {
    CDTTreeState,
    CTDTreeMessengerType
} from './types';
import { CDTTreeContext } from './tree-context';
import { ComponentTreeTable } from './components/treetable';

export class CDTTreeView extends React.Component<unknown, CDTTreeState> {

    public constructor(props: unknown) {
        super(props);
        this.state = {
            items: [],
            type: 'tree'
        };
    }

    public async componentDidMount(): Promise<void> {
        messenger.onNotification(CTDTreeMessengerType.updateState, state => {
            this.setState(state);
        });
        messenger.sendNotification(CTDTreeMessengerType.ready, HOST_EXTENSION, undefined);
    }

    protected notify<TNotification extends NotificationType<P>, P>(notification: TNotification, params: P): void {
        messenger.sendNotification(notification, HOST_EXTENSION, params);
    }

    // Create TreeView flavors
    protected createTree(): React.ReactNode {
        return <ComponentTree
            nodes={this.state.items}
            selectedNode={this.state.selectedItem}
        />;
    }

    protected createTreeTable(): React.ReactNode {
        return <ComponentTreeTable
            nodes={this.state.items}
            selectedNode={this.state.selectedItem}
            columnDefinitions={this.state.columnFields}
        />;
    }

    public render(): React.ReactNode {
        const child = (() => {
            switch (this.state.type) {
                case 'tree':
                    return this.createTree();
                case 'treetable':
                    return this.createTreeTable();
            }
        })();

        return <div data-vscode-context='{"preventDefaultContextMenuItems": true}'>
            <CDTTreeContext.Provider value={{
                notify: this.notify.bind(this)
            }
            }>
                {child}
            </CDTTreeContext.Provider>
        </div>;
    }
}

const container = document.getElementById('root') as Element;
createRoot(container).render(<CDTTreeView />);

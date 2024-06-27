/*********************************************************************
 * Copyright (c) 2024 Arm Limited and others
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 *********************************************************************/

import { classNames } from 'primereact/utils';
import React from 'react';

export interface ToggleItem {
    expanded?: boolean | undefined;
    leaf?: boolean | undefined;
}

export interface ExpandToggleProps {
    item: ToggleItem;
    depth?: number;
}

export const ExpandToggle: React.FC<ExpandToggleProps> = ({ item, depth = 0 }) => {
    return <div
        style={{ marginLeft: `${depth * 8}px` }}
        className={
            classNames('tree-toggler-container', 'codicon', {
                'codicon-chevron-down': item.expanded,
                'codicon-chevron-right': !item.expanded && !item.leaf,
            })} />;
};

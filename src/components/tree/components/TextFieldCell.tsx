/*********************************************************************
 * Copyright (c) 2024 Arm Limited and others
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 *********************************************************************/

import './text-field-cell.css';

import { ReactWrapperProps } from '@microsoft/fast-react-wrapper';
import { TextField } from '@vscode/webview-ui-toolkit';
import { VSCodeTextField } from '@vscode/webview-ui-toolkit/react';
import React from 'react';
import { CDTTreeItem, CDTTreeTableColumn } from '../types';
import { AsEditable, EditableComponentProps, EditableComponentRef, AsTreeTableCell } from './TreeTableCell';

export type VSCodeTextFieldComponent = React.Component<ReactWrapperProps<TextField, { onChange: unknown; onInput: unknown; }>, unknown, unknown> & TextField;

const KEY_CHANGE_VALUE = [
    'Enter'
];

const KEY_UNSELECT = [
    'ArrowUp',
    'ArrowDown',
    'PageDown',
    'PageUp',
    'Escape'
];

export interface TextFielCellProps extends EditableComponentProps {
    row: CDTTreeItem;
    cell: CDTTreeTableColumn;
}

const TextFieldComponent = React.forwardRef<EditableComponentRef, TextFielCellProps>(({ row, cell, ...props }, ref) => {
    const textFieldRef = React.useRef<VSCodeTextFieldComponent>(null);

    React.useImperativeHandle(ref, () => ({
        focus: () => {
            textFieldRef.current?.control.select();
        }
    }));

    const onKeyDown = (event: React.KeyboardEvent) => {
        event.stopPropagation();

        if (KEY_CHANGE_VALUE.includes(event.key)) {
            const element = event.currentTarget as HTMLInputElement;
            props.onSubmitValue(element.value);
        }
        if (KEY_UNSELECT.includes(event.key)) {
            props.onCancelEdit();
        }
    };


    return <VSCodeTextField
        ref={textFieldRef}
        className='text-field-cell'
        id={`${row.id}-text-field`}
        initialValue={cell.value}
        value={cell.value}
        onKeyDown={event => onKeyDown(event)}
        onClick={event => event.stopPropagation()}
        onBlur={props.onCancelEdit}
    />;
});

export const TextFieldCell = AsEditable(AsTreeTableCell(TextFieldComponent));

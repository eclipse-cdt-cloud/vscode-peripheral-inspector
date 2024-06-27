/*********************************************************************
 * Copyright (c) 2024 Arm Limited and others
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 *********************************************************************/

import React, { HTMLAttributes } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../tooltip/tooltip';
import { AsTreeTableCellProps, AsTreeTableCell } from './TreeTableCell';
import { createHighlightedText } from './utils';
import { classNames } from 'primereact/utils';

export interface LabelProps extends AsTreeTableCellProps, HTMLAttributes<HTMLElement> {
}

const Label: React.FC<LabelProps> = React.forwardRef<HTMLDivElement, LabelProps>(({ row: _r, cell, expander: _e, ...props }, ref) => {
    const text = createHighlightedText(cell.value, cell.highlight);
    const label = <div {...props} ref={ref} className={classNames('tree-label', props.className)}>
        {text}
    </div>;

    if (cell.tooltip === undefined) {
        return label;
    }

    return <Tooltip>
        <TooltipTrigger>{label}</TooltipTrigger>
        <TooltipContent><Markdown className="markdown" remarkPlugins={[remarkGfm]}>{cell.tooltip}</Markdown></TooltipContent>
    </Tooltip>;
});

export const LabelCell = AsTreeTableCell<LabelProps>(Label);

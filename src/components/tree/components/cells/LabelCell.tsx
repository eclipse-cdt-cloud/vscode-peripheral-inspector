import React from 'react';
import classNames from 'classnames';
import { CDTTreeTableStringColumn, CDTTreeItem, CDTTreeItemResource } from '../../types';
import { createLabelWithTooltip, createHighlightedText } from '../utils';

export interface LabelCellProps<T extends CDTTreeItemResource> {
    column: CDTTreeTableStringColumn;
    record: CDTTreeItem<T>;
}

const LabelCell = <T extends CDTTreeItemResource>({ column }: LabelCellProps<T>) => {
    const icon = column.icon && <i className={classNames('cell-icon', column.icon)} />;

    const content = column.tooltip
        ? createLabelWithTooltip(<span>{createHighlightedText(column.label, column.highlight)}</span>, column.tooltip)
        : createHighlightedText(column.label, column.highlight);

    return (
        <div className="tree-cell ant-table-cell-ellipsis" tabIndex={0}>
            {icon}
            {content}
        </div>
    );
};

export default React.memo(LabelCell);

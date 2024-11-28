/********************************************************************************
 * Copyright (C) 2024 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import { AccessType } from '../../../api-types';
import { CommandDefinition } from '../../../common';
import { formatValue, NumberFormat } from '../../../common/format';
import { PeripheralClusterNode, PeripheralFieldNode, PeripheralFieldNodeContextValue, PeripheralNode, PeripheralRegisterNode, PeripheralTreeNode } from '../../../common/peripherals';
import { Commands } from '../../../manifest';
import { binaryFormat, extractBits, hexFormat } from '../../../utils';
import { CDTTreeItem, CDTTreeTableActionColumnCommand, CDTTreeTableColumn } from '../types';
import { TreeResourceConverter, TreeConverterContext, TreeResourceListConverter } from './tree-converter';


export class PeripheralTreeConverter implements TreeResourceListConverter<PeripheralTreeNode> {

    protected converters: TreeResourceConverter<PeripheralTreeNode>[] = [
        new PeripheralNodeConverter(),
        new PeripheralClusterNodeConverter(),
        new PeripheralFieldNodeConverter(),
        new PeripheralRegisterNodeConverter()];

    canHandle(resource: PeripheralTreeNode): boolean {
        return this.converters.some(c => c.canHandle(resource));
    }

    convertList(resources: PeripheralTreeNode[], context: TreeConverterContext<PeripheralTreeNode>): CDTTreeItem<PeripheralTreeNode>[] {
        const items: CDTTreeItem<PeripheralTreeNode>[] = [];

        for (const resource of resources) {
            items.push(this.convert(resource, context));
        }

        return items;
    }

    convert(resource: PeripheralTreeNode, context: TreeConverterContext<PeripheralTreeNode>): CDTTreeItem<PeripheralTreeNode> {
        const converter = this.converters.find(c => c.canHandle(resource));
        if (converter) {
            context.resourceMap.set(resource.id, resource);
            const item = converter.convert(resource, context);

            if (resource.children) {
                const items = this.convertList(resource.children, context);
                item.children = items;
            }

            return item;
        }

        throw new Error('No converter found for peripheral: ' + resource.__type);

    }
}

export class PeripheralNodeConverter implements TreeResourceConverter<PeripheralNode, PeripheralTreeNode> {
    canHandle(resource: PeripheralTreeNode): boolean {
        return PeripheralNode.is(resource);
    }

    convert(resource: PeripheralNode, context: TreeConverterContext<PeripheralTreeNode>): CDTTreeItem<PeripheralNode> {
        return CDTTreeItem.create({
            id: resource.id,
            key: resource.id,
            parentId: resource.parentId,
            resource,
            expanded: context.expandedKeys.includes(resource.id),
            pinned: context.pinnedKeys.includes(resource.id),
            pinnable: true,
            columns: this.getColumns(resource, context),
        });
    }

    // ==== Rendering ====

    private getColumns(resource: PeripheralNode, context: TreeConverterContext<PeripheralTreeNode>): Record<string, CDTTreeTableColumn> {
        const value = formatValue(resource.baseAddress, 8, resource.format);

        return {
            'title': {
                type: 'string',
                icon: context.pinnedKeys.includes(resource.id) ? 'codicon codicon-pinned' : undefined,
                label: resource.name,
                tooltip: resource.description,
            },
            'value': {
                type: 'string',
                label: value,
                tooltip: value
            },
            'actions': {
                type: 'action',
                commands: [Commands.FORCE_REFRESH_COMMAND]
            }
        };
    }
}

export class PeripheralRegisterNodeConverter implements TreeResourceConverter<PeripheralRegisterNode> {
    canHandle(resource: PeripheralTreeNode): boolean {
        return PeripheralRegisterNode.is(resource);
    }

    convert(resource: PeripheralRegisterNode, context: TreeConverterContext<PeripheralTreeNode>): CDTTreeItem<PeripheralRegisterNode> {
        return CDTTreeItem.create({
            id: resource.id,
            key: resource.id,
            parentId: resource.parentId,
            resource,
            expanded: context.expandedKeys.includes(resource.id),
            columns: this.getColumns(resource, context),
        });
    }

    private getCommands(resource: PeripheralRegisterNode, context: TreeConverterContext<PeripheralTreeNode>): CDTTreeTableActionColumnCommand[] {
        const contextValue = resource.accessType === AccessType.ReadWrite ? 'registerRW' : (resource.accessType === AccessType.ReadOnly ? 'registerRO' : 'registerWO');

        const value = this.getValue(resource, context);
        const copyValue: CDTTreeTableActionColumnCommand = {
            ...Commands.COPY_VALUE_COMMAND,
            value,
        };
        const updateNode: CDTTreeTableActionColumnCommand = {
            ...Commands.UPDATE_NODE_COMMAND,
            value
        };

        switch (contextValue) {
            case 'registerRO':
                return [copyValue, Commands.FORCE_REFRESH_COMMAND];
            case 'registerRW':
                return [copyValue, Commands.FORCE_REFRESH_COMMAND, updateNode];
            case 'registerWO':
                return [];
            default:
                return [];
        }
    }

    private hasHighlight(resource: PeripheralRegisterNode): boolean {
        return resource.previousValue !== resource.currentValue;
    }

    private getValue(resource: PeripheralRegisterNode, context: TreeConverterContext<PeripheralTreeNode>): string {
        return this.formatValue(resource, resource.currentValue, PeripheralTreeNode.getFormat(resource.id, context.resourceMap));
    }

    // ==== Rendering ====

    private getColumns(resource: PeripheralRegisterNode, context: TreeConverterContext<PeripheralTreeNode>): Record<string, CDTTreeTableColumn> {
        const value = this.getValue(resource, context);

        return {
            'title': {
                type: 'string',
                label: `${resource.name} @ ${hexFormat(resource.offset, 0)}`,
                tooltip: this.getTooltipMarkdown(resource, context),
            },
            'value': {
                type: 'string',
                label: value,
                tooltip: value,
                highlight: this.hasHighlight(resource) ? [[0, value.length]] : undefined
            },
            'actions': {
                type: 'action',
                commands: this.getCommands(resource, context)
            }
        };
    }

    private formatValue(resource: PeripheralRegisterNode, value: number, format: NumberFormat): string {
        if (resource.accessType === AccessType.WriteOnly) {
            return '(Write Only)';
        }

        return formatValue(value, resource.hexLength, format);
    }

    private getTooltipMarkdown(resource: PeripheralRegisterNode, context: TreeConverterContext<PeripheralTreeNode>): string {
        let mds = '';

        const address = `${hexFormat(resource.address)}`;

        const formattedValue = this.formatValue(resource, resource.currentValue, PeripheralTreeNode.getFormat(resource.id, context.resourceMap));

        const roLabel = resource.accessType === AccessType.ReadOnly ? '(Read Only)' : '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;';

        mds += (`| ${resource.name}@${address} | ${roLabel} | *${formattedValue}* |\n`);
        mds += ('|:---|:---:|---:|\n\n');

        if (resource.accessType !== AccessType.WriteOnly) {
            const resetValue = this.formatValue(resource, resource.resetValue, PeripheralTreeNode.getFormat(resource.id, context.resourceMap));
            mds += (`**Reset Value:** ${resetValue}\n`);
        }

        mds += ('\n____\n\n');
        if (resource.description) {
            mds += (resource.description);
        }

        mds += ('\n_____\n\n');

        // Don't try to display current value table for write only fields
        if (resource.accessType === AccessType.WriteOnly) {
            return mds;
        }

        const hex = this.formatValue(resource, resource.currentValue, NumberFormat.Hexadecimal);
        const decimal = this.formatValue(resource, resource.currentValue, NumberFormat.Decimal);
        const binary = this.formatValue(resource, resource.currentValue, NumberFormat.Binary);

        mds += ('| Hex &nbsp;&nbsp; | Decimal &nbsp;&nbsp; | Binary &nbsp;&nbsp; |\n');
        mds += ('|:---|:---|:---|\n');
        mds += (`| ${hex} &nbsp;&nbsp; | ${decimal} &nbsp;&nbsp; | ${binary} &nbsp;&nbsp; |\n\n`);

        const children = resource.children;
        if (children.length === 0) { return mds; }

        mds += ('**Fields**\n\n');
        mds += ('| Field | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; | Bit-Range | Value |\n');
        mds += ('|:---|:---:|:---|:---|\n');

        const fieldFormatter = new PeripheralFieldNodeConverter();
        children.forEach((field) => {
            const range = fieldFormatter.getRange(field);
            const format =
                field.format !== NumberFormat.Auto ? field.format
                    : resource.format !== NumberFormat.Auto ? resource.format
                        : field.format !== NumberFormat.Auto ? field.format : PeripheralTreeNode.getFormat(resource.id, context.resourceMap);
            const value = fieldFormatter.formatValue(field, field.currentValue, format, true);

            mds += (`| ${field.name} | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; | ${range} | `
                + `${value} |\n`);
        });

        return mds;
    }
}

export class PeripheralClusterNodeConverter {
    canHandle(resource: PeripheralTreeNode): boolean {
        return PeripheralClusterNode.is(resource);
    }

    convert(resource: PeripheralClusterNode, context: TreeConverterContext<PeripheralTreeNode>): CDTTreeItem<PeripheralClusterNode> {
        return CDTTreeItem.create({
            id: resource.id,
            key: resource.id,
            parentId: resource.parentId,
            resource,
            expanded: context.expandedKeys.includes(resource.id),
            columns: this.getColumns(resource, context),
        });
    }

    // ==== Rendering ====

    private getColumns(peripheral: PeripheralClusterNode, _context: TreeConverterContext<PeripheralTreeNode>): Record<string, CDTTreeTableColumn> {
        const labelValue = hexFormat(peripheral.offset, 0);

        return {
            'title': {
                type: 'string',
                label: peripheral.name,
                tooltip: peripheral.description,
            },
            'value': {
                type: 'string',
                label: labelValue,
                tooltip: labelValue
            }
        };
    }
}


export class PeripheralFieldNodeConverter implements TreeResourceConverter<PeripheralFieldNode> {
    canHandle(resource: PeripheralTreeNode): boolean {
        return PeripheralFieldNode.is(resource);
    }

    convert(resource: PeripheralFieldNode, context: TreeConverterContext<PeripheralTreeNode>): CDTTreeItem<PeripheralFieldNode> {
        return CDTTreeItem.create({
            id: resource.id,
            key: resource.id,
            parentId: resource.parentId,
            resource,
            columns: this.getColumns(resource, context),
        });
    }

    // ==== Properties ====

    private isReserved(resource: PeripheralFieldNode): boolean {
        return resource.name.toLowerCase() === 'reserved';
    }

    private getContextValue(resource: PeripheralFieldNode): PeripheralFieldNodeContextValue {
        let context: PeripheralFieldNodeContextValue = 'field';
        if (this.isReserved(resource)) {
            context = 'field-res';
        } else if (resource.accessType === AccessType.ReadOnly) {
            context = 'fieldRO';
        } else if (resource.accessType === AccessType.WriteOnly) {
            context = 'fieldWO';
        }

        return context;
    }

    private getCommands(resource: PeripheralFieldNode, context: TreeConverterContext<PeripheralTreeNode>): CommandDefinition[] {
        const value = this.getValue(resource, context);
        const copyValue: CDTTreeTableActionColumnCommand = {
            ...Commands.COPY_VALUE_COMMAND,
            value
        };
        const updateNode: CDTTreeTableActionColumnCommand = {
            ...Commands.UPDATE_NODE_COMMAND,
            value
        };

        switch (this.getContextValue(resource)) {
            case 'field':
                return [copyValue, updateNode];
            case 'field-res':
                return [];
            case 'fieldRO':
                return [copyValue];
            case 'fieldWO':
                return [updateNode];
            default:
                return [];
        }
    }

    private hasHighlight(resource: PeripheralFieldNode): boolean {
        return resource.previousValue !== resource.currentValue;
    }

    private getValue(resource: PeripheralFieldNode, context: TreeConverterContext<PeripheralTreeNode>): string {
        return this.formatValue(resource, resource.currentValue, PeripheralTreeNode.getFormat(resource.id, context.resourceMap));
    }

    // ==== Rendering ====

    private getColumns(resource: PeripheralFieldNode, context: TreeConverterContext<PeripheralTreeNode>): Record<string, CDTTreeTableColumn> {
        const value = this.getValue(resource, context);

        return {
            'title': {
                type: 'string',
                label: `${resource.name} ${this.getRange(resource)}`,
                tooltip: this.getTooltipMarkdown(resource, context),
            },
            'value': {
                type: 'string',
                label: value,
                highlight: this.hasHighlight(resource) ? [[0, value.length]] : undefined,
                tooltip: value
            },
            'actions': {
                type: 'action',
                commands: this.getCommands(resource, context)
            }
        };
    }

    getRange(peripheral: PeripheralFieldNode): string {
        const rangestart = peripheral.offset;
        const rangeend = peripheral.offset + peripheral.width - 1;
        return `[${rangeend}:${rangestart}]`;
    }

    formatValue(peripheral: PeripheralFieldNode, value: number, format: NumberFormat, includeEnumeration = true): string {
        if (peripheral.accessType === AccessType.WriteOnly) {
            return '(Write Only)';
        }

        let formatted = '';

        switch (format) {
            case NumberFormat.Decimal:
                formatted = value.toString();
                break;
            case NumberFormat.Binary:
                formatted = binaryFormat(value, peripheral.width);
                break;
            case NumberFormat.Hexadecimal:
                formatted = hexFormat(value, Math.ceil(peripheral.width / 4), true);
                break;
            default:
                formatted = peripheral.width >= 4 ? hexFormat(value, Math.ceil(peripheral.width / 4), true) : binaryFormat(value, peripheral.width);
                break;
        }

        if (includeEnumeration && peripheral.enumeration) {
            if (peripheral.enumeration[value]) {
                formatted = `${peripheral.enumeration[value].name} (${formatted})`;
            } else {
                formatted = `Unknown Enumeration (${formatted})`;
            }
        }

        return formatted;
    }

    private getTooltipMarkdown(resource: PeripheralFieldNode, context: TreeConverterContext<PeripheralTreeNode>): string {
        let mds = '';

        const address = `${hexFormat(resource.parentAddress)}${this.getRange(resource)}`;

        if (this.isReserved(resource)) {
            mds += (`| ${resource.name}@${address} | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; | *Reserved* |\n`);
            mds += ('|:---|:---:|---:|');
            return mds;
        }

        const formattedValue = this.formatValue(resource, resource.currentValue, PeripheralTreeNode.getFormat(resource.id, context.resourceMap), true);

        const roLabel = resource.accessType === AccessType.ReadOnly ? '(Read Only)' : '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;';

        mds += (`| ${resource.name}@${address} | ${roLabel} | *${formattedValue}* |\n`);
        mds += ('|:---|:---:|---:|\n\n');

        if (resource.accessType !== AccessType.WriteOnly) {
            const resetValue = this.formatValue(resource, resource.resetValue, PeripheralTreeNode.getFormat(resource.id, context.resourceMap), true);
            mds += (`**Reset Value:** ${resetValue}\n`);
        }

        mds += ('\n____\n\n');
        mds += (resource.description);

        mds += ('\n_____\n\n');

        // Don't try to display current value table for write only fields
        if (resource.accessType === AccessType.WriteOnly) {
            return mds;
        }

        const value = extractBits(resource.currentValue, resource.offset, resource.width);
        const hex = hexFormat(value, Math.ceil(resource.width / 4), true);
        const decimal = value.toString();
        const binary = binaryFormat(value, resource.width);

        if (resource.enumeration) {
            mds += ('| Enumeration Value &nbsp;&nbsp; | Hex &nbsp;&nbsp; | Decimal &nbsp;&nbsp; | Binary &nbsp;&nbsp; |\n');
            mds += ('|:---|:---|:---|:---|\n');
            let ev = 'Unknown';
            if (resource.enumeration[value]) {
                ev = resource.enumeration[value].name;
            }

            mds += (`| ${ev} &nbsp;&nbsp; | ${hex} &nbsp;&nbsp; | ${decimal} &nbsp;&nbsp; | ${binary} &nbsp;&nbsp; |\n\n`);
            if (resource.enumeration[value] && resource.enumeration[value].description) {
                mds += (resource.enumeration[value].description);
            }
        } else {
            mds += ('| Hex &nbsp;&nbsp; | Decimal &nbsp;&nbsp; | Binary &nbsp;&nbsp; |\n');
            mds += ('|:---|:---|:---|\n');
            mds += (`| ${hex} &nbsp;&nbsp; | ${decimal} &nbsp;&nbsp; | ${binary} &nbsp;&nbsp; |\n`);
        }

        return mds;
    }
}

/********************************************************************************
 * Copyright (C) 2024 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import { CDTTreeResourceConverter, CDTTreeConverterContext, CDTTreeItem, CDTTreeTableColumn, EditableData, CDTTreeTableActionColumnCommand, EditableEnumDataOption } from '@eclipse-cdt-cloud/vscode-ui-components';
import { AccessType, IEnumeratedValue } from '../../api-types';
import { PeripheralTreeNodeDTOs, PeripheralBaseNodeDTO, PeripheralSessionNodeDTO, PeripheralNodeDTO, formatValue, PeripheralRegisterNodeDTO, PeripheralRegisterNodeContextValue, NumberFormat, PeripheralClusterNodeDTO, PeripheralFieldNodeDTO, PeripheralFieldNodeContextValue } from '../../common';
import { Commands } from '../../manifest';
import { hexFormat, binaryFormat, extractBits } from '../../utils';
import { CommandDefinition } from '@eclipse-cdt-cloud/vscode-ui-components/lib/vscode/webview-types';

export class PeripheralTreeConverter implements CDTTreeResourceConverter<PeripheralTreeNodeDTOs> {

    protected converters: CDTTreeResourceConverter<PeripheralTreeNodeDTOs>[] = [
        new PeripheralBaseNodeConverter(),
        new PeripheralSessionNodeConverter(),
        new PeripheralNodeConverter(),
        new PeripheralClusterNodeConverter(),
        new PeripheralFieldNodeConverter(),
        new PeripheralRegisterNodeConverter()];

    canHandle(resource: PeripheralTreeNodeDTOs): boolean {
        return this.converters.some(c => c.canHandle(resource));
    }

    convert(resource: PeripheralTreeNodeDTOs, context: CDTTreeConverterContext<PeripheralTreeNodeDTOs>): CDTTreeItem<PeripheralTreeNodeDTOs> {
        const converter = this.converters.find(c => c.canHandle(resource));
        if (converter) {
            context.assignedResources[resource.id] = resource;
            const item = converter.convert(resource, context);
            context.assignedItems[item.id] = item;
            if (item.expanded) {
                context.expandedKeys.push(item.id);
            }
            if (item.pinned) {
                context.pinnedKeys.push(item.id);
            }

            if (resource.children) {
                const items: CDTTreeItem<PeripheralTreeNodeDTOs>[] = [];

                for (const child of resource.children) {
                    items.push(this.convert(child, {
                        ...context,
                        parent: item
                    }));
                }

                item.children = items;
            }

            return item;
        }

        throw new Error(`No converter found for peripheral: ${resource.__type}, ${JSON.stringify(resource)}`);
    }
}

export class PeripheralBaseNodeConverter implements CDTTreeResourceConverter<PeripheralBaseNodeDTO, PeripheralTreeNodeDTOs> {
    canHandle(resource: PeripheralTreeNodeDTOs): boolean {
        return PeripheralBaseNodeDTO.is(resource);
    }

    convert(resource: PeripheralBaseNodeDTO, context: CDTTreeConverterContext<PeripheralTreeNodeDTOs>): CDTTreeItem<PeripheralBaseNodeDTO> {
        return CDTTreeItem.create({
            id: resource.id,
            key: resource.id,
            parent: context.parent,
            resource,
            expanded: resource.expanded,
            columns: this.getColumns(resource),
        });
    }

    // ==== Rendering ====

    private getColumns(resource: PeripheralBaseNodeDTO): Record<string, CDTTreeTableColumn> {
        return {
            'title': {
                type: 'string',
                label: resource.name,
                colSpan: 'fill'
            },
        };
    }
}

export class PeripheralSessionNodeConverter implements CDTTreeResourceConverter<PeripheralSessionNodeDTO, PeripheralTreeNodeDTOs> {
    canHandle(resource: PeripheralTreeNodeDTOs): boolean {
        return PeripheralSessionNodeDTO.is(resource);
    }

    convert(resource: PeripheralSessionNodeDTO, context: CDTTreeConverterContext<PeripheralTreeNodeDTOs>): CDTTreeItem<PeripheralSessionNodeDTO> {
        return CDTTreeItem.create({
            id: resource.id,
            key: resource.id,
            parent: context.parent,
            resource,
            expanded: resource.expanded,
            columns: this.getColumns(resource),
        });
    }

    // ==== Rendering ====

    private getColumns(resource: PeripheralSessionNodeDTO): Record<string, CDTTreeTableColumn> {
        return {
            'title': {
                type: 'string',
                label: resource.name,
                colSpan: 'fill'
            },
        };
    }
}

export class PeripheralNodeConverter implements CDTTreeResourceConverter<PeripheralNodeDTO, PeripheralTreeNodeDTOs> {
    canHandle(resource: PeripheralTreeNodeDTOs): boolean {
        return PeripheralNodeDTO.is(resource);
    }

    convert(resource: PeripheralNodeDTO, context: CDTTreeConverterContext<PeripheralTreeNodeDTOs>): CDTTreeItem<PeripheralNodeDTO> {
        return CDTTreeItem.create({
            id: resource.id,
            key: resource.id,
            parent: context.parent,
            resource,
            expanded: resource.expanded,
            pinned: resource.pinned,
            columns: this.getColumns(resource, context),
        });
    }

    // ==== Rendering ====

    private getColumns(resource: PeripheralNodeDTO, _context: CDTTreeConverterContext<PeripheralTreeNodeDTOs>): Record<string, CDTTreeTableColumn> {
        const value = formatValue(resource.baseAddress, 8, resource.format);

        return {
            'title': {
                type: 'string',
                icon: resource.pinned ? 'codicon codicon-pinned' : undefined,
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
                commands: [Commands.FORCE_REFRESH_COMMAND, Commands.EXPORT_NODE_COMMAND]
            }
        };
    }
}

export class PeripheralRegisterNodeConverter implements CDTTreeResourceConverter<PeripheralRegisterNodeDTO> {
    canHandle(resource: PeripheralTreeNodeDTOs): boolean {
        return PeripheralRegisterNodeDTO.is(resource);
    }

    convert(resource: PeripheralRegisterNodeDTO, context: CDTTreeConverterContext<PeripheralTreeNodeDTOs>): CDTTreeItem<PeripheralRegisterNodeDTO> {
        return CDTTreeItem.create({
            id: resource.id,
            key: resource.id,
            parent: context.parent,
            resource,
            expanded: resource.expanded,
            columns: this.getColumns(resource, context),
        });
    }

    private getContextValue(resource: PeripheralRegisterNodeDTO): PeripheralRegisterNodeContextValue {
        return resource.accessType === AccessType.ReadWrite ? 'registerRW' : (resource.accessType === AccessType.ReadOnly ? 'registerRO' : 'registerWO');

    }

    private getCommands(resource: PeripheralRegisterNodeDTO, contextValue: string, edit: EditableData | undefined, context: CDTTreeConverterContext<PeripheralTreeNodeDTOs>): CDTTreeTableActionColumnCommand[] {
        const value = this.getValue(resource, context);
        const commands: CDTTreeTableActionColumnCommand[] = [];
        commands.push({ ...Commands.COPY_VALUE_COMMAND, value });
        commands.push(Commands.FORCE_REFRESH_COMMAND);
        if (edit?.type === 'text') {
            commands.push({ ...Commands.UPDATE_NODE_COMMAND, value });
        }
        commands.push(Commands.EXPORT_NODE_COMMAND);
        return commands;
    }

    private hasHighlight(resource: PeripheralRegisterNodeDTO): boolean {
        return resource.previousValue !== resource.currentValue;
    }

    private getValue(resource: PeripheralRegisterNodeDTO, context: CDTTreeConverterContext<PeripheralTreeNodeDTOs>): string {
        return this.formatValue(resource, resource.currentValue, PeripheralTreeNodeDTOs.getFormat(resource.id, context.assignedResources));
    }

    private isEditable(contextValue: PeripheralRegisterNodeContextValue): boolean {
        return contextValue === 'registerRW';
    }

    private getEdit(_resource: PeripheralRegisterNodeDTO, value: string): EditableData | undefined {
        return { type: 'text', value };
    }

    // ==== Rendering ====

    private getColumns(resource: PeripheralRegisterNodeDTO, context: CDTTreeConverterContext<PeripheralTreeNodeDTOs>): Record<string, CDTTreeTableColumn> {
        const value = this.getValue(resource, context);
        const contextValue = this.getContextValue(resource);
        const edit = this.isEditable(contextValue) ? this.getEdit(resource, value) : undefined;
        const commands = this.getCommands(resource, contextValue, edit, context);

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
                highlight: this.hasHighlight(resource) ? [[0, value.length]] : undefined,
                edit
            },
            'actions': {
                type: 'action',
                commands
            }
        };
    }

    private formatValue(resource: PeripheralRegisterNodeDTO, value: number, format: NumberFormat): string {
        if (resource.accessType === AccessType.WriteOnly) {
            return '(Write Only)';
        }

        return formatValue(value, resource.hexLength, format);
    }

    private getTooltipMarkdown(resource: PeripheralRegisterNodeDTO, context: CDTTreeConverterContext<PeripheralTreeNodeDTOs>): string {
        let mds = '';

        const address = `${hexFormat(resource.address)}`;
        const formattedValue = this.formatValue(resource, resource.currentValue, PeripheralTreeNodeDTOs.getFormat(resource.id, context.assignedResources));
        const roLabel = resource.accessType === AccessType.ReadOnly ? '(Read Only)' : undefined;

        mds += `**${resource.name}@${address}**${roLabel ? ` ${roLabel}` : ''}\n\n`;
        mds += `**Value:** ${formattedValue}\n\n`;

        if (resource.accessType !== AccessType.WriteOnly) {
            const resetValue = this.formatValue(resource, resource.resetValue, PeripheralTreeNodeDTOs.getFormat(resource.id, context.assignedResources));
            mds += `**Reset Value:** ${resetValue}\n`;
        }

        mds += '\n____\n\n';
        if (resource.description) {
            mds += resource.description;
            mds += '\n_____\n\n';
        }

        // Don't try to display current value table for write only fields
        if (resource.accessType === AccessType.WriteOnly) {
            return mds;
        }

        const hex = this.formatValue(resource, resource.currentValue, NumberFormat.Hexadecimal);
        const decimal = this.formatValue(resource, resource.currentValue, NumberFormat.Decimal);
        const binary = this.formatValue(resource, resource.currentValue, NumberFormat.Binary);

        mds += '| Format | |\n';
        mds += '| :--- | :--- |\n';
        mds += `| Hex | ${hex} |\n`;
        mds += `| Decimal |  ${decimal} |\n`;
        mds += `| Binary | ${binary} |\n`;
        mds += ('\n_____\n\n');

        const children = resource.children;
        if (children.length === 0) { return mds; }

        mds += '| Field | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; | Bit-Range | Value |\n';
        mds += '|:---|:---:|:---|:---|\n';

        const fieldFormatter = new PeripheralFieldNodeConverter();
        children.forEach((field) => {
            const range = fieldFormatter.getRange(field);
            const format =
                field.format !== NumberFormat.Auto ? field.format
                    : resource.format !== NumberFormat.Auto ? resource.format
                        : field.format !== NumberFormat.Auto ? field.format : PeripheralTreeNodeDTOs.getFormat(resource.id, context.assignedResources);
            const value = fieldFormatter.formatValue(field, field.currentValue, format, true);

            mds += `| ${field.name} | &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; | ${range} | `
                + `${value} |\n`;
        });

        return mds;
    }
}

export class PeripheralClusterNodeConverter {
    canHandle(resource: PeripheralTreeNodeDTOs): boolean {
        return PeripheralClusterNodeDTO.is(resource);
    }

    convert(resource: PeripheralClusterNodeDTO, context: CDTTreeConverterContext<PeripheralTreeNodeDTOs>): CDTTreeItem<PeripheralClusterNodeDTO> {
        return CDTTreeItem.create({
            id: resource.id,
            key: resource.id,
            parent: context.parent,
            resource,
            expanded: resource.expanded,
            columns: this.getColumns(resource, context),
        });
    }

    // ==== Rendering ====

    private getCommands(): CDTTreeTableActionColumnCommand[] {

        return [Commands.EXPORT_NODE_COMMAND];
    }

    private getColumns(peripheral: PeripheralClusterNodeDTO, _context: CDTTreeConverterContext<PeripheralTreeNodeDTOs>): Record<string, CDTTreeTableColumn> {
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
            },
            'actions': {
                type: 'action',
                commands: this.getCommands()
            }
        };
    }
}


export class PeripheralFieldNodeConverter implements CDTTreeResourceConverter<PeripheralFieldNodeDTO> {
    canHandle(resource: PeripheralTreeNodeDTOs): boolean {
        return PeripheralFieldNodeDTO.is(resource);
    }

    convert(resource: PeripheralFieldNodeDTO, context: CDTTreeConverterContext<PeripheralTreeNodeDTOs>): CDTTreeItem<PeripheralFieldNodeDTO> {
        return CDTTreeItem.create({
            id: resource.id,
            key: resource.id,
            parent: context.parent,
            resource,
            columns: this.getColumns(resource, context),
        });
    }

    // ==== Properties ====

    private isReserved(resource: PeripheralFieldNodeDTO): boolean {
        return resource.name.toLowerCase() === 'reserved';
    }

    private getContextValue(resource: PeripheralFieldNodeDTO): PeripheralFieldNodeContextValue {
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

    private getCommands(resource: PeripheralFieldNodeDTO, contextValue: PeripheralFieldNodeContextValue, edit: EditableData | undefined, context: CDTTreeConverterContext<PeripheralTreeNodeDTOs>): CommandDefinition[] {
        const value = this.getValue(resource, context);
        const commands: CDTTreeTableActionColumnCommand[] = [];
        if (this.isCopyable(contextValue)) {
            commands.push({ ...Commands.COPY_VALUE_COMMAND, value });
        }
        if (edit?.type === 'text') {
            commands.push({ ...Commands.UPDATE_NODE_COMMAND, value });
        }
        return commands;
    }

    private hasHighlight(resource: PeripheralFieldNodeDTO): boolean {
        return resource.previousValue !== resource.currentValue;
    }

    private getValue(resource: PeripheralFieldNodeDTO, context: CDTTreeConverterContext<PeripheralTreeNodeDTOs>): string {
        return this.formatValue(resource, resource.currentValue, PeripheralTreeNodeDTOs.getFormat(resource.id, context.assignedResources));
    }

    private isCopyable(contextValue: PeripheralFieldNodeContextValue): boolean {
        return contextValue === 'field' || contextValue === 'fieldRO';
    }

    private isEditable(contextValue: PeripheralFieldNodeContextValue): boolean {
        return contextValue === 'field' || contextValue === 'fieldWO';
    }

    private getEdit(resource: PeripheralFieldNodeDTO, value: string, context: CDTTreeConverterContext<PeripheralTreeNodeDTOs>): EditableData | undefined {
        if (resource.enumeration) {
            return {
                type: 'enum',
                options: Object.values(resource.enumeration ?? {}).map<EditableEnumDataOption>((value: IEnumeratedValue) => ({
                    value: value.name,
                    label: this.formatLabel(resource, value.value, PeripheralTreeNodeDTOs.getFormat(resource.id, context.assignedResources))
                })),
                value: resource.enumeration[resource.currentValue]?.name ?? value
            };
        }
        if (resource.width === 1) {
            return { type: 'boolean', value: resource.currentValue === 0 ? '0' : '1' };
        }
        return { type: 'text', value: resource.accessType === AccessType.WriteOnly ? '' : value };
    }

    // ==== Rendering ====

    private getColumns(resource: PeripheralFieldNodeDTO, context: CDTTreeConverterContext<PeripheralTreeNodeDTOs>): Record<string, CDTTreeTableColumn> {
        const value = this.getValue(resource, context);
        const contextValue = this.getContextValue(resource);
        const edit = this.isEditable(contextValue) ? this.getEdit(resource, value, context) : undefined;
        const commands = this.getCommands(resource, contextValue, edit, context);

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
                tooltip: value,
                edit
            },
            'actions': {
                type: 'action',
                commands
            }
        };
    }

    getRange(peripheral: PeripheralFieldNodeDTO): string {
        const rangestart = peripheral.offset;
        const rangeend = peripheral.offset + peripheral.width - 1;
        return `[${rangeend}:${rangestart}]`;
    }

    formatValue(peripheral: PeripheralFieldNodeDTO, value: number, format: NumberFormat, includeEnumeration = true): string {
        return peripheral.accessType === AccessType.WriteOnly ? '(Write Only)' : this.formatLabel(peripheral, value, format, includeEnumeration);
    }

    formatLabel(peripheral: PeripheralFieldNodeDTO, value: number, format: NumberFormat, includeEnumeration = true): string {
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
                const description = peripheral.enumeration[value].description;
                formatted = `${peripheral.enumeration[value].name} (${formatted})${description ? ': ' + description : ''}`;
            } else {
                formatted = `Unknown Enumeration (${formatted})`;
            }
        }
        return formatted;
    }

    private getTooltipMarkdown(resource: PeripheralFieldNodeDTO, context: CDTTreeConverterContext<PeripheralTreeNodeDTOs>): string {
        let mds = '';

        const address = `${hexFormat(resource.parentAddress)}${this.getRange(resource)}`;

        if (this.isReserved(resource)) {
            mds += `${resource.name}@${address} (*Reserved*)\n`;
            return mds;
        }

        const formattedValue = this.formatValue(resource, resource.currentValue, PeripheralTreeNodeDTOs.getFormat(resource.id, context.assignedResources), true);
        const roLabel = resource.accessType === AccessType.ReadOnly ? '(Read Only)' : undefined;

        mds += `**${resource.name}@${address}**${roLabel ? ` ${roLabel}` : ''}\n\n`;
        mds += `**Value:** ${formattedValue}\n\n`;

        if (resource.accessType !== AccessType.WriteOnly) {
            const resetValue = this.formatValue(resource, resource.resetValue, PeripheralTreeNodeDTOs.getFormat(resource.id, context.assignedResources), true);
            mds += `**Reset Value:** ${resetValue}\n`;
        }

        mds += '\n____\n\n';
        mds += resource.description;
        mds += '\n_____\n\n';

        // Don't try to display current value table for write only fields
        if (resource.accessType === AccessType.WriteOnly) {
            return mds;
        }

        const value = extractBits(resource.currentValue, resource.offset, resource.width);
        const hex = hexFormat(value, Math.ceil(resource.width / 4), true);
        const decimal = value.toString();
        const binary = binaryFormat(value, resource.width);

        if (resource.enumeration) {
            let enumerationName = 'Unknown';
            let enumerationDescription: string | undefined = undefined;
            if (resource.enumeration[value]) {
                enumerationName = resource.enumeration[value].name;
                enumerationDescription = resource.enumeration[value].description;
            }

            mds += '| Format | |\n';
            mds += '| :--- | :--- |\n';
            mds += `| Enumeration | ${enumerationName} |\n`;
            mds += `| Hex | ${hex} |\n`;
            mds += `| Decimal |  ${decimal} |\n`;
            mds += `| Binary | ${binary} |\n\n`;

            if (enumerationDescription) {
                mds += (resource.enumeration[value].description);
            }
        } else {
            mds += '| Format &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; | |\n';
            mds += '| :--- | :--- |\n';
            mds += `| Hex | ${hex} |\n`;
            mds += `| Decimal |  ${decimal} |\n`;
            mds += `| Binary | ${binary} |\n`;
        }

        return mds;
    }
}

/********************************************************************************
 * Copyright (C) 2024 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import { PeripheralNodeDTO } from './peripheral-dto';

export namespace PeripheralNodeSort {

    export type ComparableTypes = Pick<PeripheralNodeDTO, 'pinned' | 'groupName' | 'name'>
    export function compare(p1: ComparableTypes, p2: ComparableTypes): number {
        if ((p1.pinned && p2.pinned) || (!p1.pinned && !p2.pinned)) {
            // none or both peripherals are pinned, sort by name prioritizing groupname
            if (p1.groupName !== p2.groupName) {
                return p1.groupName > p2.groupName ? 1 : -1;
            } else if (p1.name !== p2.name) {
                return p1.name > p2.name ? 1 : -1;
            } else {
                return 0;
            }
        } else {
            return p1.pinned ? -1 : 1;
        }
    }
}

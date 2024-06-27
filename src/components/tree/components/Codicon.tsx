/*********************************************************************
 * Copyright (c) 2024 Arm Limited and others
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 *********************************************************************/

import React from 'react';


export interface CodiconProps {
    icon: string;
}

export const Codicon: React.FC<CodiconProps> = ({ icon }) => {
    return <i className={`codicon codicon-${icon}`} style={{ marginRight: '0.5rem' }}></i>;

};

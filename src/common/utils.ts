/********************************************************************************
 * Copyright (C) 2024 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

/**
 * Get a nested value from an object using a dot-separated path.
 */
export function getNestedValue<T>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    obj: Record<string, any>,
    path: string | string[],
): T {
    const keys = Array.isArray(path) ? path : path.split('.');
    const value = keys.reduce((acc, key) => acc?.[key], obj) as T;

    if (value === undefined) {
        throw new Error(`Value not found at path: ${path}`);
    }

    return value;
}

/**
 * Check if an object has a property.
 */
export function hasProperty<TKey extends object>(object: object, ...keys: (keyof TKey)[]): object is TKey {
    return keys.every(key => key in object);
}

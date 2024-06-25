/*********************************************************************
 * Copyright (c) 2024 Arm Limited and others
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE File
 ********************************************************************************/

import { VSCodeButton } from '@vscode/webview-ui-toolkit/react';
import React from 'react';
import './search.css';

export interface SearchOverlayProps {
    onChange?: (text: string) => void;
    onShow?: () => void;
    onHide?: () => void;
}

export interface SearchOverlay {
    focus: () => void;
    value(): string;
    setValue: (value: string) => void;
    show: () => void;
    hide: () => void;
}

export const SearchOverlay = React.forwardRef<SearchOverlay, SearchOverlayProps>((props, ref) => {
    const [showSearch, setShowSearch] = React.useState(false);
    const searchTextRef = React.useRef<HTMLInputElement>(null);
    const previousFocusedElementRef = React.useRef<HTMLElement | null>(null);

    const show = () => {
        previousFocusedElementRef.current = document.activeElement as HTMLElement;
        setShowSearch(true);
        setTimeout(() => searchTextRef.current?.select(), 100);
        props.onShow?.();
    };

    const hide = () => {
        setShowSearch(false);
        props.onHide?.();
        if (previousFocusedElementRef.current) {
            previousFocusedElementRef.current.focus();
        }
    };

    const onTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        props.onChange?.(value);
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.ctrlKey && e.key === 'f') {
            e.preventDefault();
            e.stopPropagation();
            show();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            hide();
        }
    };

    const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        if (e.relatedTarget) {
            previousFocusedElementRef.current = e.relatedTarget as HTMLElement;
        }
    };

    React.useImperativeHandle(ref, () => ({
        focus: () => searchTextRef.current?.focus(),
        value: () => searchTextRef.current?.value ?? '',
        setValue: (newValue: string) => {
            if (searchTextRef.current) {
                searchTextRef.current.value = newValue;
            }
        },
        show: () => show(),
        hide: () => hide()
    }));

    return (<div className={showSearch ? 'search-overlay visible' : 'search-overlay'} onKeyDown={onKeyDown}>
        <input ref={searchTextRef} onChange={onTextChange} onFocus={onFocus} placeholder="Find" className="search-input" />
        <VSCodeButton title='Close (Escape)' appearance='icon' aria-label='Close (Escape)'><span className='codicon codicon-close' onClick={() => hide()} /></VSCodeButton>
    </div>
    );
});

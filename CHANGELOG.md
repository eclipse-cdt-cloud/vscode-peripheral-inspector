# Change Log

## [v1.6.0] - 2025-02-06

### New Features

- Allow use of Peripheral Inspector in SSH remote scenario. ([Rob Moran](https://github.com/thegecko)).
- Updated Peripheral Inspector to use [Ant Design](https://ant.design/docs/react/introduce/) React UI library ([Haydar Metin](https://github.com/haydar-metin), [Martin Fleck](https://github.com/martin-fleck-at), and others)
- Added `Export Registers` functionality ([QuocTrung76](https://github.com/QuocTrung76))
- Added `Search` functionality ([Martin Fleck](https://github.com/martin-fleck-at))
- Added `Peripheral-inspector: Ignore Peripherals` extension setting to hide peripherals and skip reading their registers. Also added context menu entries to add and clear the setting on workspace level from the Peripheral Inspector view ([Haydar Metin](https://github.com/haydar-metin))

### Other Changes

- Updated extension logo.

### Known Issue

- As a side effect of moving to a custom Webview implementation, the Peripheral Inspector may show the following message when launched after update from a previous version:<br>
`There is no data provider registered that can provide view data.`<br>
***Solution***: Please restart your IDE after the update installation to overcome this problem. Restarting the extension may not be sufficient.

## [v1.5.1] - 2023-12-13

### Bug Fixes

- Fixed duplicate insertion of nodes ([Asim Gunes](https://github.com/asimgunes))

## [v1.5.0] - 2023-12-09

### New Features

- Added support for non-svd peripheral definition files ([Asim Gunes](https://github.com/asimgunes))

## [v1.4.0] - 2023-11-27

### New Features

- Renamed to peripheral-inspector

## [v1.3.0] - 2023-10-21

### New Features

- Synced with peripheral-viewer

## [v1.1.1] - 2023-01-30

### New Features

- Refresh codebase on [cortex-debug#56c03f](https://github.com/Marus/cortex-debug/commit/056c03f01e008828e6527c571ef5c9adaf64083f) (2023-01-23)
- Add support for loading SVD files from CMSIS pack asset API ([Rob Moran](https://github.com/thegecko))

## [v1.0.4] - 2022-09-05

### New Features

- Initial standalone release ([Rob Moran](https://github.com/thegecko))
- Browser support ([Rob Moran](https://github.com/thegecko))
- Support any debug adapter (using `readMemory` and `writeMemory` DAP commands) ([Rob Moran](https://github.com/thegecko))

# Extending Peripheral Inspector

It is possible to extend the Peripheral Inspector with new file extension providers in your VSCode extension. This method will provide reading new file formats and load the peripherals information into the Peripheral Inspector.

## Building your VSCode Extension to extend Peripheral Inspector

This is a guide about how you can register new peripheral providers to Peripheral Inspector in your VSCode extension. Please refer to [VSCode Extension API](https://code.visualstudio.com/api) for more information about developing VSCode extensions.

### Adding Peripheral Inspector to your VSCode extension

You need to install eclipse-cdt-cloud/vscode-peripheral-inspector to access the types information. You can use `npm` or `yarn` with the following arguments described below:

Using with npm:
```bash
npm install github:eclipse-cdt-cloud/vscode-peripheral-inspector
```
Using with yarn:
```bash
yarn add github:eclipse-cdt-cloud/vscode-peripheral-inspector
```

### Developing your extension

To provide the peripherals information to Peripheral Inspector on debug session time, you need register your command which is going to construct the peripherals information.
The command will receive `DebugSession` object as an input parameter and expects to return array of type `PeripheralOptions[]`.

You can find the example command implementation below:

```js
import { ExtensionContext } from 'vscode';
import type * as api from "peripheral-inspector/api";


class MyExtensionProvider implements api.IPeripheralsProvider {
    public async getPeripherals (data: string, options: api.IGetPeripheralsArguments): Promise<api.PeripheralOptions[]> {
        // Load your peripherals data
        const peripherals: api.PeripheralOptions[] = ...
        return peripherals;
    }
}

export async function activate(context: ExtensionContext) {
    ...
    // Get the eclipse-cdt.peripheral-inspector extension
    const peripheralInspectorExtension = extensions.getExtension<api.IPeripheralInspectorAPI>('eclipse-cdt.peripheral-inspector');

    // Check if the eclipse-cdt.peripheral-inspector extension is installed
    if (peripheralInspectorExtension) {
        const peripheralInspectorAPI = await peripheralInspectorExtension.activate();

        // Invoke registerPeripheralsProvider method in eclipse-cdt.peripheral-inspector extension api
        // Register 'MyExtensionProvider' for files *.myext
        peripheralInspectorAPI.registerPeripheralsProvider('myext', new MyExtensionProvider());
    }
    ...
}
```

Alternatively, you also use the extension API to extract information from parsed SVD files:
- See the implementation of the [Print Interrupt Table (Extension API)](../src/test-commands/print-api-interrupt-table.ts) test command for an example how to get the
interrupt table for an SVD.

For further information about the api definitions, review the [Peripheral Inspector API Definitions](../src/api-types.ts).

### Modifying your package.json

In `package.json` of your VSCode extension project, you need to define the dependency between Peripheral Inspector and your extension. 

You need to define Peripheral Inspector in the `extensionDependencies` as shown below:

```json
{
  ...
  "extensionDependencies": [
    "eclipse-cdt.peripheral-inspector"
  ],
  ...
}
```

# Template Forge

<div align="center">
  <img src="https://github.com/KebinSuzuki/Template-Forge/blob/dev/icons/hammer-drop.png" alt="Template Forge Icon" width="128" />
</div>

**Template Forge** is a VS Code extension designed to streamline your project creation and maintenance workflow by leveraging customizable templates. Whether you're bootstrapping a brand-new Next.js app or extracting reusable components from an existing project, Template Forge automates repetitive tasks, enforces consistency, and keeps your templates up to date.

>[!NOTE]
>Current Version: 1.4 only works with Next.js apps

## Features

- **Template Forge: Create from template**  
  Generate a new project from a saved JSON template with a single command.
  
- **Template Forge: Extract components** 
  Easily extract components and other project artifacts into your template configuration—complete with dependency detection and alias resolution.
  
- **Dependency Management:**  
  Detect external dependencies (excluding built-in Next.js components) and add them to your template’s dependency list for automatic installation.
  
- **Customizable Configuration:**  
  Set default project paths and other settings to tailor the extension to your workflow.
  
- **Manage Templates:**  
  Delete templates, open templates to view their contents, and remove components or folders from your template configuration.

## Installation

1. **Install from the VS Code Marketplace:**  
   Search for **Template Forge** in the Extensions view (`Ctrl+Shift+X`) and click **Install**.
2. **Or install manually:**  
   Clone this repository and run `npm install` or `yarn` to install dependencies. Then compile the extension using `yarn compile` or `npm run compile`.

## Usage

### Template Forge: Create from template

1. Open the Command Palette (`Ctrl+Shift+P`).
2. Type and select **Template Forge: Create from template**.
3. Enter a project name.
4. Provide the target directory (the extension will use your default if set).
5. Choose a template from the list (the extension reads available JSON templates from its internal folder).
6. Watch as a terminal opens and executes the command to generate your project.

### Template Forge: Extract components

1. Open the Command Palette and select **Template Forge: Extract components**.
2. Enter the file path of the component or artifact you wish to extract.
3. Enter the project root directory (where your `tsconfig.json` or `jsconfig.json` is located).
4. Choose an existing template to update or create a new one.
5. The extension will scan the file, rewrite alias imports, and add any internal dependencies into the template configuration.

### Managing Templates

- **Template Forge: Delete template**  
  Use **Template Forge: Delete Template** to remove an unwanted template.
  
- **Template Forge: Open template**  
  Use **Template Forge: Open Template** to view the contents of a template.
  
- **Template Forge: Delete component from template**  
  Use **Template Forge: Delete Component from template** to remove a specific component or folder from a template configuration.

### Configuration

Template Forge allows you to store your default settings. For example, you can set a default project path:

1. Open the Command Palette and select **Template Forge: Default project path**.
2. Enter the path you wish to use as the default.
3. The extension saves your configuration for future commands.

The configuration file is stored in VS Code’s global storage and follows this simple JSON format:

```json
{
  "defaultProjectPath": "C:\\Projects"
}
```

## Versions
**1.4**  ***Only Works with nextjs apps***

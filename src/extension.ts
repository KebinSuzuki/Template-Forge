import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { loadConfig, setDefaultProjectPath } from './config';

export function activate(context: vscode.ExtensionContext) {
	const disposable = vscode.commands.registerCommand('template-admin.createProject', async () => {
         const config = loadConfig(context);
        // Prompt user for the project name
		const projectName = await vscode.window.showInputBox({
			prompt: 'Enter the project name',
			placeHolder: 'e.g., my-new-project',
		});

		if (!projectName) {
			vscode.window.showErrorMessage('Project name is required!');
			return;
		}

		// Prompt user for the target directory
        const targetDirectory = await vscode.window.showInputBox({
      prompt: 'Enter the target directory',
      placeHolder: 'e.g., C:\\Projects',
      value: config.defaultProjectPath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || ''
        });
        if (!targetDirectory) {
          vscode.window.showErrorMessage('Target directory is required!');
          return;
        }
		// Path to the templates directory
		const templatesDir = path.join(context.extensionPath, 'src', 'templates');
		let templates: string[] = [];
		try {
			// Fetch available templates
			templates = require('fs').readdirSync(templatesDir).filter((file: string) => file.endsWith('.json'));
		} catch (error) {
			vscode.window.showErrorMessage('Failed to load templates directory.');
			return;
		}

		if (templates.length === 0) {
			vscode.window.showErrorMessage('No templates available.');
			return;
		}

		// Show a quick pick to select the template
		const selectedTemplate = await vscode.window.showQuickPick(templates, {
			placeHolder: 'Select a template for your project',
		});

		if (!selectedTemplate) {
			vscode.window.showErrorMessage('Template selection is required!');
			return;
		}
        const cliToSelect = ["yarn", "npm", "pnpm","bun"];

        const cli = await vscode.window.showQuickPick(cliToSelect, {
			placeHolder: 'Select your package manager',
		});

        if (!cli) {
            vscode.window.showErrorMessage('Package manager is required!');
			return;
        }
		// Construct the full path for the project
		const projectPath = path.resolve(targetDirectory, projectName);

		// Path to the `create-project.ts` script
		const scriptPath = path.join(context.extensionPath, 'src', 'create-project.ts');

		// Properly quote the paths to handle spaces
		const quotedScriptPath = `"${scriptPath}"`;
		const quotedProjectPath = `"${projectPath}"`;
		const quotedTemplatePath = `"${path.join(templatesDir, selectedTemplate)}"`;

		// Run the script using ts-node
		const command = `npx ts-node ${quotedScriptPath} ${quotedProjectPath} ${quotedTemplatePath}`;

		// Open a terminal to execute the command
		const terminal = vscode.window.createTerminal('Create Project');
		terminal.show();
		terminal.sendText(command);

		// Notify the user
		vscode.window.showInformationMessage(
			`Executing create-project script for ${projectName} using template ${selectedTemplate}. Check the terminal for progress.`
		);
	});

	const extractFeaturesCommand = vscode.commands.registerCommand('template-admin.extract', async () => {
        const artifactToExtract = await vscode.window.showInputBox({
            prompt: 'Enter the path of the artifact to extract (file to process)',
            placeHolder: 'e.g., C:/documents/project/component/button.tsx',
        });

        if (!artifactToExtract || !fs.existsSync(artifactToExtract)) {
            vscode.window.showErrorMessage('Valid artifact path is required!');
            return;
        }

        const projectRoot = await vscode.window.showInputBox({
            prompt: 'Enter the root path of the project (where tsconfig.json or jsconfig.json is located)',
            placeHolder: 'e.g., C:/documents/project',
        });

        if (!projectRoot || !fs.existsSync(projectRoot)) {
            vscode.window.showErrorMessage('Valid project root path is required!');
            return;
        }

        const templatesDir = path.join(context.extensionPath, 'src', 'templates');
        if (!fs.existsSync(templatesDir)) {
            vscode.window.showErrorMessage('Templates directory not found in the extension.');
            return;
        }

        let templates: string[] = [];
        try {
            templates = fs.readdirSync(templatesDir).filter((file) => file.endsWith('.json'));
        } catch {
            vscode.window.showErrorMessage('Failed to load templates directory.');
            return;
        }

        const selectedTemplate = await vscode.window.showQuickPick([...templates, 'Create New Template'], {
            placeHolder: 'Select a template to update or create a new one',
        });

        if (!selectedTemplate) {
            vscode.window.showErrorMessage('Template selection is required!');
            return;
        }

        let templatePath = '';
        if (selectedTemplate === 'Create New Template') {
            const newTemplateName = await vscode.window.showInputBox({
                prompt: 'Enter the name for the new template (e.g., my-template.json)',
                placeHolder: 'e.g., my-template.json',
            });

            if (!newTemplateName || !newTemplateName.endsWith('.json')) {
                vscode.window.showErrorMessage('Valid template name with .json extension is required!');
                return;
            }

            templatePath = path.join(templatesDir, newTemplateName);
            const defaultTemplate = {
                directories: [],
                files: [],
                dependencies: [],
                packageScripts: {},
            };
            fs.writeFileSync(templatePath, JSON.stringify(defaultTemplate, null, 2), 'utf8');
            vscode.window.showInformationMessage(`New template created: ${newTemplateName}`);
        } else {
            templatePath = path.join(templatesDir, selectedTemplate);
        }

        const scriptPath = path.join(context.extensionPath, 'src', 'extract.ts');
        const command = `npx ts-node "${scriptPath}" "${artifactToExtract}" "${templatePath}" "${projectRoot}"`;

        const terminal = vscode.window.createTerminal('Extract Features');
        terminal.show();
        terminal.sendText(command);

        vscode.window.showInformationMessage(
            `Extracting "${artifactToExtract}" into template "${selectedTemplate}". Check the terminal for progress.`
        );
    });

    const setDefaultPathCommand = vscode.commands.registerCommand('template-admin.config', async () => {
        await setDefaultProjectPath(context);
    });

	context.subscriptions.push(disposable);
	context.subscriptions.push(extractFeaturesCommand);
}

export function deactivate() {}

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Returns the path where templates are stored.
 * Adjust this if your templates are located elsewhere.
 */
function getTemplatesDir(context: vscode.ExtensionContext): string {
  return path.join(context.extensionPath, 'src', 'templates');
}

/**
 * Delete a template file.
 */
export async function deleteTemplate(context: vscode.ExtensionContext) {
  const templatesDir = getTemplatesDir(context);
  const templates = fs.readdirSync(templatesDir).filter(file => file.endsWith('.json'));

  const selected = await vscode.window.showQuickPick(templates, {
    placeHolder: 'Select a template to delete'
  });

  if (!selected) {
    vscode.window.showErrorMessage('No template selected.');
    return;
  }

  const confirm = await vscode.window.showWarningMessage(
    `Are you sure you want to delete template "${selected}"?`,
    { modal: true },
    'Yes'
  );

  if (confirm !== 'Yes') {
    return;
  }

  const templatePath = path.join(templatesDir, selected);
  try {
    fs.unlinkSync(templatePath);
    vscode.window.showInformationMessage(`Template "${selected}" deleted.`);
  } catch (error) {
    vscode.window.showErrorMessage(`Error deleting template: ${error}`);
  }
}

/**
 * Open a template file in the editor.
 */
export async function openTemplate(context: vscode.ExtensionContext) {
  const templatesDir = getTemplatesDir(context);
  const templates = fs.readdirSync(templatesDir).filter(file => file.endsWith('.json'));

  const selected = await vscode.window.showQuickPick(templates, {
    placeHolder: 'Select a template to open'
  });

  if (!selected) {
    vscode.window.showErrorMessage('No template selected.');
    return;
  }

  const templatePath = path.join(templatesDir, selected);
  try {
    const doc = await vscode.workspace.openTextDocument(templatePath);
    vscode.window.showTextDocument(doc);
  } catch (error) {
    vscode.window.showErrorMessage(`Error opening template: ${error}`);
  }
}

/**
 * Delete a component or folder from a template configuration.
 * The template is assumed to be a JSON file with "files" and "directories" arrays.
 */
export async function deleteComponentFromTemplate(context: vscode.ExtensionContext) {
  const templatesDir = getTemplatesDir(context);
  const templates = fs.readdirSync(templatesDir).filter(file => file.endsWith('.json'));

  const selectedTemplate = await vscode.window.showQuickPick(templates, {
    placeHolder: 'Select a template to modify'
  });

  if (!selectedTemplate) {
    vscode.window.showErrorMessage('No template selected.');
    return;
  }

  const templatePath = path.join(templatesDir, selectedTemplate);
  let config;
  try {
    config = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
  } catch (error) {
    vscode.window.showErrorMessage(`Error reading template: ${error}`);
    return;
  }

  // Combine components from "files" and "directories"
  let components: string[] = [];
  if (Array.isArray(config.files)) {
    components = components.concat(config.files.map((f: any) => f.target));
  }
  if (Array.isArray(config.directories)) {
    components = components.concat(config.directories);
  }
  if (components.length === 0) {
    vscode.window.showInformationMessage('This template does not contain any components or directories.');
    return;
  }

  const selectedComponent = await vscode.window.showQuickPick(components, {
    placeHolder: 'Select a component or folder to delete from the template'
  });

  if (!selectedComponent) {
    vscode.window.showErrorMessage('No component selected.');
    return;
  }

  const confirm = await vscode.window.showWarningMessage(
    `Are you sure you want to remove "${selectedComponent}" from the template?`,
    { modal: true },
    'Yes'
  );

  if (confirm !== 'Yes') {
    return;
  }

  // Remove the component from the files array.
  if (Array.isArray(config.files)) {
    config.files = config.files.filter((f: any) => f.target !== selectedComponent);
  }
  // Remove the component from the directories array.
  if (Array.isArray(config.directories)) {
    config.directories = config.directories.filter((d: string) => d !== selectedComponent);
  }

  try {
    fs.writeFileSync(templatePath, JSON.stringify(config, null, 2), 'utf8');
    vscode.window.showInformationMessage(`Component/folder "${selectedComponent}" removed from the template.`);
  } catch (error) {
    vscode.window.showErrorMessage(`Error updating template: ${error}`);
  }
}

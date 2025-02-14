import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// Define an interface for your configuration.
interface TemplateAdminConfig {
  defaultProjectPath: string;
}

// Default configuration values.
const DEFAULT_CONFIG: TemplateAdminConfig = {
  defaultProjectPath: ""
};

// Returns the path to your config file in the global storage directory.
function getConfigFilePath(context: vscode.ExtensionContext): string {
  return path.join(context.globalStoragePath, 'config.json');
}

// Loads the configuration. If not present, creates a new one with the default settings.
export function loadConfig(context: vscode.ExtensionContext): TemplateAdminConfig {
  const configPath = getConfigFilePath(context);
  if (!fs.existsSync(context.globalStoragePath)) {
    fs.mkdirSync(context.globalStoragePath, { recursive: true });
  }
  if (fs.existsSync(configPath)) {
    try {
      const configContent = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(configContent);
    } catch (error) {
      console.error("Error parsing config file:", error);
    }
  }
  // If config doesn't exist (or failed to load), create one with the default settings.
  saveConfig(context, DEFAULT_CONFIG);
  return DEFAULT_CONFIG;
}

// Saves the configuration to disk.
export function saveConfig(context: vscode.ExtensionContext, config: TemplateAdminConfig) {
  const configPath = getConfigFilePath(context);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
}

// Optionally, a helper command to update the defaultProjectPath.
export async function setDefaultProjectPath(context: vscode.ExtensionContext) {
  const currentConfig = loadConfig(context);
  const input = await vscode.window.showInputBox({
    prompt: 'Enter the default project path',
    placeHolder: 'e.g., C:\\Projects',
    value: currentConfig.defaultProjectPath
  });
  if (input) {
    currentConfig.defaultProjectPath = input;
    saveConfig(context, currentConfig);
    vscode.window.showInformationMessage('Default project path updated.');
  }
}

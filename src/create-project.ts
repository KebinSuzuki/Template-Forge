import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as readline from 'readline';

// Helper function to wrap paths in quotes if they contain spaces
function quotePath(inputPath: string | string[]): string {
  return (typeof inputPath === 'string' && inputPath.includes(' '))
    ? `"${inputPath}"`
    : inputPath.toString();
}

// Helper function to prompt user input via the terminal
function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise(resolve => {
    rl.question(query, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  // Get arguments
  const projectPath = process.argv[2];
  const templatePath = process.argv[3];
  const packageManager = process.argv[4];
  if (!projectPath || !templatePath) {
    console.error("Usage: create-project.js <project-path> <template-path>");
    process.exit(1);
  }

  // Validate template path
  if (!fs.existsSync(templatePath)) {
    console.error(`Template file "${templatePath}" not found.`);
    process.exit(1);
  }

  // Load the selected template
  const config = JSON.parse(fs.readFileSync(templatePath, 'utf8'));

  // Normalize the project name (lowercase and replace spaces with hyphens)
  const projectName = path.basename(projectPath)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/--+/g, '-');

  // Step 1: Create the Next.js app
  const createNextAppCmd = `npx create-next-app@latest ${quotePath(projectPath)} --ts --tailwind --eslint --app`;
  console.log("Creating Next.js project...");
  try {
    execSync(createNextAppCmd, { stdio: 'inherit' });
  } catch (error) {
    console.error("Error creating Next.js project:", error);
    process.exit(1);
  }

  // Step 2: Move into the project directory
  try {
    process.chdir(projectPath);
    console.log(`Changed working directory to: ${projectPath}`);
  } catch (error) {
    console.error("Error changing directory:", error);
    process.exit(1);
  }

  // Step 3: Install additional dependencies
  if (config.dependencies && config.dependencies.length > 0) {
    const filteredDependencies = config.dependencies.filter((dep: string) => !dep.startsWith('@/'));
    console.log('Installing additional dependencies...', packageManager);
    try {
      if (packageManager === 'yarn'){
          execSync(`yarn add ${filteredDependencies.join(' ')}`, { stdio: 'inherit' });
      }
      if (packageManager === 'npm'){
          execSync(`npm install ${filteredDependencies.join(' ')}`, { stdio: 'inherit' });
      }
      if (packageManager === 'pnpm'){
          execSync(`pnpm add ${filteredDependencies.join(' ')}`, { stdio: 'inherit' });
      }
      if (packageManager === 'bun'){
          execSync(`npm install ${filteredDependencies.join(' ')}`, { stdio: 'inherit' });
      }
    } catch (error) {
      console.error('Error installing dependencies:', error);
      process.exit(1);
    }
  }

  // Check if the project has a 'src' folder
  const hasSrcFolder = fs.existsSync(path.join(process.cwd(), 'src'));

  // Step 4: Create directories as per the configuration
  if (config.directories && config.directories.length > 0) {
    console.log("Creating directories...");
    for (const dir of config.directories) {
      let targetDir = dir;
      // If the project has a src folder and the directory is not already within 'src/'
      if (hasSrcFolder && !dir.startsWith('src/')) {
        const answer = await askQuestion(
          `Should the directory "${dir}" be created inside the src folder? (y/n): `
        );
        if (answer.toLowerCase().startsWith('y')) {
          targetDir = path.join('src', dir);
        }
      }
      const dirPath = path.join(process.cwd(), targetDir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`Created directory: ${targetDir}`);
      } else {
        console.log(`Directory already exists: ${targetDir}`);
      }
    }
  }

  // Step 5: Create or copy files as per the configuration
  if (config.files && config.files.length > 0) {
    console.log("Creating files...");
    for (const fileObj of config.files) {
      let targetFile = fileObj.target;
      // If the project has a src folder and the file target is not already in 'src/'
      if (hasSrcFolder && !targetFile.startsWith('src/')) {
        const answer = await askQuestion(
          `Should the file "${targetFile}" be placed inside the src folder? (y/n): `
        );
        if (answer.toLowerCase().startsWith('y')) {
          targetFile = path.join('src', targetFile);
        }
      }
      const targetPath = path.join(process.cwd(), targetFile);

      // Ensure the target directory exists
      const targetDir = path.dirname(targetPath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      if (fileObj.source) {
        // Copy files from the template folder if `source` is specified
        const sourcePath = path.join(path.dirname(templatePath), fileObj.source);
        if (!fs.existsSync(sourcePath)) {
          console.warn(`Template file not found: ${fileObj.source}`);
          continue;
        }
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`Copied ${fileObj.source} to ${targetFile}`);
      } else if (fileObj.content) {
        // Write inline content to the file if `content` is specified
        fs.writeFileSync(targetPath, fileObj.content.trim());
        console.log(`Created file: ${targetFile}`);
      } else {
        console.warn(`File entry is missing 'source' or 'content': ${JSON.stringify(fileObj)}`);
      }
    }
  }

  // Step 6: Update package.json scripts
  console.log("Updating package.json...");
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJsonData = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    if (config.packageScripts) {
      for (const [scriptName, scriptValue] of Object.entries(config.packageScripts)) {
        packageJsonData.scripts[scriptName] = scriptValue;
      }
    }
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJsonData, null, 2), 'utf8');
    console.log("Updated package.json scripts.");
  } else {
    console.warn("package.json not found, skipping script updates.");
  }

  // Finished!
  console.log("Project created and configured successfully!");
}

main();

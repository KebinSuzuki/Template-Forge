import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

/**
 * Load alias mappings from tsconfig.json or jsconfig.json.
 * Returns a mapping from alias (e.g. "@/") to its resolved absolute path.
 */
function loadAliasMappings(projectRoot: string): { [key: string]: string } {
  const tsConfigPath = path.join(projectRoot, 'tsconfig.json');
  const jsConfigPath = path.join(projectRoot, 'jsconfig.json');
  const configPath = fs.existsSync(tsConfigPath)
    ? tsConfigPath
    : fs.existsSync(jsConfigPath)
    ? jsConfigPath
    : null;

  if (!configPath) {
    console.warn(
      'No tsconfig.json or jsconfig.json found. Falling back to default alias mapping.'
    );
    return { '@/': path.join(projectRoot, 'src') };
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const paths = config.compilerOptions?.paths || {};
  const baseUrl = path.resolve(projectRoot, config.compilerOptions?.baseUrl || '.');

  const aliasMappings: { [key: string]: string } = {};
  for (const [alias, targets] of Object.entries(paths)) {
    // Remove trailing wildcard if present.
    const aliasKey = alias.replace(/\*$/, '');
    // Use the first target if multiple are provided.
    const targetPath = path.resolve(baseUrl, (targets as string[])[0].replace(/\*$/, ''));
    aliasMappings[aliasKey] = targetPath;
  }
  // Ensure a default mapping exists for '@/'
  if (!aliasMappings['@/']) {
    aliasMappings['@/'] = path.join(projectRoot, 'src');
  }
  return aliasMappings;
}

/**
 * Given file content, update its alias-based import/require paths to relative ones.
 * In the new project, files will be placed at the same relative locations as in the original project.
 */
function updateAliasPaths(
  fileContent: string,
  fileTargetDir: string,
  aliasMappings: { [key: string]: string }
): string {
  const regex = /((?:from\s+|require\(\s*))(['"])(@\/[^'"]+)(['"])/g;
  return fileContent.replace(regex, (match, prefix, quote1, modulePath, quote2) => {
    for (const [alias, realPath] of Object.entries(aliasMappings)) {
      if (modulePath.startsWith(alias)) {
        const subPath = modulePath.slice(alias.length);
        const absoluteModulePath = path.join(realPath, subPath);
        let relativeModulePath = path.relative(fileTargetDir, absoluteModulePath);
        if (!relativeModulePath.startsWith('.')) {
          relativeModulePath = './' + relativeModulePath;
        }
        // Ensure posix-style separators for consistency.
        relativeModulePath = relativeModulePath.split(path.sep).join('/');
        return `${prefix}${quote1}${relativeModulePath}${quote2}`;
      }
    }
    return match;
  });
}

/**
 * Scan a file’s content to extract external dependencies.
 * Ignores relative imports, alias-based imports, and any dependency that is part of Next.js.
 */
function getExternalDependencies(
  fileContent: string,
  aliasMappings: { [key: string]: string }
): string[] {
  const dependencies = new Set<string>();
  const importRegex = /(?:import\s+(?:[^'"]*\s+from\s+)?|require\(\s*)['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(fileContent)) !== null) {
    const dep = match[1];
    // Skip relative paths.
    if (dep.startsWith('.') || dep.startsWith('/')) {
      continue;
    }
    // Skip if the module specifier starts with any alias.
    let isAlias = false;
    for (const alias of Object.keys(aliasMappings)) {
      if (dep.startsWith(alias)) {
        isAlias = true;
        break;
      }
    }
    if (isAlias) {
      continue;
    }
    // Skip Next.js components
    if (dep === 'next' || dep.startsWith('next/')) {
      continue;
    }
    dependencies.add(dep);
  }
  return Array.from(dependencies);
}

/**
 * Helper to try to resolve a module file given a specifier and a base directory.
 * It checks for the file as-is, with common extensions, or as an index file in a directory.
 */
function resolveModuleFile(moduleSpecifier: string, baseDir: string): string | null {
  let potentialPath = path.resolve(baseDir, moduleSpecifier);
  // Check if the file exists directly.
  if (fs.existsSync(potentialPath) && fs.lstatSync(potentialPath).isFile()) {
    return potentialPath;
  }
  // Try common extensions.
  const extensions = ['.tsx', '.ts', '.jsx', '.js'];
  for (const ext of extensions) {
    if (fs.existsSync(potentialPath + ext)) {
      return potentialPath + ext;
    }
  }
  // If it's a directory, try an index file.
  if (fs.existsSync(potentialPath) && fs.lstatSync(potentialPath).isDirectory()) {
    for (const ext of extensions) {
      const indexFile = path.join(potentialPath, 'index' + ext);
      if (fs.existsSync(indexFile)) {
        return indexFile;
      }
    }
  }
  return null;
}

/**
 * Scan a file’s content to extract internal dependencies.
 * Returns an array of absolute file paths that are imported via a relative or alias-based path.
 */
function getInternalDependencies(
  fileContent: string,
  currentFileDir: string,
  aliasMappings: { [key: string]: string }
): string[] {
  const deps: string[] = [];
  const importRegex = /(?:import\s+(?:[^'"]*\s+from\s+)?|require\(\s*)['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(fileContent)) !== null) {
    const moduleSpecifier = match[1];
    let resolved: string | null = null;
    if (moduleSpecifier.startsWith('.')) {
      // Relative import: resolve relative to the current file.
      resolved = resolveModuleFile(moduleSpecifier, currentFileDir);
    } else {
      // Check if it matches any alias.
      for (const alias of Object.keys(aliasMappings)) {
        if (moduleSpecifier.startsWith(alias)) {
          const subPath = moduleSpecifier.slice(alias.length);
          resolved = resolveModuleFile(subPath, aliasMappings[alias]);
          break;
        }
      }
    }
    if (resolved) {
      deps.push(resolved);
    }
  }
  return deps;
}

/**
 * Extract a single file from the project.
 * Instead of writing a physical file into your extension, this function
 * reads the file, rewrites alias imports, collects both external dependencies
 * and internal (local) file dependencies, and returns an entry to be merged into your JSON template.
 */
function extractFile(
  filePath: string,
  processedFiles: Set<string>,
  filesArray: { target: string; content: string }[],
  projectRoot: string,
  aliasMappings: { [key: string]: string },
  depSet: Set<string>
) {
  const absoluteFilePath = path.resolve(filePath);
  if (processedFiles.has(absoluteFilePath)) {
    return;
  }
  processedFiles.add(absoluteFilePath);

  if (!fs.existsSync(absoluteFilePath)) {
    console.error(`File not found: ${absoluteFilePath}`);
    return;
  }

  let fileContent = fs.readFileSync(absoluteFilePath, 'utf-8');

  // First, record external dependencies.
  const externalDeps = getExternalDependencies(fileContent, aliasMappings);
  externalDeps.forEach(dep => depSet.add(dep));

  // Then, detect and recursively extract internal (local) dependencies.
  const internalDeps = getInternalDependencies(fileContent, path.dirname(absoluteFilePath), aliasMappings);
  for (const internalDep of internalDeps) {
    // Recursively extract each internal dependency.
    if (fs.existsSync(internalDep) && !processedFiles.has(path.resolve(internalDep))) {
      extractFile(internalDep, processedFiles, filesArray, projectRoot, aliasMappings, depSet);
    }
  }

  // Compute the file's relative path with respect to the project root.
  const relativePath = path.relative(projectRoot, absoluteFilePath).split(path.sep).join('/');

  // Simulate the new file location in the target project:
  // In the new project, the file will be placed at the same relative path.
  const newFileTargetDir = path.join(projectRoot, path.dirname(relativePath));
  // Rewrite alias-based imports (relative imports remain unchanged).
  fileContent = updateAliasPaths(fileContent, newFileTargetDir, aliasMappings);

  // Instead of copying the file into your extension, add its entry.
  filesArray.push({
    target: relativePath,
    content: fileContent,
  });

  console.log(`Extracted: ${absoluteFilePath} as ${relativePath}`);
}

/**
 * Extracts a file (and its internal dependencies) and updates the JSON template.
 */
function extractProjectFile(
  entryFile: string,
  configPath: string,
  projectRoot: string
) {
  const processedFiles = new Set<string>();
  const filesArray: { target: string; content: string }[] = [];
  const depSet = new Set<string>();

  const aliasMappings = loadAliasMappings(projectRoot);

  // Process the specified entry file (and recursively any internal dependencies).
  extractFile(entryFile, processedFiles, filesArray, projectRoot, aliasMappings, depSet);

  // Load existing template configuration or initialize a default one.
  const config = fs.existsSync(configPath)
    ? JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    : { directories: [], files: [], dependencies: [], packageScripts: {} };

  // Merge new file entries into the template.
  config.files = [...config.files, ...filesArray];
  filesArray.forEach((file) => {
    const dir = path.dirname(file.target);
    if (!config.directories.includes(dir)) {
      config.directories.push(dir);
    }
  });

  // Merge detected external dependencies.
  const existingDeps = new Set(config.dependencies || []);
  depSet.forEach((dep) => existingDeps.add(dep));
  config.dependencies = Array.from(existingDeps);

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  console.log('Updated template configuration with extracted files and dependencies.');
}

// --- Main CLI Execution ---

const [artifactToExtract, templatePath, projectRoot] = process.argv.slice(2);

if (!artifactToExtract || !templatePath || !projectRoot) {
  console.error('Usage: ts-node extract.ts <artifactToExtract> <templatePath> <projectRoot>');
  process.exit(1);
}

// Instead of writing physical copies into your extension, we only update the template JSON.
extractProjectFile(artifactToExtract, templatePath, projectRoot);

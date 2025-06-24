import { concat, filter, isArray, isString, join as arrayJoin, keys, map } from "@newdash/newdash";
import { includes } from "@newdash/newdash/includes";
import { readFileSync } from "fs";
import { sync } from "glob";
import { dirname, join, join as pathJoin, normalize, relative } from "path";
import { cwd } from "process";
import { Extension, FileImportDescription, PackageJson, ReportVO, ScanResult, TSConfigPaths } from "./type";
import { existsSync } from "fs";

require.extensions[".ts"] = require.extensions[".js"]
require.extensions[".jsx"] = require.extensions[".js"]
require.extensions[".tsx"] = require.extensions[".js"]
require.extensions[".mjs"] = require.extensions[".js"]

const { resolve } = require

export const allDependencies = (absPath: string) => {
  return concatAllDependencies(findProjectPackageJson(absPath))
}

export const concatAllDependencies = (json: PackageJson): string[] => {
  try {
    const { dependencies, devDependencies, peerDependencies } = json;
    var rt = [];
    if (dependencies) {
      rt = concat(rt, keys(dependencies))
    }
    if (devDependencies) {
      rt = concat(rt, keys(devDependencies))
    }
    if (peerDependencies) {
      rt = concat(rt, keys(peerDependencies))
    }
    return rt;
  } catch (error) {
    throw new Error("please run cycle-import-check in npm project (with project.json)")
  }

}

export const findProjectPackageJson = (absPath: string): PackageJson => {
  const finder = require("find-package-json")(absPath)
  return finder.next().value;
}

/**
 * Find and parse tsconfig.json to extract path mappings
 * 
 * @param startPath Starting directory to search for tsconfig.json
 */
export const findTSConfigPaths = (startPath: string): TSConfigPaths | null => {
  let currentPath = startPath;
  
  while (currentPath !== dirname(currentPath)) {
    const tsconfigPath = join(currentPath, 'tsconfig.json');
    if (existsSync(tsconfigPath)) {
      try {
        const content = readFileSync(tsconfigPath, 'utf-8');
        const tsconfig = JSON.parse(content);
        const compilerOptions = tsconfig.compilerOptions || {};
        
        return {
          baseUrl: compilerOptions.baseUrl,
          paths: compilerOptions.paths
        };
      } catch (error) {
        // If parsing fails, continue searching up the directory tree
      }
    }
    currentPath = dirname(currentPath);
  }
  
  return null;
}

/**
 * Resolve a path alias to actual file path
 * 
 * @param importPath The import path (e.g., "@/utils")
 * @param tsconfigDir Directory containing tsconfig.json
 * @param pathMappings Path mappings from tsconfig.json
 */
export const resolvePathAlias = (importPath: string, tsconfigDir: string, pathMappings: TSConfigPaths): string | null => {
  if (!pathMappings.paths) {
    return null;
  }
  
  // Find matching path mapping
  for (const [aliasPattern, targetPatterns] of Object.entries(pathMappings.paths)) {
    const aliasRegex = new RegExp('^' + aliasPattern.replace('*', '(.*)') + '$');
    const match = importPath.match(aliasRegex);
    
    if (match) {
      // Try each target pattern
      for (const targetPattern of targetPatterns) {
        const targetPath = targetPattern.replace('*', match[1] || '');
        const baseUrl = pathMappings.baseUrl || '.';
        const fullPath = join(tsconfigDir, baseUrl, targetPath);
        
        // If the import path ends with .js, try to resolve to .ts/.tsx first
        if (importPath.endsWith('.js')) {
          const pathWithoutExt = fullPath.replace(/\.js$/, '');
          for (const ext of ['.ts', '.tsx']) {
            const testPath = pathWithoutExt + ext;
            if (existsSync(testPath)) {
              return normalize(testPath);
            }
          }
        }
        
        // If the import path ends with .jsx, try to resolve to .tsx first
        if (importPath.endsWith('.jsx')) {
          const pathWithoutExt = fullPath.replace(/\.jsx$/, '');
          const testPath = pathWithoutExt + '.tsx';
          if (existsSync(testPath)) {
            return normalize(testPath);
          }
        }
        
        // Try different file extensions
        const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs'];
        for (const ext of extensions) {
          const testPath = fullPath + ext;
          if (existsSync(testPath)) {
            return normalize(testPath);
          }
        }
        
        // Try index file
        for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
          const indexPath = join(fullPath, 'index' + ext);
          if (existsSync(indexPath)) {
            return normalize(indexPath);
          }
        }
      }
    }
  }
  
  return null;
}

export const filterNodeDependenciesImport = (descriptions: FileImportDescription[], dependencies: string[]) => {
  // @ts-ignore
  return filter(descriptions, i => !includes(dependencies, i.importFile))
}

/**
 * list all acceptable files in a specific directory
 *
 * @param dir
 * @param ext
 */
export const listAllFile = (dir: string, ext: Extension[] = []) => {
  return sync(pathJoin(dir, `./**/*.{${arrayJoin(ext, ",")}}`), {
    nodir: true,
    realpath: true,
    ignore: [
      "**/node_modules/**",
      "**/*.d.ts",
    ]
  })
}

/**
 * read file content
 *
 * @param absolutePath
 */
export const readFile = (absolutePath: string) => {
  return readFileSync(absolutePath, { encoding: "utf8" })
}

/**
 * resolve file path, supporting both relative imports and TypeScript path aliases
 *
 * @param fromFileAbsolutePath
 * @param importFileRelativePath
 */
export const resolveFilePath = (fromFileAbsolutePath: string, importFileRelativePath: string) => {
  // Handle relative imports (existing logic)
  if (importFileRelativePath.startsWith(".")) {
    const dir = dirname(fromFileAbsolutePath);
    const targetPath = join(dir, importFileRelativePath);
    try {
      return normalize(resolve(targetPath));
    } catch (error) {
      return ""
    }
  }
  
  // Handle path aliases
  const fromFileDir = dirname(fromFileAbsolutePath);
  const tsconfigPaths = findTSConfigPaths(fromFileDir);
  if (tsconfigPaths) {
    // Find the directory containing tsconfig.json
    let tsconfigDir = fromFileDir;
    while (tsconfigDir !== dirname(tsconfigDir)) {
      const tsconfigPath = join(tsconfigDir, 'tsconfig.json');
      if (existsSync(tsconfigPath)) {
        break;
      }
      tsconfigDir = dirname(tsconfigDir);
    }
    
    const resolvedPath = resolvePathAlias(importFileRelativePath, tsconfigDir, tsconfigPaths);
    if (resolvedPath) {
      return resolvedPath;
    }
  }
  
  // If not a relative import and not a resolvable alias, return empty
  return "";
}

/**
 * map absolute path to relative path
 *
 * @param paths
 */
export const mapAbsPathsToRelPaths = (paths: string | string[]): string | string[] => {
  if (isString(paths)) {
    return relative(cwd(), paths)
  }
  if (isArray(paths)) {
    return map(paths, p => relative(cwd(), p))
  }
}

export const mapScanResultToReportVO = (result: ScanResult): ReportVO => {
  var rt: ReportVO = { nodes: [], links: [] }
  rt.nodes = map(result.nodes, n => ({ name: (mapAbsPathsToRelPaths(n) as string) }))
  rt.links = map(result.imports, i => ({
    source: (mapAbsPathsToRelPaths(i.fromFile) as string),
    target: (mapAbsPathsToRelPaths(i.importFile) as string),
    value: i.code,
  }))
  return rt;
}

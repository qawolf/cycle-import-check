import { listAllFile, readFile, allDependencies, filterNodeDependenciesImport } from "./file";
import { map, reduce, concat } from "@newdash/newdash";
import { findFileDependencies } from "./processor";
import { calculateCycleImport } from "./graph";
import { ScanResult } from "./type";

/**
 * scan a directory circular dependency status
 *
 * @param directory please use the absolute path
 */
export const scanDirectoryWithResult = (directory: string, options: { ignoreRegex?: RegExp } = {}): ScanResult => {
  const { ignoreRegex } = options;
  const nodeDependencies = allDependencies(directory)
  const filePath = listAllFile(directory, ["js", "jsx", "ts", "tsx", "mjs"])
  const filesContents = map(filePath, filepath => ({ filepath, content: readFile(filepath) }))

  const filteredImports = reduce(
    filesContents,
    (pre, file) => concat(pre,
      filterNodeDependenciesImport(
        findFileDependencies(file.filepath, file.content),
        nodeDependencies
      )
    ),
    []
  )
  const resultWithoutIgnores = calculateCycleImport(filePath, filteredImports)
  const result = ignoreRegex
    ? resultWithoutIgnores.filter(item => item.some(path => {
      const relativePath = path.startsWith(directory) ? path.slice(directory.length + 1) : path;
      return !ignoreRegex.test(relativePath);
    }))
    : resultWithoutIgnores;
  if (result && result.length > 0) {
    return {
      haveCycle: true,
      cycleList: result,
      nodes: filePath,
      imports: filteredImports,
    }
  } else {
    return {
      haveCycle: false,
      cycleList: [],
      nodes: filePath,
      imports: filteredImports,
    }
  }
}

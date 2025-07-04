#!/usr/bin/env node

import "colors"
import { cwd, exit as realExit, argv } from "process";
import { error, log } from "console";
import * as minimist from "minimist";
import { forEach, isEmpty } from "@newdash/newdash";
import { scanDirectoryWithResult } from "./scanner";
import { join, isAbsolute } from "path";
import { mapAbsPathsToRelPaths } from "./file";

const workspaceDir = cwd();

const params = minimist(argv.slice(2), {
  string: "ignoreRegex",
});

var directory = params._[0];

if (isEmpty(directory)) {
  directory = "."
}

if (!isAbsolute(directory)) {
  directory = join(workspaceDir, directory)
}

log(`\nCircular dependency checker running at ${directory}`.green)

const exit = (code: number) => {
  log("\n")
  realExit(code)
}

const result = scanDirectoryWithResult(directory, {
  ignoreRegex: params.ignoreRegex ? new RegExp(params.ignoreRegex) : undefined,
})
if (result.haveCycle) {
  error(`Circular dependency existed in ${directory}`.red)
  forEach(result.cycleList, (cycle, index) => {
    error(`\ncycle ${index + 1}, size (${cycle.length}):${cycle.length === 1 ? " this file import itself".grey : " these files circular import each other".cyan}\n`)
    // @ts-ignore
    forEach(mapAbsPathsToRelPaths(cycle), c => error(`  ${c}`.red))
  })
  exit(1)
} else {
  log(`Not found circular dependency in ${directory}`.green)
  exit(0)
}

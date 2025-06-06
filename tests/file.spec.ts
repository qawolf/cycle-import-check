import { listAllFile, resolveFilePath, mapAbsPathsToRelPaths, mapScanResultToReportVO } from "../src/file";
import { testfile2AbsPath, testfile5AbsPath, fileAbsList, fileRelativeList } from "./test.base";
import { scanDirectoryWithResult } from "../src/scanner";
import { join } from "path";

describe('file list & resolve tests', () => {

  test('should list all files', () => {
    const files = listAllFile("tests/testproject", ["js", "ts"])
    expect(files).toEqual(fileAbsList)
  })

  test('should resolve path', () => {
    const path = resolveFilePath(testfile5AbsPath, "./d2/testfile2.js")
    expect(path).toEqual(testfile2AbsPath)
  })

  test('should file relative convert', () => {
    const r = mapAbsPathsToRelPaths(fileAbsList)
    expect(r).toEqual(fileRelativeList)
  })

  test('should map result to report VO', () => {
    const r = mapScanResultToReportVO(scanDirectoryWithResult(join(__dirname, "./testproject2")))
    expect(r).toMatchSnapshot()
  })


  it('should correctly resolve same name', () => {
    const r = scanDirectoryWithResult(join(__dirname, "./testproject8"))
    expect(mapScanResultToReportVO(r)).toMatchSnapshot()
  })
})
